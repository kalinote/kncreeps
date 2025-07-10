// src/managers/CreepManager.ts - 重构后的协调器实现
import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { ProductionNeed, CreepState } from "../types";
import { CreepCoordinationService } from "../services/CreepCoordinationService";
import { CreepProductionService } from "../services/CreepProductionService";
import { CreepLifecycleService } from "../services/CreepLifecycleService";


/**
 * Creep管理器 - 协调器模式
 * 协调CreepProductionService和CreepLifecycleService的工作
 */
export class CreepManager extends BaseManager {
  constructor(eventBus: EventBus, serviceContainer: any) {
    super(eventBus, serviceContainer);
    this.updateInterval = GameConfig.MANAGER_CONFIGS.CREEP_MANAGER.UPDATE_INTERVAL;
    this.coordinationService.initialize();
  }

  private get coordinationService(): CreepCoordinationService {
    return this.serviceContainer.get('creepCoordinationService');
  }

  private get productionService(): CreepProductionService {
    return this.serviceContainer.get('creepProductionService');
  }

  private get lifecycleService(): CreepLifecycleService {
    return this.serviceContainer.get('creepLifecycleService');
  }

  /**
   * 主更新方法 - 协调各服务的工作
   */
  public update(): void {
    if (!this.shouldUpdate()) return;

    this.safeExecute(() => {
      this.coordinationService.update();
    }, 'CreepManager.update');

    this.updateCompleted();
  }

  // The setupEventListeners is now handled by the CreepCoordinationService.
  // We keep the public interface methods for now for backward compatibility,
  // but they are now delegated to the respective services.

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
    // 使用新的生产需求接口
    this.productionService.addProductionNeed(
      creep.room.name,
      creep.memory.role,
      GameConfig.PRIORITIES.HIGH,
      creep.room.energyAvailable,
      undefined,
      undefined,
      undefined,
      `Manual replacement request: ${creep.name}`
    );
  }

  /**
   * 手动添加生产需求 - 委托给生产服务
   */
  public addProductionNeed(roomName: string, role: string, priority: number, availableEnergy: number): void {
    this.productionService.addProductionNeed(roomName, role, priority, availableEnergy, undefined, undefined, undefined, 'Manual production request');
  }

  /**
   * 重置时的清理工作 - 协调各服务的重置
   */
  protected onReset(): void {
    // This can be moved to the service if needed. For now, it's fine here.
    this.lifecycleService.onReset();
    this.productionService.onReset();
  }
}
