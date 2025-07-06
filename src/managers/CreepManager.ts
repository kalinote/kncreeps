// src/managers/CreepManager.ts - 完整实现
import { BaseManager } from "../core/BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { BodyBuilder } from "../utils/BodyBuilder";
import { ProductionNeed, CreepState } from "../types";
import { RoomManager } from "./RoomManager";

/**
 * Creep管理器 - 管理所有Creep的生命周期和生产
 */
export class CreepManager extends BaseManager {
  private lastProductionCheck: number = 0;
  private roomManager: RoomManager | null = null;

  constructor(eventBus: EventBus, roomManager?: RoomManager) {
    super(eventBus);
    this.roomManager = roomManager || null;
    this.setupEventListeners();
    this.initializeCreepStatesMemory();
  }

  /**
   * 设置RoomManager引用
   */
  public setRoomManager(roomManager: RoomManager): void {
    this.roomManager = roomManager;
  }

  /**
   * 初始化creepStates内存
   */
  private initializeCreepStatesMemory(): void {
    if (!Memory.creepStates) {
      Memory.creepStates = {};
    }
  }

  /**
   * 获取creepStates（从Memory中获取）
   */
  private get creepStates(): { [creepName: string]: CreepState } {
    if (!Memory.creepStates) {
      Memory.creepStates = {};
    }
    return Memory.creepStates;
  }

  /**
   * 设置单个creep状态
   */
  private setCreepState(creepName: string, state: CreepState): void {
    if (!Memory.creepStates) {
      Memory.creepStates = {};
    }
    Memory.creepStates[creepName] = state;
  }

  /**
   * 删除creep状态
   */
  private deleteCreepState(creepName: string): void {
    if (Memory.creepStates && Memory.creepStates[creepName]) {
      delete Memory.creepStates[creepName];
    }
  }

