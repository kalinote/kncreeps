import { BaseService } from "../BaseService";
import { PerformanceStatsServiceMemory } from "../../types";
import { StatsManager } from "../../managers/StatsManager";
import { EventBus } from "../../core/EventBus";

export class PerformanceStatsService extends BaseService<PerformanceStatsServiceMemory> {
  protected onCleanup(): void {}
  protected onReset(): void {}

  constructor(eventBus: EventBus, manager: StatsManager, memory: any) {
    super(eventBus, manager, memory, 'performance');
  }

  protected onInitialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
      this.memory.lastUpdate = Game.time;
      this.memory.averageTickTime = 0;
      this.memory.averageTickTimeCount = 0;
      this.memory.currentTickTime = 0;
      this.memory.performanceHistory = [];
    }
  }

  protected onUpdate(): void {
    this.updatePerformanceStats();
  }

  /**
   * 更新性能统计信息
   */
  private updatePerformanceStats(): void {
    const currentPerformance: PerformanceStatsServiceMemory = {
      initAt: this.memory.initAt,
      lastCleanup: this.memory.lastCleanup,
      errorCount: this.memory.errorCount,
      lastUpdate: Game.time,
      averageTickTime: this.memory.averageTickTime,
      averageTickTimeCount: this.memory.averageTickTimeCount,
      currentTickTime: Game.cpu.getUsed()
    };

    if (!this.memory.performanceHistory) {
      this.memory.performanceHistory = [];
    }

    // 计算移动平均值
    currentPerformance.averageTickTimeCount = this.memory.performanceHistory.length;
    const avgTickTime = this.memory.performanceHistory.reduce((sum, p) => sum + p.averageTickTime, 0) / currentPerformance.averageTickTimeCount;
    currentPerformance.averageTickTime = avgTickTime;

    // 记录历史
    // TODO 通过参数来配置历史记录长度
    if (this.memory.performanceHistory.length >= 100) {
      this.memory.performanceHistory.shift();
    }
    this.memory.performanceHistory.push(currentPerformance);
  }

}
