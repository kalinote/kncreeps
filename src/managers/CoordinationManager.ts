import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { CoordinationMemory, ResourceAllocation, CrossRoomTask } from "../types";

/**
 * 协调管理器 - 负责跨房间协调和资源分配
 */
export class CoordinationManager extends BaseManager {
  private lastCoordinationCheck: number = 0;

  constructor(eventBus: EventBus, serviceContainer: any) {
    super(eventBus, serviceContainer);
    this.updateInterval = GameConfig.MANAGER_CONFIGS.COORDINATION_MANAGER.UPDATE_INTERVAL;
    this.initializeCoordinationMemory();
  }

  /**
   * 设置事件监听器
   */
  protected setupEventListeners(): void {
    this.on(GameConfig.EVENTS.ROOM_NEEDS_ATTENTION, (data: any) => {
      this.handleRoomNeedsAttention(data);
    });

    this.on(GameConfig.EVENTS.STATS_UPDATED, (data: any) => {
      this.handleStatsUpdated(data);
    });

    this.on(GameConfig.EVENTS.COORDINATION_NEEDED, (data: any) => {
      this.handleCoordinationNeeded(data);
    });
  }

  /**
   * 初始化协调内存
   */
  private initializeCoordinationMemory(): void {
    if (!Memory.coordination) {
      Memory.coordination = {
        lastUpdate: Game.time,
        roomPriorities: {},
        resourceAllocation: {},
        crossRoomTasks: []
      };
    }
  }

  /**
   * 更新协调管理器
   */
  public update(): void {
    if (!this.shouldUpdate()) return;

    this.safeExecute(() => {
      // 检查是否需要协调
      const checkInterval = GameConfig.UPDATE_FREQUENCIES.COORDINATION_CHECK || 50;
      if (Game.time - this.lastCoordinationCheck >= checkInterval) {
        this.updateRoomPriorities();
        this.updateResourceAllocation();
        this.processCrossRoomTasks();
        this.lastCoordinationCheck = Game.time;
      }
    }, 'CoordinationManager.update');

    this.updateCompleted();
  }

