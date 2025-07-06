import { BaseManager } from "../core/BaseManager";
import { EventBus } from "../core/EventBus";
import { BaseBehavior, BehaviorResult } from "../behaviors/BaseBehavior";
import { HarvesterBehavior } from "../behaviors/HarvesterBehavior";
import { TransporterBehavior } from "../behaviors/TransporterBehavior";
import { BuilderBehavior } from "../behaviors/BuilderBehavior";
import { UpgraderBehavior } from "../behaviors/UpgraderBehavior";
import { DefenderBehavior } from "../behaviors/DefenderBehavior";
import { GameConfig } from "../config/GameConfig";

/**
 * 行为管理器 - 管理所有creep的行为执行
 */
export class BehaviorManager extends BaseManager {
  private behaviors: Map<string, BaseBehavior> = new Map();

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.initializeBehaviorStatsMemory();
    this.initializeBehaviors();
    this.setupEventListeners();
  }

  /**
   * 初始化behaviorStats内存
   */
  private initializeBehaviorStatsMemory(): void {
    if (!Memory.behaviorStats) {
      Memory.behaviorStats = {};
    }
  }

  /**
   * 获取behaviorStats（从Memory中获取）
   */
  private get behaviorStats(): { [role: string]: BehaviorStats } {
    if (!Memory.behaviorStats) {
      Memory.behaviorStats = {};
    }
    return Memory.behaviorStats;
  }

  /**
   * 设置单个角色的行为统计
   */
  private setBehaviorStats(role: string, stats: BehaviorStats): void {
    if (!Memory.behaviorStats) {
      Memory.behaviorStats = {};
    }
    Memory.behaviorStats[role] = stats;
  }

  /**
   * 初始化所有行为
   */
  private initializeBehaviors(): void {
    // 注册矿工行为
    this.registerBehavior(GameConfig.ROLES.HARVESTER, new HarvesterBehavior(this.eventBus));

    // 注册搬运工行为
    this.registerBehavior(GameConfig.ROLES.TRANSPORTER, new TransporterBehavior(this.eventBus));

    // 注册建筑工行为
    this.registerBehavior(GameConfig.ROLES.BUILDER, new BuilderBehavior(this.eventBus));

    // 注册升级工行为
    this.registerBehavior(GameConfig.ROLES.UPGRADER, new UpgraderBehavior(this.eventBus));

    // 注册防御工行为
    this.registerBehavior(GameConfig.ROLES.DEFENDER, new DefenderBehavior(this.eventBus));

    // TODO: 后期扩展 - 注册其他角色的行为
    // this.registerBehavior(GameConfig.ROLES.ENGINEER, new EngineerBehavior(this.eventBus));

    console.log(`[BehaviorManager] 已注册 ${this.behaviors.size} 种行为`);
  }

  /**
   * 注册行为
   */
  private registerBehavior(role: string, behavior: BaseBehavior): void {
    this.behaviors.set(role, behavior);
    this.setBehaviorStats(role, {
      executions: 0,
      successes: 0,
      failures: 0,
      lastExecution: 0,
      averageExecutionTime: 0
    });
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.on(GameConfig.EVENTS.CREEP_SPAWNED, (data: any) => {
      console.log(`[BehaviorManager] 新creep已出生: ${data.name}, 角色: ${data.role}`);
    });

    this.on(GameConfig.EVENTS.CREEP_DIED, (data: any) => {
      console.log(`[BehaviorManager] Creep已死亡: ${data.name}, 角色: ${data.role}`);
    });
  }

  public update(): void {
    if (!this.shouldUpdate()) return;

    this.safeExecute(() => {
      this.runAllCreepBehaviors();
      this.updateBehaviorStats();
    }, 'BehaviorManager.update');

    this.updateCompleted();
  }

  /**
   * 运行所有creep的行为
   */
  private runAllCreepBehaviors(): void {
    const startTime = Game.cpu.getUsed();
    let executedCount = 0;
    let successCount = 0;

    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      const result = this.runCreepBehavior(creep);

      executedCount++;
      if (result.success) {
        successCount++;
      }

      // 记录行为执行结果
      this.recordBehaviorResult(creep, result);
    }

    const executionTime = Game.cpu.getUsed() - startTime;

    // 定期输出统计信息
    if (Game.time % GameConfig.UPDATE_FREQUENCIES.CLEANUP === 0) {
      console.log(`[BehaviorManager] 执行了 ${executedCount} 个creep行为, 成功: ${successCount}, CPU: ${executionTime.toFixed(2)}`);
    }
  }

  /**
   * 运行单个creep的行为
   */
  private runCreepBehavior(creep: Creep): BehaviorResult {
    const role = creep.memory.role;
    const behavior = this.behaviors.get(role);

    if (!behavior) {
      return {
        success: false,
        message: `未找到角色 ${role} 的行为定义`
      };
    }

    if (!behavior.canExecute(creep)) {
      return {
        success: false,
        message: `行为 ${behavior.getName()} 无法执行`
      };
    }

    const startTime = Game.cpu.getUsed();
    const result = behavior.run(creep);
    const executionTime = Game.cpu.getUsed() - startTime;

    // 更新统计信息
    const stats = this.behaviorStats[role];
    if (stats) {
      stats.executions++;
      stats.lastExecution = Game.time;
      stats.averageExecutionTime = (stats.averageExecutionTime + executionTime) / 2;

      if (result.success) {
        stats.successes++;
      } else {
        stats.failures++;
      }

      // 保存更新后的统计信息
      this.setBehaviorStats(role, stats);
    }

    return result;
  }

  /**
   * 记录行为执行结果
   */
  private recordBehaviorResult(creep: Creep, result: BehaviorResult): void {
    // 如果行为建议状态转换，应用它
    if (result.nextState) {
      creep.memory.state = result.nextState;
    }

    // 记录到内存中用于调试
    if (!result.success) {
      console.log(`[${creep.name}] 行为执行失败: ${result.message}`);
    }

    // TODO: 后期扩展 - 更详细的日志记录和分析
    // 1. 记录性能指标
    // 2. 记录异常情况
    // 3. 生成行为报告
  }

  /**
   * 更新行为统计信息
   */
  private updateBehaviorStats(): void {
    // 定期清理统计信息
    if (Game.time % GameConfig.UPDATE_FREQUENCIES.LONG_TERM_PLANNING === 0) {
      for (const [role, stats] of Object.entries(this.behaviorStats)) {
        if (stats && stats.executions > 0) {
          const successRate = (stats.successes / stats.executions * 100).toFixed(1);
          console.log(`[行为统计] ${role}: 成功率 ${successRate}%, 平均CPU ${stats.averageExecutionTime.toFixed(2)}`);
        }
      }
    }
  }

  /**
   * 获取行为统计信息
   */
  public getBehaviorStats(): Map<string, any> {
    return new Map(Object.entries(this.behaviorStats));
  }

  /**
   * 获取指定角色的行为
   */
  public getBehavior(role: string): BaseBehavior | undefined {
    return this.behaviors.get(role);
  }

  /**
   * 检查角色是否有对应的行为
   */
  public hasBehavior(role: string): boolean {
    return this.behaviors.has(role);
  }

  protected onReset(): void {
    this.behaviors.clear();
    Memory.behaviorStats = {};
    this.initializeBehaviors();
  }
}
