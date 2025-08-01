import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { ServiceContainer } from "../core/ServiceContainer";
import { GameConfig } from "../config/GameConfig";
import { ConstructionManagerMemory, RoomLayoutMemory } from "../types";
import { EventConfig } from "../config/EventConfig";
import { ConstructPlannerService } from "../services/construction/ConstructPlannerService";
import { Safe } from "../utils/Decorators";
import { TransportService } from "../services/logistics/TransportService";
import { LogisticsManager } from "./LogisticsManager";

/**
 * 建筑管理器
 * 负责驱动建筑规划和创建建筑工地。
 */
export class ConstructionManager extends BaseManager<ConstructionManagerMemory> {
  public updateManager(): void {}

  public get constructPlannerService(): ConstructPlannerService {
    return this.services.get('constructPlannerService') as ConstructPlannerService;
  }

  public get transportService(): TransportService {
    return this.serviceContainer.get<LogisticsManager>("logisticsManager").transportService;
  }

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer, "constructionManager");

    this.registerServices('constructPlannerService', new ConstructPlannerService(this.eventBus, this, this.memory));
  }

  /**
   * 设置事件监听
   */
  protected setupEventListeners(): void {
    // 监听建造完成事件
    this.on(EventConfig.EVENTS.CONSTRUCTION_COMPLETED, (data: any) => {
      this.handleConstructionCompleted(data);
    });
  }

  public initialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastUpdate = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
    }
  }
  public cleanup(): void {}


  /**
   * 处理建造完成事件
   * TODO 这里的处理方式需要进一步确认
   */
  private handleConstructionCompleted(data: { structureId: Id<Structure>, structureType: StructureConstant, roomName: string }): void {
    const { structureId, structureType, roomName } = data;

    const structure = Game.getObjectById(structureId);
    if (!structure) {
      console.log(`[ConstructionManager] 警告：收到建筑完成事件，但无法通过ID找到建筑: ${structureId}`);
      return;
    }

    console.log(`[ConstructionManager] 收到建筑完成事件: ${structureType} at ${structure.pos}`);

    // 更新运输网络建筑状态
    switch (structureType) {
        case STRUCTURE_CONTAINER:
        case STRUCTURE_STORAGE:
        case STRUCTURE_TERMINAL:
        case STRUCTURE_LINK:
            this.transportService.updateProviderStatus(structure, roomName, undefined, 'ready');
            console.log(`[TransportService] 已将 ${structureType} (${structure.id}) 状态更新为 'ready'`);
            break;
    }

    // 原有的道路处理逻辑
    if (structureType === STRUCTURE_ROAD) {
      this.emit(EventConfig.EVENTS.CONSTRUCTION_PLAN_UPDATED, {
        roomName,
        structureType,
        status: 'construction_progress',
        position: structure.pos
      });
    }
  }
}