  /**
   * 更新房间优先级
   */
  private updateRoomPriorities(): void {
    if (!Memory.coordination) return;

    const roomPriorities: { [roomName: string]: number } = {};

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        let priority = 0;

        // 根据房间状态计算优先级
        if (room.controller.level === 1) {
          priority += 100; // 开局房间优先级最高
        }

        if (room.energyAvailable < GameConfig.THRESHOLDS.EMERGENCY_ENERGY_LEVEL) {
          priority += 50; // 能量紧急
        }

        const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
        if (hostileCreeps.length > 0) {
          priority += 80; // 受到攻击
        }

        const damagedStructures = room.find(FIND_STRUCTURES, {
          filter: (structure) => structure.hits < structure.hitsMax * 0.5
        });
        if (damagedStructures.length > 0) {
          priority += 30; // 建筑受损
        }

        roomPriorities[roomName] = priority;
      }
    }

    Memory.coordination.roomPriorities = roomPriorities;
  }

  /**
   * 更新资源分配
   */
  private updateResourceAllocation(): void {
    if (!Memory.coordination) return;

    const resourceAllocation: { [roomName: string]: ResourceAllocation } = {};

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        const priority = Memory.coordination.roomPriorities[roomName] || 0;

        // 计算该房间的creep分配
        const creeps = Object.values(Game.creeps).filter(creep =>
          creep.room.name === roomName
        );

        const creepCounts: { [role: string]: number } = {};
        for (const creep of creeps) {
          const role = creep.memory.role;
          creepCounts[role] = (creepCounts[role] || 0) + 1;
        }

        resourceAllocation[roomName] = {
          energy: room.energyAvailable,
          creeps: creepCounts,
          priority
        };
      }
    }

    Memory.coordination.resourceAllocation = resourceAllocation;
  }

  /**
   * 处理跨房间任务
   */
  private processCrossRoomTasks(): void {
    if (!Memory.coordination) return;

    // 清理已完成或失败的任务
    Memory.coordination.crossRoomTasks = Memory.coordination.crossRoomTasks.filter(
      task => task.status === 'pending' || task.status === 'in_progress'
    );

    // 处理待处理的任务
    for (const task of Memory.coordination.crossRoomTasks) {
      if (task.status === 'pending') {
        this.processCrossRoomTask(task);
      }
    }
  }

  /**
   * 处理单个跨房间任务
   */
  private processCrossRoomTask(task: CrossRoomTask): void {
    // 这里可以根据任务类型进行具体处理
    // 例如：资源运输、creep支援等

    switch (task.type) {
      case 'resource_transport':
        this.handleResourceTransportTask(task);
        break;
      case 'creep_support':
        this.handleCreepSupportTask(task);
        break;
      default:
        console.log(`[CoordinationManager] 未知的跨房间任务类型: ${task.type}`);
    }
  }

  /**
   * 处理资源运输任务
   */
  private handleResourceTransportTask(task: CrossRoomTask): void {
    // 检查源房间和目标房间的状态
    const sourceRoom = Game.rooms[task.sourceRoom];
    const targetRoom = Game.rooms[task.targetRoom];

    if (!sourceRoom || !targetRoom) {
      task.status = 'failed';
      return;
    }

    // 这里可以创建具体的运输任务
    // 通过TaskManager创建运输任务
    this.emit(GameConfig.EVENTS.TASK_CREATED, {
      type: 'transport',
      sourceRoom: task.sourceRoom,
      targetRoom: task.targetRoom,
      priority: task.priority
    });

    task.status = 'in_progress';
  }

  /**
   * 处理creep支援任务
   */
  private handleCreepSupportTask(task: CrossRoomTask): void {
    // 检查目标房间是否需要支援
    const targetRoom = Game.rooms[task.targetRoom];
    if (!targetRoom) {
      task.status = 'failed';
      return;
    }

    // 检查是否有可用的creep可以支援
    const availableCreeps = Object.values(Game.creeps).filter(creep =>
      creep.room.name === task.sourceRoom &&
      creep.memory.role === 'transporter' &&
      !creep.memory.targetId
    );

    if (availableCreeps.length > 0) {
      // 分配creep进行支援
      const creep = availableCreeps[0];
      creep.memory.targetId = task.id;

      task.status = 'in_progress';
    }
  }

  /**
   * 处理房间需要关注事件
   */
  private handleRoomNeedsAttention(data: any): void {
    const { roomName, alerts, severity } = data;

    // 根据严重程度调整房间优先级
    if (Memory.coordination) {
      let priorityBoost = 0;

      switch (severity) {
        case 'critical':
          priorityBoost = 100;
          break;
        case 'high':
          priorityBoost = 50;
          break;
        case 'medium':
          priorityBoost = 25;
          break;
        case 'low':
          priorityBoost = 10;
          break;
      }

      if (priorityBoost > 0) {
        Memory.coordination.roomPriorities[roomName] =
          (Memory.coordination.roomPriorities[roomName] || 0) + priorityBoost;
      }
    }
  }

  /**
   * 处理统计更新事件
   */
  private handleStatsUpdated(data: any): void {
    // 根据统计信息调整协调策略
    const { globalStats } = data;

    if (globalStats && globalStats.totalCreeps < 5) {
      // 如果creep数量很少，优先保证基础功能
      this.adjustPrioritiesForLowCreepCount();
    }
  }

  /**
   * 处理需要协调事件
   */
  private handleCoordinationNeeded(data: any): void {
    const { type, sourceRoom, targetRoom, priority } = data;

    // 创建跨房间任务
    this.createCrossRoomTask(type, sourceRoom, targetRoom, priority);
  }

  /**
   * 调整低creep数量时的优先级
   */
  private adjustPrioritiesForLowCreepCount(): void {
    if (!Memory.coordination) return;

    // 在creep数量很少时，优先保证能量采集
    for (const roomName in Memory.coordination.roomPriorities) {
      const room = Game.rooms[roomName];
      if (room && room.energyAvailable < room.energyCapacityAvailable * 0.3) {
        Memory.coordination.roomPriorities[roomName] += 30;
      }
    }
  }

  /**
   * 创建跨房间任务
   */
  private createCrossRoomTask(type: string, sourceRoom: string, targetRoom: string, priority: number): void {
    if (!Memory.coordination) return;

    const task: CrossRoomTask = {
      id: `cross_${Game.time}_${Math.floor(Math.random() * 1000)}`,
      type,
      sourceRoom,
      targetRoom,
      priority,
      status: 'pending',
      createdAt: Game.time
    };

    Memory.coordination.crossRoomTasks.push(task);
  }

  /**
   * 获取房间优先级
   */
  public getRoomPriority(roomName: string): number {
    return Memory.coordination?.roomPriorities[roomName] || 0;
  }

  /**
   * 获取资源分配信息
   */
  public getResourceAllocation(roomName?: string): ResourceAllocation | { [roomName: string]: ResourceAllocation } | null {
    if (!Memory.coordination) return null;

    if (roomName) {
      return Memory.coordination.resourceAllocation[roomName] || null;
    }

    return Memory.coordination.resourceAllocation;
  }

  /**
   * 获取跨房间任务
   */
  public getCrossRoomTasks(): CrossRoomTask[] {
    return Memory.coordination?.crossRoomTasks || [];
  }

  /**
   * 重置协调管理器
   */
  protected onReset(): void {
    this.lastCoordinationCheck = 0;
    this.initializeCoordinationMemory();
  }
}
