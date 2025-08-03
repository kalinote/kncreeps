import { BaseService } from "services/BaseService";
import { ConstructionManager } from "managers/ConstructionManager";
import { ConstructionManagerMemory, ConstructPlannerStrategyServiceMemory, PlanningTaskMemory } from "../../types/construction";
import { EventBus } from "core/EventBus";
import { StrategyRegistry } from "construct-planner/StrategyRegistry";


export class ConstructPlannerStrategyService extends BaseService<ConstructPlannerStrategyServiceMemory, ConstructionManager> {
  protected onCleanup(): void { }
  protected onReset(): void { }
  protected onUpdate(): void { }

  private _strategyRegistry: StrategyRegistry;

  public get strategyRegistry(): StrategyRegistry {
    return this._strategyRegistry;
  }

  constructor(eventBus: EventBus, manager: ConstructionManager, memory: ConstructionManagerMemory) {
    super(eventBus, manager, memory, 'strategy');
    this._strategyRegistry = new StrategyRegistry(this);

    // 本来所有事件监听器都应该在setupEventListeners中设置，但是由于setupEventListeners会在super的constructor中调用
    // 而调用时this._strategyRegistry还没有实例化，所以这里需要手动设置
    const allEvents = this._strategyRegistry.getAllSubscribedEvents();
    console.log(`[StrategyService] allEvents: ${allEvents}`);
    for (const eventType of allEvents) {
      this.on(eventType, (data: any) => this.handleGenericEvent(eventType, data));
    }
  }

  protected onInitialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastUpdate = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
      this.memory.planningQueue = [];
      this.memory.strategy = {};
    }
  }

  private handleGenericEvent(eventType: string, eventData: any): void {
    const strategies = this._strategyRegistry.getStrategiesForEvent(eventType);
    for (const strategy of strategies) {
      // 调用策略的 handleEvent，它现在返回一个任务数组
      const tasks = strategy.handleEvent(eventType, eventData);

      // 如果返回了任务数组，则将所有任务入队
      if (tasks.length > 0) {
        for (const task of tasks) {
          this.enqueuePlanningTask(task);
        }
      }
    }
  }

  public enqueuePlanningTask(task: PlanningTaskMemory): void {
    this.memory.planningQueue.push(task);
    console.log(`[StrategyService] 房间 ${task.context.roomName} 新规划任务入队: [${task.plannerName}] 规划器`);
  }

  public getPlanningQueue(): PlanningTaskMemory[] {
    return this.memory.planningQueue;
  }

}
