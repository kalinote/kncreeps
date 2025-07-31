import { BaseService } from "../BaseService";
import { PerformanceStatsServiceMemory } from "../../types";


export class PerformanceStatsService extends BaseService<PerformanceStatsServiceMemory> {
  protected readonly memoryKey: string = 'performance';

  public cleanup(): void {}

  public initialize(): void {
    if (!this.memory.initAt) {
      this.memory = {
        initAt: Game.time,
        lastCleanup: Game.time,
        errorCount: 0,
        lastUpdate: Game.time,
        averageTickTime: 0,
        averageTickTimeCount: 0,
        currentTickTime: 0,
        performanceHistory: []
      }
    }
  }

  public update(): void {
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
