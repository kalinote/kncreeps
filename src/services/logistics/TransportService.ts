import { BaseService } from "../BaseService";
import { EventBus } from "../../core/EventBus";
import {
  ConsumerInfo,
  ConsumerType,
  ProviderInfo,
  ProviderType,
  TransportNetworkServiceMemory,
  TransportTask,
  TaskPriority,
  TaskStatus,
  TaskType,
  TaskAssignmentType,
  TaskLifetime,
  ProviderStatus,
  Providers,
  Consumers
} from '../../types';
import { Safe, SafeMemoryAccess } from '../../utils/Decorators';
import { LogisticsManager } from "../../managers/LogisticsManager";

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
  link: 0.6,
  creep: 0.4  // 暂定
};

/**
 * 运输服务
 * 负责维护运输网络，并根据供需生成运输任务。
 */
export class TransportService extends BaseService<{ [roomName: string]: TransportNetworkServiceMemory }> {
  protected onCleanup(): void {}
  protected onReset(): void {}

  constructor(eventBus: EventBus, manager: LogisticsManager, memory: any) {
    super(eventBus, manager, memory, 'transportNetworkService');
  }

  protected onInitialize(): void {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        this.initializeRoomMemory(roomName);
      }
    }
  }

  private initializeRoomMemory(roomName: string): void {
    if (!this.memory[roomName]) {
      this.memory[roomName] = {
        providers: {},
        consumers: {},
        lastUpdated: Game.time
      }
    }
  }

  @Safe()
  protected onUpdate(): void {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        this.updateTransportNetwork(room)
      }
    }
  }

  /**
   * 更新房间的运输网络内存
   */
  @SafeMemoryAccess()
  private updateTransportNetwork(room: Room): void {
    const network = this.memory[room.name];

    // 垃圾回收
    // TODO 垃圾回收的频率需要进一步设计
    // TODO 清理被捡起的掉落资源内存，后续可能需要改成事件触发(资源被捡起事件)
    for (const id in network.providers) {
      const provider = network.providers[id];
      // 只对动态资源进行高频清理
      if (provider.type === 'droppedResource' || provider.type === 'tombstone') {
        if (!Game.getObjectById(id as Id<Resource | Tombstone>)) {
          delete network.providers[id];
        }
      }
    }

    // 清理所有无效资源内存
    if (Game.time % 100 === 0) {
      // 清理无效的 provider
      for (const id in network.providers) {
        if (!Game.getObjectById(id as Id<Structure | Creep | Resource | Tombstone>)) {
          delete network.providers[id];
        }
      }
      // 清理无效的 consumer
      for (const id in network.consumers) {
        if (!Game.getObjectById(id as Id<Structure | Creep>)) {
          delete network.consumers[id];
        }
      }
    }

    // 动态 Provider 扫描
    // 扫描掉落的资源
    const droppedResources = room.find(FIND_DROPPED_RESOURCES);
    for (const res of droppedResources) {
      // 添加或更新掉落资源到 providers 列表
      if (!network.providers[res.id]) {
        network.providers[res.id] = this.createProviderInfo(res, res.resourceType);
      }
    }

    // 扫描墓碑
    const tombstones = room.find(FIND_TOMBSTONES);
    for (const tomb of tombstones) {
      if (tomb.store.getUsedCapacity() > 0 && !network.providers[tomb.id]) {
        // 简化处理：只将墓碑中第一种资源注册为可提供
        const resourceType = Object.keys(tomb.store)[0] as ResourceConstant;
        network.providers[tomb.id] = this.createProviderInfo(tomb, resourceType);
      }
    }

    network.lastUpdated = Game.time;
  }

  /**
   * 外部调用接口：设置 Provider
   */
  public setProvider(target: Providers, roomName: string, resourceType: ResourceConstant, status: ProviderStatus): void {
    const network = this.memory[roomName];
    if (!network) return;
    const info = this.createProviderInfo(target, resourceType, status);
    network.providers[target.id] = info;
  }

  /**
   * 外部调用接口：设置 Consumer
   */
  public setConsumer(target: Consumers, roomName: string, resourceType: ResourceConstant): void {
    const network = this.memory[roomName];
    if (!network) return;
    const info = this.createConsumerInfo(target, resourceType);
    network.consumers[target.id] = info;
  }

  /**
   * 外部调用接口：移除 Provider
   */
  public removeProvider(target: Providers, roomName: string): void {
    const network = this.memory[roomName];
    if (!network) return;
    delete network.providers[target.id];
  }

  /**
   * 外部调用接口：移除 Consumer
   */
  public removeConsumer(target: Consumers, roomName: string): void {
    const network = this.memory[roomName];
    if (!network) return;
    delete network.consumers[target.id];
  }

  /**
   * 外部调用接口：更新 Provider 状态
   */
  public updateProviderStatus(target: Providers, roomName: string, resourceType?: ResourceConstant, status?: ProviderStatus): void {
    const network = this.memory[roomName];
    if (!network) return;
    const info = network.providers[target.id];
    if (!info) return;

    if (status) {
      info.status = status;
    }

    if (resourceType) {
      info.resourceType = resourceType;
    }
  }

  /**
   * 外部调用接口：更新 Consumer 状态
   */
  public updateConsumerStatus(target: Consumers, roomName: string, resourceType?: ResourceConstant): void {
    const network = this.memory[roomName];
    if (!network) return;
    const info = network.consumers[target.id];
    if (!info) return;

    if (resourceType) {
      info.resourceType = resourceType;
    }
  }

  /**
   * 外部调用接口：生成所有待处理的运输任务
   */
  public generateTransportTasks(room: Room): TransportTask[] {
    const network = this.memory[room.name];
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

  private getOpenRequests(room: Room, network: TransportNetworkServiceMemory): ConsumerInfo[] {
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

  private getAvailableSources(room: Room, network: TransportNetworkServiceMemory): ProviderInfo[] {
    const sources: ProviderInfo[] = [];
    for (const id in network.providers) {
      const provider = network.providers[id];

      if (provider.status !== 'ready') {
        continue;
      }

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

  private createProviderInfo(target: Providers, resourceType: ResourceConstant, status: ProviderStatus = 'ready'): ProviderInfo {
    const id = target.id;
    const type = target instanceof Resource ? 'droppedResource' : (target instanceof Creep ? 'creep' : (target instanceof Tombstone ? 'tombstone' : target.structureType as ProviderType));
    const pos = target.pos;
    return { id, type, pos, resourceType, status };
  }

  private createConsumerInfo(target: Consumers, resourceType: ResourceConstant): ConsumerInfo {
    const id = target.id;
    const type = target instanceof Creep ? 'creep' : target.structureType as ConsumerType;
    const pos = target.pos;
    return { id, type, pos, resourceType};
  }

  private createTransportTask(provider: ProviderInfo, consumer: ConsumerInfo, amount: number): TransportTask {
    const taskId = `transport-${provider.id}-${consumer.id}-${Game.time}`;
    return {
      id: taskId,
      type: TaskType.TRANSPORT,
      basePriority: TaskPriority.NORMAL,
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

  /**
   * 获取房间的 Provider 列表
   */
  public getProviders(roomName: string): ProviderInfo[] {
    const network = this.memory[roomName];
    if (!network) return [];
    return Object.values(network.providers);
  }

  /**
   * 获取房间的 Consumer 列表
   */
  public getConsumers(roomName: string): ConsumerInfo[] {
    const network = this.memory[roomName];
    if (!network) return [];
    return Object.values(network.consumers);
  }

  /**
   * 获取所有有运输网络的房间
   */
  public getTransportRooms(): string[] {
    return Object.keys(this.memory).filter(roomName => Object.keys(this.memory[roomName].providers).length > 0 || Object.keys(this.memory[roomName].consumers).length > 0);
  }
}
