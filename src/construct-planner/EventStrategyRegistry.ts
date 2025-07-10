import { GameConfig } from "../config/GameConfig";

// 定义策略对象的接口
interface EmergencyStrategy {
  name: string;
  priorityPlanners: string[];
  triggerPlanner: boolean;
}

/**
 * 紧急事件策略注册表
 * 负责关联游戏事件和应对的建筑策略。
 */
export class EventStrategyRegistry {
  private strategies: Map<string, EmergencyStrategy> = new Map();

  constructor() {
    this.registerStrategies();
  }

  /**
   * 注册所有紧急策略
   */
  private registerStrategies(): void {
    // 关联“房间受攻击”事件和“防御策略”
    this.strategies.set(
      GameConfig.EVENTS.ROOM_UNDER_ATTACK,
      GameConfig.CONSTRUCTION.EMERGENCY_STRATEGIES.UNDER_ATTACK
    );

    // 未来可以在这里注册更多策略
    // this.strategies.set(GameConfig.EVENTS.LOW_ENERGY, someOtherStrategy);
  }

  /**
   * 获取一个事件对应的策略
   * @param eventType 事件类型
   * @returns 紧急策略或 undefined
   */
  public getStrategy(eventType: string): EmergencyStrategy | undefined {
    return this.strategies.get(eventType);
  }

  /**
   * 获取所有被监听的事件类型
   */
  public getMonitoredEvents(): string[] {
    return Array.from(this.strategies.keys());
  }
}
