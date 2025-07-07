// src/managers/CreepManager.ts - 重构后的协调器实现
import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { ProductionNeed, CreepState } from "../types";
import { RoomManager } from "./RoomManager";
import { CreepProductionService } from "../services/CreepProductionService";
import { CreepLifecycleService } from "../services/CreepLifecycleService";

/**
 * Creep管理器 - 协调器模式
 * 协调CreepProductionService和CreepLifecycleService的工作
 */
export class CreepManager extends BaseManager {
  private roomManager: RoomManager | null = null;
  private productionService: CreepProductionService;
  private lifecycleService: CreepLifecycleService;

  constructor(
    eventBus: EventBus,
    productionService: CreepProductionService,
    lifecycleService: CreepLifecycleService,
    roomManager?: RoomManager
  ) {
    super(eventBus);
    this.roomManager = roomManager || null;

    // 接收注入的服务实例
    this.productionService = productionService;
    this.lifecycleService = lifecycleService;

    this.setupEventListeners();
    this.lifecycleService.initializeCreepStatesMemory();
  }

  /**
   * 设置RoomManager引用
   */
  public setRoomManager(roomManager: RoomManager): void {
    this.roomManager = roomManager;
  }

  /**
   * 主更新方法 - 协调各服务的工作
   */
  public update(): void {
    if (!this.shouldUpdate()) return;

    this.safeExecute(() => {
      // 更新生命周期
      this.lifecycleService.updateCreepStates();

      // 处理生产逻辑
      this.productionService.assessProductionNeeds();
      this.productionService.executeProduction();

      // 清理死亡creep
      this.lifecycleService.cleanupDeadCreeps();
    }, 'CreepManager.update');

    this.updateCompleted();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.on(GameConfig.EVENTS.CREEP_DIED, (data: any) => {
      this.handleCreepDeath(data);
    });

    this.on(GameConfig.EVENTS.ROOM_ENERGY_CHANGED, (data: any) => {
      this.handleRoomEnergyChanged(data);
    });

    this.on(GameConfig.EVENTS.ROOM_UNDER_ATTACK, (data: any) => {
      this.handleRoomUnderAttack(data);
    });
  }

  /**
   * 处理Creep死亡事件 - 转发给生命周期服务
   */
  private handleCreepDeath(data: any): void {
    this.lifecycleService.handleCreepDeath(data);
  }

  /**
   * 处理房间能量变化事件
   */
  private handleRoomEnergyChanged(data: any): void {
    // 能量变化可能触发生产机会，但现在由生产服务在下次评估时处理
    // 这里可以添加额外的逻辑如果需要
  }

  /**
   * 处理房间受到攻击事件 - 转发给生产服务
   */
  private handleRoomUnderAttack(data: any): void {
    this.productionService.handleRoomUnderAttack(data.roomName, data.hostileCount);
  }

  // ========== 公共接口方法 - 委托给相应的服务 ==========

  /**
   * 获取Creep统计信息 - 委托给生命周期服务
   */
  public getCreepStats(): any {
    return this.lifecycleService.getCreepStats();
  }

  /**
   * 获取生产队列 - 委托给生产服务
   */
  public getProductionQueue(): ProductionNeed[] {
    return this.productionService.getProductionQueue();
  }

  /**
   * 获取指定creep的状态 - 委托给生命周期服务
   */
  public getCreepState(creepName: string): CreepState | undefined {
    return this.lifecycleService.getCreepState(creepName);
  }

  /**
   * 获取所有creep状态 - 委托给生命周期服务
   */
  public getAllCreepStates(): { [creepName: string]: CreepState } {
    return this.lifecycleService.getAllCreepStates();
  }

  /**
   * 检查creep是否需要替换 - 委托给生命周期服务
   */
  public needsReplacement(creepName: string): boolean {
    return this.lifecycleService.needsReplacement(creepName);
  }

  /**
   * 获取指定阶段的creep列表 - 委托给生命周期服务
   */
  public getCreepsByPhase(phase: 'young' | 'mature' | 'aging'): string[] {
    return this.lifecycleService.getCreepsByPhase(phase);
  }

  /**
   * 获取指定房间的creep统计 - 委托给生命周期服务
   */
  public getRoomCreepStats(roomName: string): any {
    return this.lifecycleService.getRoomCreepStats(roomName);
  }

  /**
   * 计算Creep效率 - 委托给生命周期服务
   */
  public calculateCreepEfficiency(creep: Creep): number {
    return this.lifecycleService.calculateCreepEfficiency(creep);
  }

  /**
   * 手动请求Creep替换 - 委托给生产服务
   */
  public requestCreepReplacement(creep: Creep): void {
    this.productionService.requestCreepReplacement(creep);
  }

  /**
   * 手动添加生产需求 - 委托给生产服务
   */
  public addProductionNeed(roomName: string, role: string, priority: number, availableEnergy: number): void {
    this.productionService.addProductionNeed(roomName, role, priority, availableEnergy);
  }

  /**
   * 重置时的清理工作 - 协调各服务的重置
   */
  protected onReset(): void {
    // 重置生命周期服务
    this.lifecycleService.onReset();

    // 重置生产服务
    this.productionService.onReset();
  }
}
