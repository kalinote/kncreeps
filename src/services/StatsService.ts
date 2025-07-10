import { BaseService } from './BaseService';
import { EventBus } from '../core/EventBus';
import { ServiceContainer } from '../core/ServiceContainer';
import { StatsMemory, GlobalStats, RoomStats, PerformanceStats } from '../types';
import { GameConfig } from '../config/GameConfig';

/**
 * 统计服务 - 负责收集、处理和存储游戏统计数据
 */
export class StatsService extends BaseService {
  private performanceHistory: PerformanceStats[] = [];

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.loadPerformanceHistory();
  }

  /**
   * 从内存中加载性能历史记录
   */
  private loadPerformanceHistory(): void {
    if (Memory.stats?.performanceHistory) {
      this.performanceHistory = Memory.stats.performanceHistory;
    }
  }

  /**
   * 设置事件监听器
   */
  protected setupEventListeners(): void {
    this.on(GameConfig.EVENTS.TASK_COMPLETED, this.handleTaskCompleted.bind(this));
    this.on(GameConfig.EVENTS.TASK_FAILED, this.handleTaskFailed.bind(this));
  }

  /**
   * 执行所有统计更新任务
   */
  public run(): void {
    this.safeExecute(() => {
      this.updateGlobalStats();
      this.updateAllRoomStats();
      this.updatePerformanceStats();
    }, 'StatsService.run');
  }

  /**
   * 更新全局统计信息
   */
  private updateGlobalStats(): void {
    const memoryStats = this.getMemoryStats();
    if (!memoryStats) return;

    const myRooms = Object.values(Game.rooms).filter(r => r.controller?.my);

    memoryStats.globalStats.totalCreeps = Object.keys(Game.creeps).length;
    memoryStats.globalStats.totalRooms = myRooms.length;

    memoryStats.globalStats.totalEnergy = myRooms.reduce((sum, room) => sum + room.energyAvailable, 0);
    memoryStats.globalStats.totalEnergyCapacity = myRooms.reduce((sum, room) => sum + room.energyCapacityAvailable, 0);

    if (Memory.tasks) {
      memoryStats.globalStats.totalTasks = Memory.tasks.taskQueue.length;
      memoryStats.globalStats.completedTasks = Memory.tasks.stats.tasksCompleted;
      memoryStats.globalStats.failedTasks = Memory.tasks.stats.tasksFailed;
    }

    memoryStats.lastUpdate = Game.time;
    this.emit(GameConfig.EVENTS.STATS_UPDATED, { globalStats: memoryStats.globalStats });
  }

  /**
   * 更新所有房间的统计信息
   */
  private updateAllRoomStats(): void {
    const memoryStats = this.getMemoryStats();
    if (!memoryStats) return;

    const myRooms = Object.values(Game.rooms).filter(r => r.controller?.my);

    // 清理旧的房间统计
    memoryStats.roomStats = {};

    for (const room of myRooms) {
      memoryStats.roomStats[room.name] = this.createRoomStats(room);
    }
  }

  /**
   * 为单个房间创建统计对象
   */
  private createRoomStats(room: Room): RoomStats {
    return {
      roomName: room.name,
      energyAvailable: room.energyAvailable,
      energyCapacity: room.energyCapacityAvailable,
      creepCount: room.find(FIND_MY_CREEPS).length,
      constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
      controllerLevel: room.controller?.level || 0,
      lastUpdate: Game.time
    };
  }

  /**
   * 更新性能统计信息
   */
  private updatePerformanceStats(): void {
    const memoryStats = this.getMemoryStats();
    if (!memoryStats) return;

    const currentPerformance: PerformanceStats = {
      lastUpdate: Game.time,
      averageTickTime: Game.cpu.getUsed(), // 初始值为当前tick的CPU消耗
      totalCreeps: Object.keys(Game.creeps).length,
      totalRooms: Object.values(Game.rooms).filter(r => r.controller?.my).length,
      totalTasks: Memory.tasks?.taskQueue.length || 0
    };

    this.performanceHistory.push(currentPerformance);

    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift(); // 保持数组大小
    }

    // 计算移动平均值
    const avgTickTime = this.performanceHistory.reduce((sum, p) => sum + p.averageTickTime, 0) / this.performanceHistory.length;
    // 注意：这里可能应该更新 currentPerformance.averageTickTime，但为了与原始逻辑保持一致，暂时不修改
    // currentPerformance.averageTickTime = avgTickTime;

    memoryStats.performanceHistory = this.performanceHistory;
  }

  private handleTaskCompleted(data: any): void {
    const memoryStats = this.getMemoryStats();
    if (memoryStats) {
      memoryStats.globalStats.completedTasks++;
    }
  }

  private handleTaskFailed(data: any): void {
    const memoryStats = this.getMemoryStats();
    if (memoryStats) {
      memoryStats.globalStats.failedTasks++;
    }
  }

  private getMemoryStats(): StatsMemory | undefined {
    return Memory.stats;
  }

  // --- Public Accessors ---

  public getGlobalStats(): GlobalStats | undefined {
    return Memory.stats?.globalStats;
  }

  public getRoomStats(roomName: string): RoomStats | undefined {
    return Memory.stats?.roomStats[roomName];
  }

  public getAllRoomStats(): { [roomName: string]: RoomStats } | undefined {
    return Memory.stats?.roomStats;
  }

  public getCurrentPerformance(): PerformanceStats | undefined {
    return this.performanceHistory[this.performanceHistory.length - 1];
  }

  public getPerformanceHistory(): PerformanceStats[] {
    return this.performanceHistory;
  }
}
