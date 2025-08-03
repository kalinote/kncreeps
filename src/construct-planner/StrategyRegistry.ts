import { ConstructPlannerStrategyService } from "../services/construction/ConstructPlannerStrategyService";
import { BaseStrategy } from "./strategy/BaseStrategy";
import { InitialRoomSetupStrategy } from "./strategy/InitialRoomSetupStrategy";
import { RclUpgradeStrategy } from "./strategy/RclUpgradeStrategy";

/**
 * 规划策略注册表
 * 统一管理所有的规划策略。
 */
export class StrategyRegistry {
  private strategies: Map<string, BaseStrategy> = new Map();
  private eventToStrategies: Map<string, BaseStrategy[]> = new Map();
  private service: ConstructPlannerStrategyService;

  constructor(service: ConstructPlannerStrategyService) {
    this.service = service;
    this.registerStrategies();
  }

  /**
   * 注册所有的策略实例
   */
  private registerStrategies(): void {
    // 在这里注册你所有的策略
    this.register(new InitialRoomSetupStrategy(this.service));
    // this.register(new RclUpgradeStrategy(this.service));
  }

  private register(strategy: BaseStrategy): void {
    if (this.strategies.has(strategy.name)) {
      console.log(`[StrategyRegistry] 警告: 重复注册策略 ${strategy.name}`);
      return;
    }
    this.strategies.set(strategy.name, strategy);

    // 建立事件到策略的映射，方便快速查找
    for (const eventType of strategy.getSubscribedEvents()) {
      if (!this.eventToStrategies.has(eventType)) {
        this.eventToStrategies.set(eventType, []);
      }
      this.eventToStrategies.get(eventType)!.push(strategy);
    }
  }

  /**
   * 获取一个指定名称的策略
   */
  public getStrategy(strategyName: string): BaseStrategy | undefined {
    return this.strategies.get(strategyName);
  }

  /**
   * 获取所有已注册的策略实例
   */
  public getAllStrategies(): BaseStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * 获取监听指定事件的所有策略
   */
  public getStrategiesForEvent(eventType: string): BaseStrategy[] {
    return this.eventToStrategies.get(eventType) || [];
  }

  /**
   * 获取所有策略监听的事件类型（去重后）
   */
  public getAllSubscribedEvents(): string[] {
    return Array.from(this.eventToStrategies.keys());
  }
}
