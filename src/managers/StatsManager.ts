import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { StatsMemory, GlobalStats, RoomStats, PerformanceStats } from "../types";

/**
 * 统计管理器 - 负责全局统计信息收集和提供
 */
export class StatsManager extends BaseManager {
  private lastStatsUpdateTick: number = 0;
  private performanceHistory: PerformanceStats[] = [];

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.setupEventListeners();
    this.initializeStatsMemory();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.on(GameConfig.EVENTS.CREEP_SPAWNED, (data: any) => {
      this.handleCreepSpawned(data);
    });

    this.on(GameConfig.EVENTS.CREEP_DIED, (data: any) => {
      this.handleCreepDied(data);
    });

    this.on(GameConfig.EVENTS.TASK_COMPLETED, (data: any) => {
      this.handleTaskCompleted(data);
    });

    this.on(GameConfig.EVENTS.TASK_FAILED, (data: any) => {
      this.handleTaskFailed(data);
    });
  }

  /**
   * 初始化统计内存
   */
  private initializeStatsMemory(): void {
    if (!Memory.stats) {
      Memory.stats = {
        lastUpdate: Game.time,
        globalStats: {
          totalCreeps: 0,
          totalRooms: 0,
          totalEnergy: 0,
          totalEnergyCapacity: 0,
          totalTasks: 0,
          completedTasks: 0,
          failedTasks: 0
        },
        roomStats: {},
        performanceHistory: []
      };
    }
  }

  /**
   * 更新统计管理器
   */
  public update(): void {
    if (!this.shouldUpdate()) return;

    this.safeExecute(() => {
      // 检查是否需要更新统计
      const updateInterval = GameConfig.UPDATE_FREQUENCIES.STATS_UPDATE || 20;
      if (Game.time - this.lastStatsUpdateTick >= updateInterval) {
        this.updateGlobalStats();
        this.updateRoomStats();
        this.updatePerformanceStats();
        this.lastStatsUpdateTick = Game.time;
      }
    }, 'StatsManager.update');

    this.updateCompleted();
  }

  /**
   * 更新全局统计信息
   */
  private updateGlobalStats(): void {
    if (!Memory.stats) return;

    const globalStats: GlobalStats = {
      totalCreeps: Object.keys(Game.creeps).length,
      totalRooms: Object.keys(Game.rooms).filter(roomName =>
        Game.rooms[roomName].controller?.my
      ).length,
      totalEnergy: 0,
      totalEnergyCapacity: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0
    };

    // 计算总能量
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        globalStats.totalEnergy += room.energyAvailable;
        globalStats.totalEnergyCapacity += room.energyCapacityAvailable;
      }
    }

    // 获取任务统计
    if (Memory.tasks) {
      globalStats.totalTasks = Memory.tasks.taskQueue.length;
      globalStats.completedTasks = Memory.tasks.stats.tasksCompleted;
      globalStats.failedTasks = Memory.tasks.stats.tasksFailed;
    }

    Memory.stats.globalStats = globalStats;
    Memory.stats.lastUpdate = Game.time;

    // 发送统计更新事件
    this.emit(GameConfig.EVENTS.STATS_UPDATED, { globalStats });
  }

  /**
   * 更新房间统计信息
   */
  private updateRoomStats(): void {
    if (!Memory.stats) return;

    const roomStats: { [roomName: string]: RoomStats } = {};

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        const creepCount = Object.values(Game.creeps)
          .filter(creep => creep.room.name === roomName).length;

        roomStats[roomName] = {
          roomName,
          energyAvailable: room.energyAvailable,
          energyCapacity: room.energyCapacityAvailable,
          creepCount,
          constructionSites: room.find(FIND_MY_CONSTRUCTION_SITES).length,
          controllerLevel: room.controller?.level || 0,
          lastUpdate: Game.time
        };
      }
    }

    Memory.stats.roomStats = roomStats;
  }

  /**
   * 更新性能统计信息
   */
  private updatePerformanceStats(): void {
    const performanceStats: PerformanceStats = {
      lastUpdate: Game.time,
      averageTickTime: Game.cpu.getUsed(),
      totalCreeps: Object.keys(Game.creeps).length,
      totalRooms: Object.keys(Game.rooms).filter(roomName =>
        Game.rooms[roomName].controller?.my
      ).length,
      totalTasks: Memory.tasks?.taskQueue.length || 0
    };

    // 添加到性能历史
    this.performanceHistory.push(performanceStats);

    // 保持历史记录在合理范围内
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-50);
    }

    // 计算平均性能
    if (this.performanceHistory.length > 0) {
      const avgTickTime = this.performanceHistory.reduce((sum, stats) =>
        sum + stats.averageTickTime, 0) / this.performanceHistory.length;
      performanceStats.averageTickTime = avgTickTime;
    }

    if (Memory.stats) {
      Memory.stats.performanceHistory = this.performanceHistory;
    }
  }

  /**
   * 处理creep生成事件
   */
  private handleCreepSpawned(data: any): void {
    // 统计信息会在下次更新时自动更新
  }

  /**
   * 处理creep死亡事件
   */
  private handleCreepDied(data: any): void {
    // 统计信息会在下次更新时自动更新
  }

  /**
   * 处理任务完成事件
   */
  private handleTaskCompleted(data: any): void {
    if (Memory.stats) {
      Memory.stats.globalStats.completedTasks++;
    }
  }

  /**
   * 处理任务失败事件
   */
  private handleTaskFailed(data: any): void {
    if (Memory.stats) {
      Memory.stats.globalStats.failedTasks++;
    }
  }

  /**
   * 获取全局统计信息
   */
  public getGlobalStats(): GlobalStats | null {
    return Memory.stats?.globalStats || null;
  }

  /**
   * 获取房间统计信息
   */
  public getRoomStats(roomName?: string): RoomStats | { [roomName: string]: RoomStats } | null {
    if (!Memory.stats) return null;

    if (roomName) {
      return Memory.stats.roomStats[roomName] || null;
    }

    return Memory.stats.roomStats;
  }

    /**
   * 获取性能统计信息
   */
  public getCurrentPerformanceStats(): PerformanceStats | null {
    if (!Memory.stats || Memory.stats.performanceHistory.length === 0) {
      return null;
    }

    return Memory.stats.performanceHistory[Memory.stats.performanceHistory.length - 1];
  }

  /**
   * 获取性能历史
   */
  public getPerformanceHistory(): PerformanceStats[] {
    return Memory.stats?.performanceHistory || [];
  }

  /**
   * 清理过期的性能数据
   */
  private cleanupPerformanceData(): void {
    if (!Memory.stats) return;

    const maxAge = GameConfig.TIMEOUTS.PERFORMANCE_DATA_EXPIRY;
    const currentTime = Game.time;

    Memory.stats.performanceHistory = Memory.stats.performanceHistory.filter(
      stats => currentTime - stats.lastUpdate < maxAge
    );
  }

  /**
   * 重置统计管理器
   */
  protected onReset(): void {
    this.lastStatsUpdateTick = 0;
    this.performanceHistory = [];
    this.initializeStatsMemory();
  }
}
