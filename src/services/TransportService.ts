import { BaseService } from './BaseService';
import { EventBus } from '../core/EventBus';
import { ServiceContainer } from '../core/ServiceContainer';
import {
  ConsumerInfo,
  ConsumerType,
  ProviderInfo,
  ProviderType,
  TransportNetworkMemory,
  TransportTask,
  TaskPriority,
  TaskStatus,
  TaskType,
  TaskAssignmentType,
  TaskLifetime
} from '../types';

// 临时定义，后续可以移到Config文件中
const CONSUMER_IMPORTANCE: Record<ConsumerType, number> = {
  spawn: 1.0,
  extension: 1.0,
  tower: 0.8,
  container: 0.5, // Controller container
  storage: 0.2,
  terminal: 0.2,
  lab: 0.4,
  nuker: 0.3,
  powerSpawn: 0.7,
  link: 0.6
};

/**
 * 运输服务
 * 负责维护运输网络，并根据供需生成运输任务。
 */
export class TransportService extends BaseService {
  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
  }

  public update(): void {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        this.safeExecute(() => this.updateTransportNetwork(room), `updateTransportNetwork for ${roomName}`);
      }
    }
  }

  /**
   * 更新房间的运输网络内存
   * @param room 房间对象
   */
  private updateTransportNetwork(room: Room): void {
    if (!room.memory.logistics) {
      room.memory.logistics = {};
    }
    if (!room.memory.logistics.transportNetwork) {
      room.memory.logistics.transportNetwork = {
        providers: {},
        consumers: {},
        lastUpdated: Game.time
      };
    }

    const network = room.memory.logistics.transportNetwork;
    if (Game.time % 10 !== 0 && Game.time !== network.lastUpdated) {
      return;
    }

    network.providers = {};
    network.consumers = {};

    // 使用FIND_STRUCTURES以包含Container等中立建筑
    const structures = room.find(FIND_STRUCTURES);
    for (const s of structures) {
      // 识别消耗点
      if (
        (s.structureType === STRUCTURE_SPAWN ||
          s.structureType === STRUCTURE_EXTENSION ||
          s.structureType === STRUCTURE_TOWER) &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      ) {
        network.consumers[s.id] = this.createConsumerInfo(s, RESOURCE_ENERGY);
      }

      // 识别容器
      if (s.structureType === STRUCTURE_CONTAINER) {
        this.identifyContainerRole(room, s, network);
      }
    }

    // 识别动态提供点
    const droppedResources = room.find(FIND_DROPPED_RESOURCES);
    for (const res of droppedResources) {
      network.providers[res.id] = this.createProviderInfo(res, res.resourceType);
    }

    network.lastUpdated = Game.time;
  }

  /**
   * 识别容器的角色
   */
  private identifyContainerRole(room: Room, container: StructureContainer, network: TransportNetworkMemory): void {
    const nearbySource = container.pos.findInRange(FIND_SOURCES, 2)[0];
    if (nearbySource) {
      network.providers[container.id] = this.createProviderInfo(container, RESOURCE_ENERGY);
      return;
    }

    const nearbyMineral = container.pos.findInRange(FIND_MINERALS, 2)[0];
    if (nearbyMineral) {
      network.providers[container.id] = this.createProviderInfo(container, nearbyMineral.mineralType);
      return;
    }

    if (room.controller && container.pos.inRangeTo(room.controller, 3)) {
      network.consumers[container.id] = this.createConsumerInfo(container, RESOURCE_ENERGY);
      return;
    }
  }

  /**
   * 生成所有待处理的运输任务
   */
  public generateTransportTasks(room: Room): TransportTask[] {
    const network = room.memory.logistics?.transportNetwork;
    if (!network) return [];

    const openRequests = this.getOpenRequests(room, network);
    const availableSources = this.getAvailableSources(room, network);

    // console.log(`[TransportService] openRequests: ${JSON.stringify(openRequests)}`);
    // console.log(`[TransportService] availableSources: ${JSON.stringify(availableSources)}`);

    if (openRequests.length === 0 || availableSources.length === 0) {
      return [];
    }

    for (const req of openRequests) {
      const importance = CONSUMER_IMPORTANCE[req.type] || 0.5;
      const target = Game.getObjectById(req.id as Id<AnyStructure>);
      if (target && 'store' in target) {
        const capacity = target.store.getCapacity(req.resourceType);
        const urgency = (req.needs && capacity) ? req.needs / capacity : 0;
        req.priority = importance * urgency;
      } else {
        req.priority = 0;
      }
    }
    openRequests.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const tasks: TransportTask[] = [];
    const tempProviderAmounts = new Map<string, number>();
    availableSources.forEach(s => tempProviderAmounts.set(s.id, s.amount || 0));

    for (const req of openRequests) {
      let remainingNeeds = req.needs || 0;
      if (remainingNeeds <= 0) continue;

      // 循环查找最近且仍有余量的 provider，直到需求满足
      while (remainingNeeds > 0) {
        const potentialProviders = availableSources.filter(
          p => p.resourceType === req.resourceType && (tempProviderAmounts.get(p.id) || 0) > 0
        );
        if (potentialProviders.length === 0) break; // 没有可用供应

        const consumerPos = new RoomPosition(req.pos.x, req.pos.y, req.pos.roomName);
        const providerPositions = potentialProviders.map(p => new RoomPosition(p.pos.x, p.pos.y, p.pos.roomName));
        const closestPos = consumerPos.findClosestByPath(providerPositions);
        if (!closestPos) break; // 无法寻路

        const providerInfo = potentialProviders.find(p => p.pos.x === closestPos.x && p.pos.y === closestPos.y);
        if (!providerInfo) break;

        const providerAmount = tempProviderAmounts.get(providerInfo.id) || 0;
        const amountToTransport = Math.min(remainingNeeds, providerAmount);
        if (amountToTransport <= 0) {
          // provider 已无可用资源
          tempProviderAmounts.set(providerInfo.id, 0);
          continue;
        }

        // 创建运输任务
        tasks.push(this.createTransportTask(providerInfo, req, amountToTransport));

        // 更新供需剩余量
        remainingNeeds -= amountToTransport;
        tempProviderAmounts.set(providerInfo.id, providerAmount - amountToTransport);
      }
    }

    return tasks;
  }

  // --- 辅助方法 ---

  private getOpenRequests(room: Room, network: TransportNetworkMemory): ConsumerInfo[] {
    const requests: ConsumerInfo[] = [];
    for (const id in network.consumers) {
      const consumer = network.consumers[id];
      const obj = Game.getObjectById(id as Id<AnyStructure>);
      if (obj && 'store' in obj) {
        const needs = obj.store.getFreeCapacity(consumer.resourceType);
        if (needs && needs > 0) {
          consumer.needs = needs;
          requests.push(consumer);
        }
      }
    }
    return requests;
  }

  private getAvailableSources(room: Room, network: TransportNetworkMemory): ProviderInfo[] {
    const sources: ProviderInfo[] = [];
    for (const id in network.providers) {
      const provider = network.providers[id];
      const obj = Game.getObjectById(id as Id<AnyStructure | Resource | Tombstone>);
      if (obj) {
        let amount = 0;
        if (obj instanceof Resource) {
          amount = obj.amount;
        } else if ('store' in obj) {
          amount = obj.store.getUsedCapacity(provider.resourceType) || 0;
        }
        if (amount > 0) {
          provider.amount = amount;
          sources.push(provider);
        }
      }
    }
    return sources;
  }

  private createConsumerInfo(target: Structure, resourceType: ResourceConstant): ConsumerInfo {
    return { id: target.id, type: target.structureType as ConsumerType, pos: target.pos, resourceType };
  }

  private createProviderInfo(target: StructureContainer | Resource, resourceType: ResourceConstant): ProviderInfo {
    const id = target.id;
    const type = target instanceof Resource ? 'droppedResource' : target.structureType;
    return { id, type, pos: target.pos, resourceType };
  }

  private createTransportTask(provider: ProviderInfo, consumer: ConsumerInfo, amount: number): TransportTask {
    const taskId = `transport-${provider.id}-${consumer.id}-${Game.time}`;
    return {
      id: taskId,
      type: TaskType.TRANSPORT,
      priority: TaskPriority.NORMAL,
      status: TaskStatus.PENDING,
      roomName: provider.pos.roomName,
      assignmentType: TaskAssignmentType.EXCLUSIVE,
      lifetime: TaskLifetime.ONCE,
      maxAssignees: 1,
      assignedCreeps: [],
      createdAt: Game.time,
      updatedAt: Game.time,
      retryCount: 0,
      maxRetries: 2,
      params: {
        sourceId: provider.type !== 'droppedResource' ? provider.id : undefined,
        sourcePos: provider.type === 'droppedResource' ? provider.pos : undefined,
        targetId: consumer.id,
        resourceType: provider.resourceType,
        amount: amount
      }
    };
  }
}
