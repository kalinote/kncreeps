import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { ManagerContainer } from "../core/ManagerContainer";
import { StatsManagerMemory } from "../types";
import { GlobalStatsService } from "../services/stats/GlobalStatsService";
import { RoomStatsService } from "../services/stats/RoomStatsService";
import { PerformanceStatsService } from "../services/stats/PerformanceStatsService";

/**
 * 统计管理器 - 协调全局统计信息的收集流程
 */
export class StatsManager extends BaseManager<StatsManagerMemory> {
  protected onCleanup(): void {}
  protected onReset(): void {}

  public get globalStatsService(): GlobalStatsService {
    return this.services.get("globalStatsService") as GlobalStatsService;
  }
  public get roomStatsService(): RoomStatsService {
    return this.services.get("roomStatsService") as RoomStatsService;
  }
  public get performanceStatsService(): PerformanceStatsService {
    return this.services.get("performanceStatsService") as PerformanceStatsService;
  }

  constructor(eventBus: EventBus, managerContainer: ManagerContainer) {
    super(eventBus, managerContainer, "statsManager");
    this.updateInterval = GameConfig.MANAGER_CONFIGS.STATS_MANAGER.UPDATE_INTERVAL;

    this.registerServices("globalStatsService", new GlobalStatsService(this.eventBus, this, this.memory));
    this.registerServices("roomStatsService", new RoomStatsService(this.eventBus, this, this.memory));
    this.registerServices("performanceStatsService", new PerformanceStatsService(this.eventBus, this, this.memory));
  }

  /**
   * 初始化统计内存
   */
  protected onInitialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastUpdate = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
    }
  }

  /**
   * 更新统计管理器，驱动统计服务
   */
  protected onUpdate(): void {}
}
