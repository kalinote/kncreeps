import { EventBus } from "../../core/EventBus";
import { GameConfig } from "../../config/GameConfig";
import { CreepLifecycleServiceMemory } from "../../types";
import { BaseService } from "../BaseService";
import { CreepManager } from "../../managers/CreepManager";

/**
 * Creep生命周期服务 - 处理所有Creep的生命周期管理
 * 从CreepManager中提取出来，保持原有逻辑不变
 */
export class CreepLifecycleService extends BaseService<{ [creepName: string]: CreepLifecycleServiceMemory }> {
  private previousCreepNames: Set<string> = new Set();

  constructor(eventBus: EventBus, manager: CreepManager, memory: any) {
    super(eventBus, manager, memory, 'creepStates');
  }

  protected onInitialize(): void {}

  protected onUpdate(): void {
    this.updateCreepStates();
  }

  protected onCleanup(): void {}
  protected onReset(): void {}

  /**
   * 发送事件到事件总线
   */
  protected emit(eventType: string, data: any): void {
    this.eventBus.emit(eventType, data);
  }

  /**
   * 设置事件监听器
   */
  protected setupEventListeners(): void {
    this.on(GameConfig.EVENTS.CREEP_DIED, (data: any) => {
      this.handleCreepDeath(data);
    });
  }

  /**
   * 获取creepStates
   */
  private get creepStates(): { [creepName: string]: CreepLifecycleServiceMemory } {
    return this.memory;
  }

  /**
   * 设置单个creep状态
   */
  private setCreepState(creepName: string, state: CreepLifecycleServiceMemory): void {
    this.memory[creepName] = state;
  }

  /**
   * 删除creep状态
   */
  private deleteCreepState(creepName: string): void {
    if (this.memory && this.memory[creepName]) {
      delete this.memory[creepName];
    }
  }

  /**
   * 检测creep死亡并触发事件
   * 这是系统中唯一负责检测creep死亡的模块
   */
  private detectAndEmitCreepDeaths(): void {
    try {
      const currentCreepNames = new Set(Object.keys(Game.creeps));

      // 检测死亡的creep
      for (const creepName of this.previousCreepNames) {
        if (!currentCreepNames.has(creepName)) {
          this.emitCreepDeathEvent(creepName);
        }
      }

      // 更新上一tick的creep列表
      this.previousCreepNames = currentCreepNames;
    } catch (error) {
      // console.log(`[CreepLifecycleService] 死亡检测错误: ${error}`);
      // 错误时重置状态，确保下次正常运行
      this.previousCreepNames = new Set(Object.keys(Game.creeps));
    }
  }

  /**
   * 触发creep死亡事件
   */
  private emitCreepDeathEvent(creepName: string): void {
    const creepMemory = Memory.creeps[creepName];
    if (!creepMemory) return;

    const deathData = {
      creepName,
      role: creepMemory.role,
      roomName: creepMemory.room
    };

    // 触发死亡事件
    this.emit(GameConfig.EVENTS.CREEP_DIED, deathData);
    // console.log(`💀 [CreepLifecycleService] 检测到creep死亡: ${creepName} (${creepMemory.role})`);
  }

