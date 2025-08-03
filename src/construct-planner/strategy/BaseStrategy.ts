import { ConstructPlannerStrategyService } from "services/construction/ConstructPlannerStrategyService";
import { PlanningTaskMemory } from "types/construction";

export abstract class BaseStrategy {
  public abstract readonly name: string; // 策略名称
  protected service: ConstructPlannerStrategyService;

  constructor(service: ConstructPlannerStrategyService) {
    this.service = service;
  }

  /**
   * 返回该策略监听的事件类型列表。
   */
  public abstract getSubscribedEvents(): string[];

  /**
   * 处理监听到的事件。
   * @param eventType 事件类型
   * @param eventData 事件数据
   * @returns 返回一个规划上下文对象则触发规划，返回null则不触发。
   */
  public abstract handleEvent(eventType: string, eventData: any): PlanningTaskMemory[];
}
