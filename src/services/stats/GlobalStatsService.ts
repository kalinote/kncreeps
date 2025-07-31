import { BaseService } from "../BaseService";
import { EventBus } from "../../core/EventBus";
import { ServiceContainer } from "../../core/ServiceContainer";
import { GameConfig } from "../../config/GameConfig";
import { Safe } from "../../utils/Decorators";
import { GlobalStatsServiceMemory } from "../../types";

/**
 * 统计服务 - 负责收集、处理和存储游戏统计数据
 */
export class GlobalStatsService extends BaseService<GlobalStatsServiceMemory> {
  protected readonly memoryKey: string = 'globalStats';
  public cleanup(): void {}

  public initialize(): void {
    if (!this.memory.initAt) {
      this.memory = {
        initAt: Game.time,
        lastCleanup: Game.time,
        errorCount: 0,
        lastUpdate: Game.time,
        totalCreeps: 0,
        totalRooms: 0,
        totalEnergy: 0,
        totalEnergyCapacity: 0,
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0
      }
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
   * 更新全局统计信息
   */
  @Safe()
  public update(): void {
    const myRooms = Object.values(Game.rooms).filter(r => r.controller?.my);

    this.memory.totalCreeps = Object.keys(Game.creeps).length;
    this.memory.totalRooms = myRooms.length;

    this.memory.totalEnergy = myRooms.reduce((sum, room) => sum + room.energyAvailable, 0);
    this.memory.totalEnergyCapacity = myRooms.reduce((sum, room) => sum + room.energyCapacityAvailable, 0);

    if (Memory.tasks) {
      this.memory.totalTasks = Memory.tasks.taskQueue.length;
      this.memory.completedTasks = Memory.tasks.stats.tasksCompleted;
      this.memory.failedTasks = Memory.tasks.stats.tasksFailed;
    }

    this.memory.lastUpdate = Game.time;
    this.emit(GameConfig.EVENTS.STATS_UPDATED, { globalStats: this.memory });
  }



  private handleTaskCompleted(data: any): void {
    this.memory.completedTasks++;
  }

  private handleTaskFailed(data: any): void {
    this.memory.failedTasks++;
  }
}