  /**
   * 更新所有Creep的状态
   */
  public updateCreepStates(): void {
    // 1. 检测死亡（唯一检测点）
    this.detectAndEmitCreepDeaths();

    // 2. 更新存活creep的状态
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      this.updateCreepState(creep);
    }
  }

  /**
   * 更新单个Creep的状态
   */
  public updateCreepState(creep: Creep): void {
    const ticksToLive = creep.ticksToLive || GameConfig.SYSTEM.CREEP_LIFETIME;
    const lifePercent = ticksToLive / GameConfig.SYSTEM.CREEP_LIFETIME;

    let phase: 'young' | 'mature' | 'aging';
    if (lifePercent > 0.7) {
      phase = 'young';
    } else if (lifePercent > 0.3) {
      phase = 'mature';
    } else {
      phase = 'aging';
    }

    const state: CreepLifecycleServiceMemory = {
      name: creep.name,
      phase,
      ticksToLive,
      lifePercent,
      needsReplacement: ticksToLive < GameConfig.THRESHOLDS.CREEP_REPLACEMENT_TIME
    };

    this.setCreepState(creep.name, state);

    // 检查是否需要替换 - 委托给生产服务
    // TODO 检查是否有现成可替换creep，如果有则直接替换而不是请求生产
    if (state.needsReplacement) {
      this.emit(GameConfig.EVENTS.CREEP_PRODUCTION_NEEDED, {
        roomName: creep.room.name,
        role: creep.memory.role,
        priority: GameConfig.PRIORITIES.HIGH,
        availableEnergy: creep.room.energyAvailable,
        energyBudget: undefined,
        taskType: undefined,
        taskCount: undefined,
        reason: `creep ${creep.name} 生命周期结束，需要替换`
      });
    }
  }

  /**
   * 计算Creep效率
   */
  public calculateCreepEfficiency(creep: Creep): number {
    const workParts = creep.body.filter(part => part.type === WORK).length;
    const moveParts = creep.body.filter(part => part.type === MOVE).length;
    const carryParts = creep.body.filter(part => part.type === CARRY).length;

    let efficiency = 1.0;

    // 如果没有移动部件，效率降低
    if (moveParts === 0) efficiency *= GameConfig.THRESHOLDS.EFFICIENCY_PENALTY_NO_MOVE;

    // 根据角色调整效率
    switch (creep.memory.role) {
      case GameConfig.ROLES.WORKER:
        efficiency *= workParts > 0 ? 1.0 : GameConfig.THRESHOLDS.EFFICIENCY_PENALTY_NO_TOOL;
        break;
      case GameConfig.ROLES.TRANSPORTER:
        efficiency *= carryParts > 0 ? 1.0 : GameConfig.THRESHOLDS.EFFICIENCY_PENALTY_NO_TOOL;
        break;
      case GameConfig.ROLES.SHOOTER:
        efficiency *= workParts > 0 ? 1.0 : GameConfig.THRESHOLDS.EFFICIENCY_PENALTY_NO_TOOL;
        break;
    }

    return efficiency;
  }

  /**
   * 处理Creep死亡事件
   */
  public handleCreepDeath(data: any): void {
    const creepName = data.creepName;
    const role = data.role;
    const roomName = data.roomName;

    console.log(`💀 [CreepLifecycleService] Creep ${creepName} (${role}) 死亡，房间: ${roomName}`);

    // 清理状态
    this.deleteCreepState(creepName);

    // 清理内存
    if (Memory.creeps[creepName]) {
      delete Memory.creeps[creepName];
    }

    // 如果是重要角色，立即请求替换
    if (role === GameConfig.ROLES.WORKER || role === GameConfig.ROLES.TRANSPORTER) {
      const room = Game.rooms[roomName];
      if (room && room.controller?.my) {
        const availableEnergy = room.energyAvailable;
        // 委托给生产服务
        // TODO 检查是否有现成可替换creep，如果有则直接替换而不是请求生产
        this.emit(GameConfig.EVENTS.CREEP_PRODUCTION_NEEDED, {
          roomName,
          role,
          priority: GameConfig.PRIORITIES.HIGH,
          availableEnergy,
          energyBudget: undefined,
          taskType: undefined,
          taskCount: undefined,
          reason: `creep ${creepName} 死亡，需要替换`
        });
      }
    }
  }

  /**
   * 清理已死亡的Creep
   * 现在完全依赖事件驱动，此方法保留用于兼容性
   */
  public cleanupDeadCreeps(): void {
    // 死亡creep的清理现在完全通过事件驱动
    // 此方法保留用于向后兼容
  }

  /**
   * 获取Creep统计信息
   */
  public getCreepStats(): any {
    const stats = {
      totalCreeps: Object.keys(Game.creeps).length,
      byRole: {} as { [role: string]: number },
      byRoom: {} as { [roomName: string]: number },
      byPhase: {
        young: 0,
        mature: 0,
        aging: 0
      },
      efficiency: {
        average: 0,
        total: 0
      }
    };

    let totalEfficiency = 0;
    let creepCount = 0;

    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      const role = creep.memory.role;
      const roomName = creep.room.name;

      // 统计角色
      stats.byRole[role] = (stats.byRole[role] || 0) + 1;

      // 统计房间
      stats.byRoom[roomName] = (stats.byRoom[roomName] || 0) + 1;

      // 统计生命阶段
      const state = this.creepStates[name];
      if (state) {
        stats.byPhase[state.phase]++;
      }

      // 计算效率
      const efficiency = this.calculateCreepEfficiency(creep);
      totalEfficiency += efficiency;
      creepCount++;
    }

    stats.efficiency.average = creepCount > 0 ? totalEfficiency / creepCount : 0;
    stats.efficiency.total = totalEfficiency;

    return stats;
  }

  /**
   * 获取指定creep的状态
   */
  public getCreepState(creepName: string): CreepLifecycleServiceMemory | undefined {
    return this.creepStates[creepName];
  }

  /**
   * 获取所有creep状态
   */
  public getAllCreepStates(): { [creepName: string]: CreepLifecycleServiceMemory } {
    return { ...this.creepStates };
  }

  /**
   * 检查creep是否需要替换
   */
  public needsReplacement(creepName: string): boolean {
    const state = this.creepStates[creepName];
    return state ? state.needsReplacement : false;
  }

  /**
   * 获取指定阶段的creep列表
   */
  public getCreepsByPhase(phase: 'young' | 'mature' | 'aging'): string[] {
    const creepNames: string[] = [];

    for (const [name, state] of Object.entries(this.creepStates)) {
      if (state.phase === phase && Game.creeps[name]) {
        creepNames.push(name);
      }
    }

    return creepNames;
  }

  /**
   * 获取指定房间的creep统计
   */
  public getRoomCreepStats(roomName: string): any {
    const stats = {
      totalCreeps: 0,
      byRole: {} as { [role: string]: number },
      byPhase: {
        young: 0,
        mature: 0,
        aging: 0
      },
      efficiency: {
        average: 0,
        total: 0
      }
    };

    let totalEfficiency = 0;
    let creepCount = 0;

    for (const name in Game.creeps) {
      const creep = Game.creeps[name];

      // 只统计指定房间的creep
      if (creep.room.name !== roomName) {
        continue;
      }

      const role = creep.memory.role;
      stats.totalCreeps++;

      // 统计角色
      stats.byRole[role] = (stats.byRole[role] || 0) + 1;

      // 统计生命阶段
      const state = this.creepStates[name];
      if (state) {
        stats.byPhase[state.phase]++;
      }

      // 计算效率
      const efficiency = this.calculateCreepEfficiency(creep);
      totalEfficiency += efficiency;
      creepCount++;
    }

    stats.efficiency.average = creepCount > 0 ? totalEfficiency / creepCount : 0;
    stats.efficiency.total = totalEfficiency;

    return stats;
  }
}