  public update(): void {
    if (!this.shouldUpdate()) return;

    this.safeExecute(() => {
      this.updateCreepStates();
      this.assessProductionNeeds();
      this.executeProduction();
      this.cleanupDeadCreeps();
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
   * 更新所有Creep的状态
   */
  private updateCreepStates(): void {
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      this.updateCreepState(creep);
    }
  }

  /**
   * 更新单个Creep的状态
   */
  private updateCreepState(creep: Creep): void {
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

    const state: CreepState = {
      name: creep.name,
      phase,
      ticksToLive,
      lifePercent,
      needsReplacement: ticksToLive < GameConfig.THRESHOLDS.CREEP_REPLACEMENT_TIME
    };

    this.setCreepState(creep.name, state);

    // 检查是否需要替换
    if (state.needsReplacement) {
      this.requestCreepReplacement(creep);
    }
  }

  /**
   * 计算Creep效率
   */
  private calculateCreepEfficiency(creep: Creep): number {
    const workParts = creep.body.filter(part => part.type === WORK).length;
    const moveParts = creep.body.filter(part => part.type === MOVE).length;
    const carryParts = creep.body.filter(part => part.type === CARRY).length;

    let efficiency = 1.0;

    // 如果没有移动部件，效率降低
    if (moveParts === 0) efficiency *= GameConfig.THRESHOLDS.EFFICIENCY_PENALTY_NO_MOVE;

    // 根据角色调整效率
    switch (creep.memory.role) {
      case GameConfig.ROLES.HARVESTER:
        efficiency *= workParts > 0 ? 1.0 : GameConfig.THRESHOLDS.EFFICIENCY_PENALTY_NO_TOOL;
        break;
      case GameConfig.ROLES.TRANSPORTER:
        efficiency *= carryParts > 0 ? 1.0 : GameConfig.THRESHOLDS.EFFICIENCY_PENALTY_NO_TOOL;
        break;
      case GameConfig.ROLES.BUILDER:
        efficiency *= workParts > 0 ? 1.0 : GameConfig.THRESHOLDS.EFFICIENCY_PENALTY_NO_TOOL;
        break;
    }

    return efficiency;
  }

  /**
   * 评估生产需求 - 核心生产逻辑
   */
  private assessProductionNeeds(): void {
    // 使用配置的生产检查频率
    if (Game.time - this.lastProductionCheck < GameConfig.UPDATE_FREQUENCIES.CREEP_PRODUCTION) {
      return;
    }

    // 清理重复的生产需求
    this.cleanupDuplicateProductionNeeds();

    // 移除已完成的需求或不再需要的需求
    this.removeCompletedNeeds();

    this.lastProductionCheck = Game.time;

    // 分析每个房间的需求
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        this.analyzeRoomNeeds(room);
      }
    }

    // 按优先级排序
    this.productionQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 分析房间生产需求 - 基于配置的生产逻辑
   */
  private analyzeRoomNeeds(room: Room): void {
    const roomName = room.name;

    // 使用统一的统计方法
    const roleCounts = this.getRoleCountsInRoom(roomName);

    const energyCapacity = GameConfig.getRoomEnergyCapacity(room);
    const availableEnergy = room.energyAvailable;
    const controllerLevel = room.controller?.level || 1;

    // 使用配置系统进行生产决策
    this.handleRoomProductionByConfig(room, roleCounts, availableEnergy, controllerLevel);

    // 通用检查：需要替换的creep - 只检查当前在房间内的creep
    const creepsInRoom = Object.values(Game.creeps).filter(creep => creep.room.name === roomName);
    for (const creep of creepsInRoom) {
      if (creep.ticksToLive && creep.ticksToLive < GameConfig.THRESHOLDS.CREEP_REPLACEMENT_TIME) {
        this.addProductionNeed(roomName, creep.memory.role, GameConfig.PRIORITIES.HIGH, availableEnergy);
      }
    }
  }

  /**
 * 基于配置的房间生产处理
 */
  private handleRoomProductionByConfig(room: Room, roleCounts: { [role: string]: number }, availableEnergy: number, controllerLevel: number): void {
    const roomName = room.name;
    const totalCreeps = this.getCreepCountInRoom(roomName);

    console.log(`[CreepManager] 房间 ${roomName} RCL${controllerLevel} 生产分析:`);
    console.log(`[CreepManager] 当前creep数量:`, roleCounts);
    console.log(`[CreepManager] 总creep数: ${totalCreeps}, 可用能量: ${availableEnergy}`);

    // 特殊处理：开局阶段的生产逻辑
    if (controllerLevel <= 2) {
      console.log(`[CreepManager] 使用开局生产逻辑 (RCL <= 2)`);
      const bootstrapNeed = this.handleBootstrapProduction(room, roleCounts, availableEnergy);
      if (bootstrapNeed) {
        console.log(`[CreepManager] 开局生产需求: ${bootstrapNeed.role} (优先级: ${bootstrapNeed.priority})`);
        this.addProductionNeed(roomName, bootstrapNeed.role, bootstrapNeed.priority, availableEnergy);
        return;
      }
      console.log(`[CreepManager] 开局阶段无生产需求`);
      return;
    }

    // 获取该房间等级的所有角色配置
    const roleConfigs = GameConfig.getRoomRoleConfig(controllerLevel);
    console.log(`[CreepManager] RCL${controllerLevel} 角色配置:`, roleConfigs);

    // 创建生产需求数组，按优先级排序
    const productionNeeds: Array<{ role: string, priority: number, urgency: string }> = [];

    // 遍历所有角色配置
    for (const [role, config] of Object.entries(roleConfigs)) {
      const currentCount = roleCounts[role] || 0;

      console.log(`[CreepManager] 检查角色 ${role}: 当前${currentCount}, 最小${config.min}, 最大${config.max}`);

      // 检查是否需要生产更多creep
      if (GameConfig.needsMoreCreeps(controllerLevel, role, currentCount)) {
        // 必须生产的creep（低于最小值）
        console.log(`[CreepManager] ${role} 低于最小值，添加关键生产需求`);
        productionNeeds.push({
          role,
          priority: GameConfig.PRIORITIES.CRITICAL,
          urgency: 'critical'
        });
      } else if (GameConfig.canProduceMoreCreeps(controllerLevel, role, currentCount, totalCreeps)) {
        // 可以生产的creep（低于最大值但高于最小值）
        // 需要检查特殊条件
        if (this.shouldProduceRole(room, role, currentCount, availableEnergy)) {
          const basePriority = GameConfig.getRolePriority(controllerLevel, role);
          console.log(`[CreepManager] ${role} 可以生产更多，添加普通生产需求 (优先级: ${basePriority})`);
          productionNeeds.push({
            role,
            priority: basePriority,
            urgency: 'normal'
          });
        } else {
          console.log(`[CreepManager] ${role} 不满足特殊生产条件`);
        }
      } else {
        console.log(`[CreepManager] ${role} 已达到最大值或总creep数超限`);
      }
    }

    // 按优先级排序生产需求
    productionNeeds.sort((a, b) => b.priority - a.priority);

    console.log(`[CreepManager] 生产需求队列:`, productionNeeds);

    // 处理最高优先级的需求
    if (productionNeeds.length > 0) {
      const need = productionNeeds[0];
      console.log(`[CreepManager] 选择生产: ${need.role} (优先级: ${need.priority})`);
      this.addProductionNeed(roomName, need.role, need.priority, availableEnergy);
    } else {
      console.log(`[CreepManager] 没有生产需求`);
    }
  }

  /**
 * 处理开局阶段的生产逻辑
 */
  private handleBootstrapProduction(room: Room, roleCounts: { [role: string]: number }, availableEnergy: number): { role: string, priority: number } | null {
    // 开局生产顺序：HARVESTER -> TRANSPORTER -> BUILDER（如果需要）-> 第二个HARVESTER
    const controllerLevel = room.controller?.level || 1;
    const totalCreeps = this.getCreepCountInRoom(room.name);

    console.log(`[Bootstrap] RCL${controllerLevel} 房间 ${room.name} 当前creep数量:`, roleCounts);

    // 优先级1: 确保至少有一个采集者
    const harvesterCount = roleCounts[GameConfig.ROLES.HARVESTER] || 0;
    if (harvesterCount === 0) {
      if (GameConfig.canProduceMoreCreeps(controllerLevel, GameConfig.ROLES.HARVESTER, harvesterCount, totalCreeps)) {
        console.log(`[Bootstrap] 生产关键harvester (${harvesterCount}/max)`);
        return {
          role: GameConfig.ROLES.HARVESTER,
          priority: GameConfig.PRIORITIES.CRITICAL
        };
      }
    }

    // 优先级2: 如果有采集者但没有运输者，且能量充足
    const transporterCount = roleCounts[GameConfig.ROLES.TRANSPORTER] || 0;
    if (harvesterCount > 0 &&
      transporterCount === 0 &&
      availableEnergy >= GameConfig.THRESHOLDS.MIN_ENERGY_FOR_TRANSPORT) {

      if (GameConfig.canProduceMoreCreeps(controllerLevel, GameConfig.ROLES.TRANSPORTER, transporterCount, totalCreeps)) {
        console.log(`[Bootstrap] 生产transporter (${transporterCount}/max)`);
        return {
          role: GameConfig.ROLES.TRANSPORTER,
          priority: GameConfig.PRIORITIES.HIGH
        };
      }
    }

    // 优先级3: 如果有建造或修复需求，添加建造者
    const builderCount = roleCounts[GameConfig.ROLES.BUILDER] || 0;
    if (this.needsBuilder(room) &&
      builderCount === 0 &&
      availableEnergy >= GameConfig.THRESHOLDS.MIN_ENERGY_FOR_BUILDER) {

      if (GameConfig.canProduceMoreCreeps(controllerLevel, GameConfig.ROLES.BUILDER, builderCount, totalCreeps)) {
        console.log(`[Bootstrap] 生产builder (${builderCount}/max)`);
        return {
          role: GameConfig.ROLES.BUILDER,
          priority: GameConfig.PRIORITIES.MEDIUM
        };
      }
    }

    // 优先级4: 增加第二个采集者（如果能量充足且配置允许）
    if (harvesterCount === 1 &&
      availableEnergy >= GameConfig.THRESHOLDS.MIN_ENERGY_FOR_SECOND_HARVESTER) {

      if (GameConfig.canProduceMoreCreeps(controllerLevel, GameConfig.ROLES.HARVESTER, harvesterCount, totalCreeps)) {
        console.log(`[Bootstrap] 生产第二个harvester (${harvesterCount}/max)`);
        return {
          role: GameConfig.ROLES.HARVESTER,
          priority: GameConfig.PRIORITIES.MEDIUM
        };
      }
    }

    // 优先级5: 如果基础设施完善，考虑升级工
    const upgraderCount = roleCounts[GameConfig.ROLES.UPGRADER] || 0;
    if (harvesterCount > 0 && transporterCount > 0 && upgraderCount === 0 &&
      availableEnergy >= GameConfig.THRESHOLDS.MIN_ENERGY_FOR_UPGRADER) {

      if (GameConfig.canProduceMoreCreeps(controllerLevel, GameConfig.ROLES.UPGRADER, upgraderCount, totalCreeps)) {
        console.log(`[Bootstrap] 生产upgrader (${upgraderCount}/max)`);
        return {
          role: GameConfig.ROLES.UPGRADER,
          priority: GameConfig.PRIORITIES.MEDIUM
        };
      }
    }

    console.log(`[Bootstrap] 没有需要生产的creep或已达到限制`);
    return null;
  }

  /**
   * 检查是否应该生产指定角色的creep
   */
  private shouldProduceRole(room: Room, role: string, currentCount: number, availableEnergy: number): boolean {
    // 检查能量门槛
    if (!this.hasEnoughEnergyForRole(role, availableEnergy)) {
      console.log(`[shouldProduceRole] ${role} 能量不足: ${availableEnergy}`);
      return false;
    }

    // 特殊角色条件检查
    switch (role) {
      case GameConfig.ROLES.TRANSPORTER:
        // 有采集者时才生产运输者
        const hasHarvester = this.hasRole(room, GameConfig.ROLES.HARVESTER);
        console.log(`[shouldProduceRole] transporter 检查: 有harvester=${hasHarvester}`);
        return hasHarvester;

      case GameConfig.ROLES.BUILDER:
        // 有建造或修复需求时才生产建造者
        const needsBuilder = this.needsBuilder(room);
        console.log(`[shouldProduceRole] builder 检查: 需要builder=${needsBuilder}`);
        return needsBuilder;

      case GameConfig.ROLES.UPGRADER:
        // 有基础设施时才生产升级者
        const hasBasicInfra = this.hasRole(room, GameConfig.ROLES.HARVESTER) && this.hasRole(room, GameConfig.ROLES.TRANSPORTER);
        console.log(`[shouldProduceRole] upgrader 检查: 有基础设施=${hasBasicInfra}`);
        return hasBasicInfra;

      case GameConfig.ROLES.DEFENDER:
        // 有敌人威胁时才生产防御者
        const hasEnemyThreat = this.roomManager ?
          this.roomManager.hasEnemyThreat(room.name) :
          this.hasEnemyThreatFallback(room);
        console.log(`[shouldProduceRole] defender 检查: 有敌人威胁=${hasEnemyThreat}`);
        return hasEnemyThreat;

      default:
        console.log(`[shouldProduceRole] ${role} 无特殊条件`);
        return true;
    }
  }

  /**
   * 检查房间是否有指定角色的creep
   */
  private hasRole(room: Room, role: string): boolean {
    return Object.values(Game.creeps).some(creep =>
      creep.room.name === room.name && creep.memory.role === role
    );
  }

  /**
   * 检查是否有足够能量生产指定角色
   */
  private hasEnoughEnergyForRole(role: string, availableEnergy: number): boolean {
    switch (role) {
      case GameConfig.ROLES.TRANSPORTER:
        return availableEnergy >= GameConfig.THRESHOLDS.MIN_ENERGY_FOR_TRANSPORT;
      case GameConfig.ROLES.BUILDER:
        return availableEnergy >= GameConfig.THRESHOLDS.MIN_ENERGY_FOR_BUILDER;
      case GameConfig.ROLES.UPGRADER:
        return availableEnergy >= GameConfig.THRESHOLDS.MIN_ENERGY_FOR_UPGRADER;
      case GameConfig.ROLES.DEFENDER:
        return availableEnergy >= GameConfig.THRESHOLDS.MIN_ENERGY_FOR_DEFENDER;
      default:
        return true;
    }
  }

  /**
 * 检查房间是否需要建筑工
 */
  private needsBuilder(room: Room): boolean {
    // 检查是否有可由建筑工处理的建筑工地
    const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
      filter: (site) => !this.isEngineerOnlyStructure(site.structureType)
    });
    if (constructionSites.length > 0) {
      return true;
    }

