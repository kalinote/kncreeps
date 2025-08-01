import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { ServiceContainer } from "../core/ServiceContainer";
import { RoomService } from "../services/room/RoomService";
import { Safe } from "../utils/Decorators";
import { RoomManagerMemory } from "../types";
import { LogisticsManager } from "./LogisticsManager";

/**
 * 房间管理器 - 协调房间相关的服务和操作
 */
export class RoomManager extends BaseManager<RoomManagerMemory> {
  public get roomService(): RoomService {
    return this.services.get('roomService') as RoomService;
  }

  public get logisticsManager(): LogisticsManager {
    return this.serviceContainer.get<LogisticsManager>('logisticsManager');
  }

  public updateManager(): void {}
  public cleanup(): void {}

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer, 'roomManager');
    this.updateInterval = GameConfig.MANAGER_CONFIGS.ROOM_MANAGER.UPDATE_INTERVAL;

    this.registerServices('roomService', new RoomService(this.eventBus, this, this.memory));
  }

  public initialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastUpdate = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
    }
  }

  /**
   * 设置事件监听器
   * RoomManager 不再直接处理业务逻辑，相关监听器已移至RoomService
   */
  protected setupEventListeners(): void {}

}
