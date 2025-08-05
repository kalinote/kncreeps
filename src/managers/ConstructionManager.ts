import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { ManagerContainer } from "../core/ManagerContainer";
import { ConstructionManagerMemory } from "../types";
import { EventConfig } from "../config/EventConfig";
import { ConstructPlannerLayoutService } from "../services/construction/ConstructPlannerLayoutService";
import { TransportService } from "../services/logistics/TransportService";
import { LogisticsManager } from "./LogisticsManager";
import { ConstructPlannerStrategyService } from "services/construction/ConstructPlannerStrategyService";

/**
 * 建筑管理器
 * 负责驱动建筑规划和创建建筑工地。
 */
export class ConstructionManager extends BaseManager<ConstructionManagerMemory> {
  protected onUpdate(): void {}

  public get constructPlannerLayoutService(): ConstructPlannerLayoutService {
    return this.services.get('constructPlannerLayoutService') as ConstructPlannerLayoutService;
  }

  public get constructPlannerStrategyService(): ConstructPlannerStrategyService {
    return this.services.get('constructPlannerStrategyService') as ConstructPlannerStrategyService;
  }

  public get transportService(): TransportService {
    return this.managerContainer.get<LogisticsManager>("logisticsManager").transportService;
  }

  constructor(eventBus: EventBus, managerContainer: ManagerContainer) {
    super(eventBus, managerContainer, "constructionManager");

    this.registerServices('constructPlannerLayoutService', new ConstructPlannerLayoutService(this.eventBus, this, this.memory));
    this.registerServices('constructPlannerStrategyService', new ConstructPlannerStrategyService(this.eventBus, this, this.memory));
  }

  protected onInitialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastUpdate = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
    }
  }
  protected onCleanup(): void {}
  protected onReset(): void {}
}
