import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { ServiceContainer } from "../core/ServiceContainer";
import { StatsService } from "../services/StatsService";

/**
 * 统计管理器 - 协调全局统计信息的收集流程
 */
export class StatsManager extends BaseManager {
  private statsService: StatsService;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.statsService = this.serviceContainer.get<StatsService>('statsService');
    this.updateInterval = GameConfig.MANAGER_CONFIGS.STATS_MANAGER.UPDATE_INTERVAL;
    this.initializeStatsMemory();
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
   * 更新统计管理器，驱动统计服务
   */
  public update(): void {
    if (!this.shouldUpdate()) return;

    this.safeExecute(() => {
      this.statsService.run();
    }, 'StatsManager.update');

    this.updateCompleted();
  }

  /**
   * 重置钩子，可在需要时清理内存
   */
  protected onReset(): void {
    // console.log("[StatsManager] Resetting state.");
  }

  /**
   * 此管理器不再直接监听业务事件，相关逻辑已移至StatsService
   */
  protected setupEventListeners(): void {}
}
