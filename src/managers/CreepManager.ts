// src/managers/CreepManager.ts - 重构后的协调器实现
import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { ProductionNeed, CreepLifecycleServiceMemory, CreepManagerMemory } from "../types";
import { CreepProductionService } from "../services/creep/CreepProductionService";
import { CreepLifecycleService } from "../services/creep/CreepLifecycleService";
import { ServiceContainer } from "../core/ServiceContainer";
import { CreepMoveService } from "../services/creep/CreepMoveService";


/**
 * Creep管理器
 */
export class CreepManager extends BaseManager<CreepManagerMemory> {
  protected readonly memoryKey: string = 'creepManager';

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(
      eventBus,
      serviceContainer,
      [CreepProductionService, CreepLifecycleService, CreepMoveService]
    );

    this.updateInterval = GameConfig.MANAGER_CONFIGS.CREEP_MANAGER.UPDATE_INTERVAL;
  }

  private get productionService(): CreepProductionService {
    return this.serviceContainer.get<CreepProductionService>('creepProductionService');
  }

  private get lifecycleService(): CreepLifecycleService {
    return this.serviceContainer.get<CreepLifecycleService>('creepLifecycleService');
  }

  /**
   * 主更新方法
   */
  public updateManager(): void {}

  /**
   * 初始化内存
   */
  public initialize(): void {
    if (!this.memory.initAt) {
      this.memory = {
        initAt: Game.time,
        lastUpdate: Game.time,
        lastCleanup: Game.time,
        errorCount: 0,
      }
    }
  }

  public cleanup(): void {
    throw new Error("Method not implemented.");
  }

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
  public getCreepState(creepName: string): CreepLifecycleServiceMemory | undefined {
    return this.lifecycleService.getCreepState(creepName);
  }

  /**
   * 获取所有creep状态 - 委托给生命周期服务
   */
  public getAllCreepStates(): { [creepName: string]: CreepLifecycleServiceMemory } {
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
    this.initialize();
  }
}