    // 检查是否有需要修复的建筑（排除工程师专用结构）
    const repairTargets = room.find(FIND_STRUCTURES, {
      filter: (s) => s.hits < s.hitsMax * GameConfig.THRESHOLDS.REPAIR_THRESHOLD && !this.isEngineerOnlyStructure(s.structureType)
    });

    return repairTargets.length > 0;
  }

  /**
   * 检查是否是工程师专用结构（建筑工不应该建造或修复）
   */
  private isEngineerOnlyStructure(structureType: StructureConstant): boolean {
    return GameConfig.isMilitaryStructure(structureType);
  }

  /**
   * 添加生产需求
   */
  private addProductionNeed(roomName: string, role: string, priority: number, availableEnergy: number): void {
    // 检查是否已存在相同的生产需求
    const existingNeed = this.productionQueue.find(need =>
      need.roomName === roomName && need.role === role
    );

    if (existingNeed) {
      console.log(`[addProductionNeed] 房间 ${roomName} 角色 ${role} 的生产需求已存在，跳过添加`);
      return;
    }

    const need: ProductionNeed = {
      roomName,
      role,
      priority,
      urgency: priority >= GameConfig.PRIORITIES.CRITICAL ? 'critical' : 'normal',
      energyBudget: availableEnergy,
      timestamp: Game.time
    };

    this.productionQueue.push(need);
    console.log(`[addProductionNeed] 添加生产需求: ${role} (房间: ${roomName}, 优先级: ${priority})`);
  }

  /**
   * 执行生产
   */
  private executeProduction(): void {
    if (this.productionQueue.length === 0) {
      return;
    }

    console.log(`[executeProduction] 生产队列长度: ${this.productionQueue.length}`);

    // 处理队列中的第一个需求
    const need = this.productionQueue[0];
    const room = Game.rooms[need.roomName];

    console.log(`[executeProduction] 处理生产需求: ${need.role} (房间: ${need.roomName}, 优先级: ${need.priority})`);

    if (!room) {
      console.log(`[executeProduction] 房间不存在: ${need.roomName}`);
      this.productionQueue.shift();
      return;
    }

    // 最终数量检查 - 确保不超过限制
    const controllerLevel = room.controller?.level || 1;
    const currentRoleCount = this.getCreepCountInRoom(need.roomName, need.role);
    const totalCreepsInRoom = this.getCreepCountInRoom(need.roomName);

    // 检查是否仍然需要生产这个角色
    if (!GameConfig.canProduceMoreCreeps(controllerLevel, need.role, currentRoleCount, totalCreepsInRoom)) {
      console.log(`[executeProduction] 角色 ${need.role} 已达到限制，跳过生产 (当前: ${currentRoleCount}, 总数: ${totalCreepsInRoom})`);
      this.productionQueue.shift();
      return;
    }

    const spawns = room.find(FIND_MY_SPAWNS);
    if (spawns.length === 0) {
      console.log(`[executeProduction] 房间 ${need.roomName} 没有spawn`);
      return;
    }

    const spawn = spawns[0];

    if (spawn.spawning) {
      console.log(`[executeProduction] spawn正在生产: ${spawn.spawning.name}`);
      return;
    }

    // 生成身体配置
    const body = BodyBuilder.generateOptimalBody(
      need.role,
      need.energyBudget || GameConfig.THRESHOLDS.MIN_ENERGY_FOR_UPGRADER,
      GameConfig.THRESHOLDS.MAX_CREEP_BODY_SIZE
    );

    const cost = BodyBuilder.getBodyCost(body);
    console.log(`[executeProduction] 生成身体配置: ${JSON.stringify(body)}, 成本: ${cost}`);

    // 检查是否有足够能量
    if (room.energyAvailable < cost) {
      console.log(`[executeProduction] 能量不足: 需要${cost}, 当前${room.energyAvailable}`);
      return;
    }

    // 生成creep名称
    const creepName = this.generateCreepName(need.role);

    console.log(`[executeProduction] 开始生产: ${creepName} (${need.role})`);

    // 尝试生产creep
    const result = spawn.spawnCreep(body, creepName, {
      memory: { role: need.role, state: 'idle', room: need.roomName, working: false }
    });

    if (result === OK) {
      console.log(`[executeProduction] 成功生产: ${creepName}`);
      this.productionQueue.shift();

      // 发送事件
      this.emit(GameConfig.EVENTS.CREEP_SPAWNED, {
        creepName,
        role: need.role,
        roomName: need.roomName,
        cost
      });
    } else {
      console.log(`[executeProduction] 生产失败: ${creepName}, 错误: ${result}`);
      // 生产失败时不移除队列项，下次再试
    }
  }

  /**
   * 生成creep名称
   */
  private generateCreepName(role: string): string {
    return `${role}_${Game.time}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 请求Creep替换
   */
  private requestCreepReplacement(creep: Creep): void {
    const room = creep.room;
    const controllerLevel = room.controller?.level || 1;
    const currentRoleCount = this.getCreepCountInRoom(room.name, creep.memory.role);
    const totalCreepsInRoom = this.getCreepCountInRoom(room.name);

    // 检查是否仍然需要这个角色（考虑即将死亡的creep）
    if (!GameConfig.canProduceMoreCreeps(controllerLevel, creep.memory.role, currentRoleCount - 1, totalCreepsInRoom)) {
      console.log(`[requestCreepReplacement] 角色 ${creep.memory.role} 已达到限制，不需要替换`);
      return;
    }

    const availableEnergy = room.energyAvailable;
    this.addProductionNeed(
      room.name,
      creep.memory.role,
      GameConfig.PRIORITIES.HIGH,
      availableEnergy
    );
  }

  /**
   * 处理Creep死亡
   */
  private handleCreepDeath(data: any): void {
    console.log(`Creep死亡: ${data.name}, 角色: ${data.role}`);

    this.deleteCreepState(data.name);

    // 只有关键角色死亡才立即请求替换
    if (data.role === GameConfig.ROLES.HARVESTER) {
      const room = Game.rooms[data.room];
      if (room) {
        const controllerLevel = room.controller?.level || 1;
        const currentRoleCount = this.getCreepCountInRoom(data.room, data.role);
        const totalCreepsInRoom = this.getCreepCountInRoom(data.room);

        // 检查是否仍然需要这个角色
        if (GameConfig.canProduceMoreCreeps(controllerLevel, data.role, currentRoleCount, totalCreepsInRoom)) {
          this.addProductionNeed(
            room.name,
            data.role,
            GameConfig.PRIORITIES.CRITICAL,
            room.energyAvailable
          );
        } else {
          console.log(`[handleCreepDeath] 角色 ${data.role} 已达到限制，不需要替换`);
        }
      }
    }
  }

  /**
   * 处理房间能量变化
   */
  private handleRoomEnergyChanged(data: any): void {
    // 能量变化可能影响生产决策
  }

  /**
   * 清理死亡Creep
   */
  private cleanupDeadCreeps(): void {
    for (const [name, state] of Object.entries(this.creepStates)) {
      if (!(name in Game.creeps)) {
        this.deleteCreepState(name);
      }
    }
  }

  /**
   * 获取Creep统计信息
   */
  public getCreepStats(): any {
    const stats: any = {
      totalCreeps: Object.keys(Game.creeps).length,
      roleCounts: {},
      productionQueue: this.productionQueue.length,
      averageEfficiency: 0
    };

    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      const role = creep.memory.role;
      stats.roleCounts[role] = (stats.roleCounts[role] || 0) + 1;
    }

    let totalEfficiency = 0;
    let creepCount = 0;
    for (const [name, state] of Object.entries(this.creepStates)) {
      if (state && Game.creeps[name]) {
        // 重新计算效率，因为CreepState中没有efficiency字段
        const creep = Game.creeps[name];
        const efficiency = this.calculateCreepEfficiency(creep);
        totalEfficiency += efficiency;
        creepCount++;
      }
    }
    stats.averageEfficiency = creepCount > 0 ? totalEfficiency / creepCount : 0;

    return stats;
  }

  /**
   * 获取生产队列（从Memory中获取）
   */
  private get productionQueue(): ProductionNeed[] {
    if (!Memory.creepProduction) {
      Memory.creepProduction = {
        queue: [],
        lastProduction: Game.time,
        energyBudget: 0
      };
    }
    return Memory.creepProduction.queue;
  }

  /**
   * 设置生产队列（保存到Memory中）
   */
  private set productionQueue(queue: ProductionNeed[]) {
    if (!Memory.creepProduction) {
      Memory.creepProduction = {
        queue: [],
        lastProduction: Game.time,
        energyBudget: 0
      };
    }
    Memory.creepProduction.queue = queue;
  }

  /**
   * 获取生产队列（公共接口）
   */
  public getProductionQueue(): ProductionNeed[] {
    return [...this.productionQueue];
  }

  /**
   * 重置时的清理工作
   */
  protected onReset(): void {
    this.productionQueue = [];
    Memory.creepStates = {};
    this.lastProductionCheck = 0;
  }

  /**
   * 清理重复的生产需求
   */
  private cleanupDuplicateProductionNeeds(): void {
    const uniqueNeeds = new Map<string, ProductionNeed>();

    // 遍历生产队列，保留每个房间-角色组合的第一个需求
    for (const need of this.productionQueue) {
      const key = `${need.roomName}-${need.role}`;

      if (!uniqueNeeds.has(key)) {
        uniqueNeeds.set(key, need);
      } else {
        // 如果已存在相同的需求，比较优先级，保留优先级更高的
        const existingNeed = uniqueNeeds.get(key)!;
        if (need.priority > existingNeed.priority) {
          uniqueNeeds.set(key, need);
        }
      }
    }

    const originalLength = this.productionQueue.length;
    this.productionQueue = Array.from(uniqueNeeds.values());

    if (originalLength > this.productionQueue.length) {
      console.log(`[cleanupDuplicateProductionNeeds] 清理重复需求: ${originalLength} -> ${this.productionQueue.length}`);
    }
  }

  /**
   * 移除已完成的需求或不再需要的需求
   */
  private removeCompletedNeeds(): void {
    const originalLength = this.productionQueue.length;

    this.productionQueue = this.productionQueue.filter(need => {
      const room = Game.rooms[need.roomName];
      if (!room || !room.controller?.my) {
        // 房间不存在或不再属于我们，移除需求
        return false;
      }

      // 检查是否仍然需要这个角色
      const controllerLevel = room.controller.level || 1;
      const currentRoleCount = this.getCreepCountInRoom(need.roomName, need.role);
      const totalCreepsInRoom = this.getCreepCountInRoom(need.roomName);

      // 如果已经达到最大值，移除需求
      if (!GameConfig.canProduceMoreCreeps(controllerLevel, need.role, currentRoleCount, totalCreepsInRoom)) {
        return false;
      }

      // 检查需求是否过期（超过100 ticks）
      if (need.timestamp && Game.time - need.timestamp > 100) {
        return false;
      }

      return true;
    });

    if (originalLength > this.productionQueue.length) {
      console.log(`[removeCompletedNeeds] 清理需求: ${originalLength} -> ${this.productionQueue.length}`);
    }
  }

  /**
   * 获取房间内指定角色的creep数量（统一的统计方法）
   */
  private getCreepCountInRoom(roomName: string, role?: string): number {
    return Object.values(Game.creeps).filter(creep => {
      // 检查creep是否属于这个房间（优先使用memory.room，回退到当前位置）
      const creepRoom = creep.memory.room || creep.room.name;
      if (creepRoom !== roomName) {
        return false;
      }

      // 如果指定了角色，检查角色匹配
      if (role && creep.memory.role !== role) {
        return false;
      }

      return true;
    }).length;
  }

  /**
   * 获取房间内所有角色的数量统计
   */
  private getRoleCountsInRoom(roomName: string): { [role: string]: number } {
    const roleCounts: { [role: string]: number } = {};

    Object.values(Game.creeps).forEach(creep => {
      // 检查creep是否属于这个房间
      const creepRoom = creep.memory.room || creep.room.name;
      if (creepRoom === roomName) {
        const role = creep.memory.role;
        roleCounts[role] = (roleCounts[role] || 0) + 1;
      }
    });

    return roleCounts;
  }

  /**
   * 检查房间是否有敌人威胁 (备用方法，当RoomManager不可用时使用)
   */
  private hasEnemyThreatFallback(room: Room): boolean {
    // 检查是否有敌对creep
    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    if (hostileCreeps.length > 0) {
      console.log(`[hasEnemyThreatFallback] 房间 ${room.name} 发现 ${hostileCreeps.length} 个敌对creep`);
      return true;
    }

    // 检查是否有敌对建筑
    const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
    if (hostileStructures.length > 0) {
      console.log(`[hasEnemyThreatFallback] 房间 ${room.name} 发现 ${hostileStructures.length} 个敌对建筑`);
      return true;
    }

    // 检查最近是否有敌人活动的记录
    if (room.memory.lastEnemyActivity &&
        Game.time - room.memory.lastEnemyActivity < GameConfig.THRESHOLDS.ENEMY_MEMORY_DURATION) {
      console.log(`[hasEnemyThreatFallback] 房间 ${room.name} 最近有敌人活动记录`);
      return true;
    }

    return false;
  }

  /**
   * 处理房间受到攻击
   */
  private handleRoomUnderAttack(data: any): void {
    const { roomName, hostileCount, hostiles } = data;
    console.log(`🛡️ [CreepManager] 房间 ${roomName} 受到攻击! 敌对单位: ${hostileCount}个`);

    const room = Game.rooms[roomName];
    if (!room || !room.controller?.my) {
      return;
    }

    // 记录威胁到房间内存
    if (!room.memory.lastEnemyActivity) {
      room.memory.lastEnemyActivity = Game.time;
    }
    room.memory.lastEnemyActivity = Game.time;

    // 检查当前defender数量
    const controllerLevel = room.controller.level || 1;
    const currentDefenderCount = this.getCreepCountInRoom(roomName, GameConfig.ROLES.DEFENDER);
    const totalCreepsInRoom = this.getCreepCountInRoom(roomName);

    console.log(`🛡️ [CreepManager] 房间 ${roomName} 当前defender数量: ${currentDefenderCount}`);

    // 检查是否可以生产更多defender
    if (GameConfig.canProduceMoreCreeps(controllerLevel, GameConfig.ROLES.DEFENDER, currentDefenderCount, totalCreepsInRoom)) {
      // 检查能量是否足够
      if (room.energyAvailable >= GameConfig.THRESHOLDS.MIN_ENERGY_FOR_DEFENDER) {
        console.log(`🛡️ [CreepManager] 立即安排defender生产 (紧急优先级)`);
        this.addProductionNeed(
          roomName,
          GameConfig.ROLES.DEFENDER,
          GameConfig.PRIORITIES.CRITICAL,  // 使用最高优先级
          room.energyAvailable
        );
      } else {
        console.log(`🛡️ [CreepManager] 需要defender但能量不足: ${room.energyAvailable}/${GameConfig.THRESHOLDS.MIN_ENERGY_FOR_DEFENDER}`);
        // 仍然添加生产需求，但优先级稍低，等待能量积累
        this.addProductionNeed(
          roomName,
          GameConfig.ROLES.DEFENDER,
          GameConfig.PRIORITIES.HIGH,
          room.energyAvailable
        );
      }
    } else {
      console.log(`🛡️ [CreepManager] 房间 ${roomName} defender已达上限或总creep数超限`);
    }

    // 发出敌人威胁警报给其他系统
    this.emit('room.threat.detected', {
      roomName,
      threatLevel: this.calculateThreatLevel(hostiles),
      hostileCount,
      currentDefenders: currentDefenderCount,
      actionTaken: currentDefenderCount < (GameConfig.getRoleLimits(controllerLevel, GameConfig.ROLES.DEFENDER)?.max || 0)
    });
  }

  /**
   * 计算威胁等级
   */
  private calculateThreatLevel(hostiles: any[]): 'low' | 'medium' | 'high' | 'critical' {
    if (!hostiles || hostiles.length === 0) return 'low';

    let threatScore = 0;
    for (const hostile of hostiles) {
      // 根据敌人身体部件计算威胁分数
      if (hostile.body) {
        threatScore += hostile.body.filter((part: any) => part.type === ATTACK).length * 10;
        threatScore += hostile.body.filter((part: any) => part.type === RANGED_ATTACK).length * 8;
        threatScore += hostile.body.filter((part: any) => part.type === WORK).length * 5;
        threatScore += hostile.body.filter((part: any) => part.type === HEAL).length * 6;
      }
    }

    if (threatScore >= 50) return 'critical';
    if (threatScore >= 30) return 'high';
    if (threatScore >= 10) return 'medium';
    return 'low';
  }
}
