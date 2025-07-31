import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { ServiceContainer } from "../core/ServiceContainer";
import { StatsManagerMemory } from "../types";
import { GlobalStatsService } from "../services/stats/GlobalStatsService";
import { RoomStatsService } from "../services/stats/RoomStatsService";
import { PerformanceStatsService } from "../services/stats/PerformanceStatsService";

/**
 * 统计管理器 - 协调全局统计信息的收集流程
 */
export class StatsManager extends BaseManager<StatsManagerMemory> {
  protected readonly memoryKey: string = 'statsManager';

  public cleanup(): void {}

  public get globalStatsService(): GlobalStatsService {
    return this.services.get("globalStatsService") as GlobalStatsService;
  }
  public get roomStatsService(): RoomStatsService {
    return this.services.get("roomStatsService") as RoomStatsService;
  }
  public get performanceStatsService(): PerformanceStatsService {
    return this.services.get("performanceStatsService") as PerformanceStatsService;
  }

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.updateInterval = GameConfig.MANAGER_CONFIGS.STATS_MANAGER.UPDATE_INTERVAL;

    this.registerServices("globalStatsService", new GlobalStatsService(this.eventBus, this, this.memory));
    this.registerServices("roomStatsService", new RoomStatsService(this.eventBus, this, this.memory));
    this.registerServices("performanceStatsService", new PerformanceStatsService(this.eventBus, this, this.memory));
  }

  /**
   * 初始化统计内存
   */
  public initialize(): void {
    if (!this.memory.initAt) {
      this.memory = {
        initAt: Game.time,
        lastUpdate: Game.time,
        lastCleanup: Game.time,
        errorCount: 0
      };
    }
  }

  /**
   * 更新统计管理器，驱动统计服务
   */
  public updateManager(): void {}
}
