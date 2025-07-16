import { BaseService } from "./BaseService";
import { CreepProductionService } from "./CreepProductionService";
import { CreepLifecycleService } from "./CreepLifecycleService";
import { GameConfig } from "../config/GameConfig";

/**
 * Creep协调服务 - 协调生产和生命周期服务
 */
export class CreepCoordinationService extends BaseService {
  private get productionService(): CreepProductionService {
    return this.serviceContainer.get('creepProductionService');
  }

  private get lifecycleService(): CreepLifecycleService {
    return this.serviceContainer.get('creepLifecycleService');
  }

  public initialize(): void {
    this.lifecycleService.initializeCreepStatesMemory();
  }

  /**
   * 更新协调服务
   */
  public update(): void {
    // 更新生命周期
    this.lifecycleService.updateCreepStates();

    // 处理生产逻辑
    this.productionService.assessProductionNeeds();
    this.productionService.executeProduction();
  }

  /**
   * 设置事件监听器
   */
  protected setupEventListeners(): void {
    this.on(GameConfig.EVENTS.ROOM_UNDER_ATTACK, (data: any) => {
      this.handleRoomUnderAttack(data);
    });
  }

  private handleRoomUnderAttack(data: any): void {
    this.productionService.handleRoomUnderAttack(data.roomName, data.hostileCount);
  }
}
