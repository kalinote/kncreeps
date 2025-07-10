import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { ServiceContainer } from "../core/ServiceContainer";
import { RoomService } from "../services/RoomService";

/**
 * 房间管理器 - 协调房间相关的服务和操作
 */
export class RoomManager extends BaseManager {
  private roomService: RoomService;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.roomService = serviceContainer.get("roomService");
    this.updateInterval = GameConfig.MANAGER_CONFIGS.ROOM_MANAGER.UPDATE_INTERVAL;
  }

  /**
   * 更新房间管理器
   */
  public update(): void {
    if (!this.shouldUpdate()) {
      return;
    }

    this.safeExecute(() => this.roomService.run(), 'RoomService.run');

    this.updateCompleted();
  }

  /**
   * 设置事件监听器
   * RoomManager 不再直接处理业务逻辑，相关监听器已移至RoomService
   */
  protected setupEventListeners(): void {
    // 可以保留一些只与Manager协调相关的监听，目前为空
  }

  // =================================================================
  // Public Accessors - 委托给 RoomService
  // =================================================================

  /**
   * 获取指定名称的房间对象
   */
  public getRoom(roomName: string): Room | undefined {
    return this.roomService.getRoom(roomName);
  }

  /**
   * 获取所有己方房间的名称列表
   */
  public getMyRoomNames(): string[] {
    return this.roomService.getMyRoomNames();
  }

  /**
   * 检查指定房间是否有敌人威胁
   */
  public hasEnemyThreat(roomName: string): boolean {
    return this.roomService.hasEnemyThreat(roomName);
  }

  /**
   * 获取房间的威胁等级
   */
  public getRoomThreatLevel(roomName: string): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    return this.roomService.getRoomThreatLevel(roomName);
  }

  /**
   * 获取房间威胁的详细信息
   */
  public getRoomThreatDetails(roomName: string): {
    threatLevel: string;
    hostileCount: number;
    lastActivity: number | undefined;
  } | null {
    return this.roomService.getRoomThreatDetails(roomName);
  }

  /**
   * 获取房间信息更新周期
   */
  public getUpdateCycleInfo() {
    return {
      nextUpdateIn: this.lastUpdateTick + this.updateInterval - Game.time,
      updateInterval: this.updateInterval
    }
  }
}
