// src/managers/CreepManager.ts - 重构后的协调器实现
import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { ProductionNeed, CreepLifecycleMemory, CreepManagerMemory } from "../types";
import { CreepProductionService } from "../services/creep/CreepProductionService";
import { CreepLifecycleService } from "../services/creep/CreepLifecycleService";
import { ServiceContainer } from "../core/ServiceContainer";
import { CreepMoveService } from "../services/creep/CreepMoveService";
import { TaskManager } from "./TaskManager";


/**
 * Creep管理器
 */
export class CreepManager extends BaseManager<CreepManagerMemory> {
  protected onCleanup(): void {}
  protected onUpdate(): void {}
  protected onReset(): void {}

  public get productionService(): CreepProductionService {
    return this.services.get('productionService') as CreepProductionService;
  }
  public get lifecycleService(): CreepLifecycleService {
    return this.services.get('lifecycleService') as CreepLifecycleService;
  }
  public get moveService(): CreepMoveService {
    return this.services.get('moveService') as CreepMoveService;
  }

  public get taskManager(): TaskManager {
    return this.serviceContainer.get<TaskManager>('taskManager');
  }

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer, 'creepManager');

    this.updateInterval = GameConfig.MANAGER_CONFIGS.CREEP_MANAGER.UPDATE_INTERVAL;

    // 注册服务
    this.registerServices('productionService', new CreepProductionService(this.eventBus, this, this.memory));
    this.registerServices('lifecycleService', new CreepLifecycleService(this.eventBus, this, this.memory));
    this.registerServices('moveService', new CreepMoveService(this.eventBus, this, this.memory));
  }

  /**
   * 初始化内存
   */
  protected onInitialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastUpdate = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
    }
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
  public getCreepState(creepName: string): CreepLifecycleMemory | undefined {
    return this.lifecycleService.getCreepState(creepName);
  }

  /**
   * 获取所有creep状态 - 委托给生命周期服务
   */
  public getAllCreepStates(): { [creepName: string]: CreepLifecycleMemory } {
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
    this.emit(GameConfig.EVENTS.CREEP_PRODUCTION_NEEDED, {
      roomName: creep.room.name,
      role: creep.memory.role,
      priority: GameConfig.PRIORITIES.HIGH,
      availableEnergy: creep.room.energyAvailable,
      energyBudget: undefined,
      taskType: undefined,
      taskCount: undefined,
      reason: `手动替换需求: ${creep.name}`
    });
  }

  /**
   * 手动添加生产需求 - 委托给生产服务
   */
  public addProductionNeed(roomName: string, role: string, priority: number, availableEnergy: number): void {
    this.emit(GameConfig.EVENTS.CREEP_PRODUCTION_NEEDED, {
      roomName,
      role,
      priority,
      availableEnergy,
      energyBudget: undefined,
      taskType: undefined,
      taskCount: undefined,
      reason: `手动添加生产需求`
    });
  }


}
