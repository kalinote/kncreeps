/**
 * 游戏配置常量
 */
export class GameConfig {
  // 角色类型
  public static readonly ROLES = {
    HARVESTER: 'harvester',       // 矿工，用于采集资源
    TRANSPORTER: 'transporter',   // 搬运工，用于搬运资源
    BUILDER: 'builder',           // 建筑工，用于建造建筑
    UPGRADER: 'upgrader',         // 升级工，用于升级建筑
    ENGINEER: 'engineer',         // 工程师，用于建造军事设施
    DEFENDER: 'defender',         // 防御者，用于房间内的防御
  } as const;

  // 优先级
  public static readonly PRIORITIES = {
    CRITICAL: 10,
    HIGH: 8,
    MEDIUM: 5,
    LOW: 2,
    MINIMAL: 1
  } as const;

  // 阈值配置
  public static readonly THRESHOLDS = {
    ENERGY_RESERVE: 200,
    CREEP_REPLACEMENT_THRESHOLD: 0.3,
    ROOM_EXPANSION_THRESHOLD: 0.8,
    MAX_CREEP_BODY_SIZE: 50,
    MIN_CREEP_BODY_SIZE: 3,
    EMERGENCY_ENERGY_LEVEL: 100,

    // 修复阈值
    REPAIR_THRESHOLD: 0.8, // 建筑物血量低于80%时需要修复
    EMERGENCY_REPAIR_THRESHOLD: 0.5, // 紧急修复阈值

    // 能量门槛
    MIN_ENERGY_FOR_TRANSPORT: 100,
    MIN_ENERGY_FOR_BUILDER: 250,
    MIN_ENERGY_FOR_UPGRADER: 200,
    MIN_ENERGY_FOR_SECOND_HARVESTER: 300,
    MIN_ENERGY_FOR_DEFENDER: 300, // 防御者最小能量需求

    // 替换时间门槛
    CREEP_REPLACEMENT_TIME: 300, // creep剩余生命值低于300时需要替换

    // 效率和模式切换阈值
    EFFICIENCY_PENALTY_NO_MOVE: 0.5,
    EFFICIENCY_PENALTY_NO_TOOL: 0.3,
    HARVESTER_PROFESSIONAL_MODE_THRESHOLD: 1, // 搬运工数量达到1时切换专业模式

    // 防御相关阈值
    DEFENDER_PATROL_RANGE: 5, // 防御者巡逻范围
    DEFENDER_ENGAGEMENT_RANGE: 3, // 防御者交战范围
    DEFENDER_RETREAT_HEALTH: 0.3, // 防御者撤退血量比例
    ENEMY_MEMORY_DURATION: 50, // 敌人记忆持续时间（ticks）

    // 预算配置
    BODY_BUDGET_RATIO: 0.8, // 身体预算占房间总能量的比例

    // Spawn能量保留配置（按RCL等级）
    SPAWN_ENERGY_RESERVE_BY_RCL: {
      1: 200,  // RCL1: 保留200能量（可生成基础harvester和transporter）
      2: 250,  // RCL2: 保留250能量
      3: 300,  // RCL3: 保留300能量
      4: 350,  // RCL4: 保留350能量
      5: 400,  // RCL5: 保留400能量
      6: 450,  // RCL6: 保留450能量
      7: 500,  // RCL7: 保留500能量
      8: 550   // RCL8: 保留550能量
    },

    // 紧急情况下的最小保留能量
    SPAWN_EMERGENCY_RESERVE: 150,

    // 当房间没有基础creep时的严格保留
    SPAWN_CRITICAL_RESERVE: 100,
  } as const;

  // 更新频率（ticks）
  public static readonly UPDATE_FREQUENCIES = {
    CREEP_PRODUCTION: 5,
    ROOM_ANALYSIS: 10,
    INTELLIGENCE_GATHERING: 20,
    LONG_TERM_PLANNING: 100,
    CLEANUP: 50
  } as const;

  // 身体部件成本
  public static readonly BODY_PART_COSTS = {
    [WORK]: 100,
    [CARRY]: 50,
    [MOVE]: 50,
    [ATTACK]: 80,
    [RANGED_ATTACK]: 150,
    [HEAL]: 250,
    [CLAIM]: 600,
    [TOUGH]: 10
  } as const;

  // 能量容量配置
  public static readonly ENERGY_CAPACITY = {
    SPAWN: 300,
    EXTENSION: 50,
    MAX_ROOM_ENERGY: 12900 // RCL 8的最大能量
  } as const;

  // 系统配置
  public static readonly SYSTEM = {
    CREEP_LIFETIME: 1500,
    ERROR_RECOVERY_ATTEMPTS: 3,
    MAX_CONSTRUCTION_SITES: 5,
    MAX_REPAIR_TARGETS: 3
  } as const;

  // 房间发展阶段
  public static readonly ROOM_PHASES = {
    BOOTSTRAP: 'bootstrap',
    GROWTH: 'growth',
    MATURE: 'mature',
    EXPANSION: 'expansion'
  } as const;

  // 事件类型
  public static readonly EVENTS = {
    CREEP_SPAWNED: 'creep.spawned',
    CREEP_DIED: 'creep.died',
    CREEP_TASK_ASSIGNED: 'creep.task.assigned',
    CREEP_TASK_COMPLETED: 'creep.task.completed',
    ROOM_ENERGY_CHANGED: 'room.energy.changed',
    ROOM_UNDER_ATTACK: 'room.under.attack',
    CONSTRUCTION_COMPLETED: 'construction.completed',
    RESOURCE_DEPLETED: 'resource.depleted',
    // 防御相关事件
    ENEMY_SPOTTED: 'enemy.spotted',
    COMBAT_STARTED: 'combat.started',
    COMBAT_ENDED: 'combat.ended',
    DEFENDER_ENGAGED: 'defender.engaged',
    DEFENDER_RETREATING: 'defender.retreating'
  } as const;

  // 角色权限配置
  public static readonly ROLE_PERMISSIONS = {
    // 允许捡拾地面掉落资源的角色
    CAN_PICKUP_DROPPED_RESOURCES: [
      GameConfig.ROLES.TRANSPORTER,
      GameConfig.ROLES.HARVESTER  // 采集者在必要时也可以捡拾（如专业模式下）
    ],

    // 只能从存储建筑获取资源的角色
    STORAGE_ONLY_ROLES: [
      GameConfig.ROLES.BUILDER,
      GameConfig.ROLES.UPGRADER,
      GameConfig.ROLES.ENGINEER
    ]
  } as const;

  // 角色数量配置
  public static readonly ROLE_LIMITS = {
    // 全局限制配置
    GLOBAL: {
      MAX_CREEPS_PER_ROOM: 20,
      MIN_ENERGY_RESERVE: 100
    },

    // 按房间控制器等级的角色数量限制
    //
    BY_RCL: {
      1: {
        [GameConfig.ROLES.HARVESTER]: { min: 1, max: 3, priority: GameConfig.PRIORITIES.HIGH },
        [GameConfig.ROLES.TRANSPORTER]: { min: 0, max: 2, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.BUILDER]: { min: 0, max: 2, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.UPGRADER]: { min: 0, max: 1, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.DEFENDER]: { min: 0, max: 1, priority: GameConfig.PRIORITIES.MINIMAL }
      },
      2: {
        [GameConfig.ROLES.HARVESTER]: { min: 1, max: 3, priority: GameConfig.PRIORITIES.HIGH },
        [GameConfig.ROLES.TRANSPORTER]: { min: 0, max: 2, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.BUILDER]: { min: 0, max: 2, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.UPGRADER]: { min: 0, max: 1, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.DEFENDER]: { min: 0, max: 1, priority: GameConfig.PRIORITIES.MINIMAL }
      },
      3: {
        [GameConfig.ROLES.HARVESTER]: { min: 1, max: 2, priority: GameConfig.PRIORITIES.HIGH },
        [GameConfig.ROLES.TRANSPORTER]: { min: 1, max: 2, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.BUILDER]: { min: 0, max: 1, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.UPGRADER]: { min: 1, max: 1, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.DEFENDER]: { min: 0, max: 1, priority: GameConfig.PRIORITIES.MINIMAL }
      },
      4: {
        [GameConfig.ROLES.HARVESTER]: { min: 1, max: 3, priority: GameConfig.PRIORITIES.HIGH },
        [GameConfig.ROLES.TRANSPORTER]: { min: 1, max: 2, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.BUILDER]: { min: 0, max: 1, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.UPGRADER]: { min: 1, max: 1, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.DEFENDER]: { min: 0, max: 1, priority: GameConfig.PRIORITIES.MINIMAL }
      },
      5: {
        [GameConfig.ROLES.HARVESTER]: { min: 2, max: 3, priority: GameConfig.PRIORITIES.HIGH },
        [GameConfig.ROLES.TRANSPORTER]: { min: 2, max: 3, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.BUILDER]: { min: 0, max: 2, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.UPGRADER]: { min: 1, max: 2, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.ENGINEER]: { min: 0, max: 1, priority: GameConfig.PRIORITIES.MINIMAL },
        [GameConfig.ROLES.DEFENDER]: { min: 0, max: 1, priority: GameConfig.PRIORITIES.MINIMAL }
      },
      6: {
        [GameConfig.ROLES.HARVESTER]: { min: 2, max: 4, priority: GameConfig.PRIORITIES.HIGH },
        [GameConfig.ROLES.TRANSPORTER]: { min: 2, max: 4, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.BUILDER]: { min: 0, max: 2, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.UPGRADER]: { min: 1, max: 3, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.ENGINEER]: { min: 0, max: 2, priority: GameConfig.PRIORITIES.MINIMAL },
        [GameConfig.ROLES.DEFENDER]: { min: 0, max: 1, priority: GameConfig.PRIORITIES.MINIMAL }
      },
      7: {
        [GameConfig.ROLES.HARVESTER]: { min: 2, max: 4, priority: GameConfig.PRIORITIES.HIGH },
        [GameConfig.ROLES.TRANSPORTER]: { min: 3, max: 5, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.BUILDER]: { min: 0, max: 3, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.UPGRADER]: { min: 2, max: 4, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.ENGINEER]: { min: 1, max: 2, priority: GameConfig.PRIORITIES.MINIMAL },
        [GameConfig.ROLES.DEFENDER]: { min: 0, max: 1, priority: GameConfig.PRIORITIES.MINIMAL }
      },
      8: {
        [GameConfig.ROLES.HARVESTER]: { min: 2, max: 5, priority: GameConfig.PRIORITIES.HIGH },
        [GameConfig.ROLES.TRANSPORTER]: { min: 3, max: 6, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.BUILDER]: { min: 0, max: 3, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.UPGRADER]: { min: 2, max: 5, priority: GameConfig.PRIORITIES.MEDIUM },
        [GameConfig.ROLES.ENGINEER]: { min: 1, max: 3, priority: GameConfig.PRIORITIES.MINIMAL },
        [GameConfig.ROLES.DEFENDER]: { min: 0, max: 1, priority: GameConfig.PRIORITIES.MINIMAL }
      }
    }
  } as const;

  // 获取身体部件总成本
  public static getBodyCost(body: BodyPartConstant[]): number {
    return body.reduce((cost, part) => cost + GameConfig.BODY_PART_COSTS[part], 0);
  }

  // 验证身体配置是否有效
  public static isValidBody(body: BodyPartConstant[]): boolean {
    return body.length > 0 &&
      body.length <= GameConfig.THRESHOLDS.MAX_CREEP_BODY_SIZE &&
      body.includes(MOVE); // 至少需要一个移动部件
  }

  // 结构分类配置
  public static readonly STRUCTURE_CATEGORIES = {
    // 军事设施 - 由工程师负责
    MILITARY_STRUCTURES: [
      STRUCTURE_WALL,
      STRUCTURE_RAMPART,
      STRUCTURE_TOWER,
      STRUCTURE_NUKER
    ],

    // 基础设施 - 由建筑工负责
    BASIC_STRUCTURES: [
      STRUCTURE_SPAWN,
      STRUCTURE_EXTENSION,
      STRUCTURE_CONTAINER,
      STRUCTURE_STORAGE,
      STRUCTURE_ROAD,
      STRUCTURE_LINK,
      STRUCTURE_EXTRACTOR,
      STRUCTURE_LAB,
      STRUCTURE_TERMINAL,
      STRUCTURE_OBSERVER,
      STRUCTURE_POWER_SPAWN,
      STRUCTURE_FACTORY
    ]
  };

  /**
   * 检查是否是军事设施（由工程师负责）
   */
  public static isMilitaryStructure(structureType: StructureConstant): boolean {
    return structureType === STRUCTURE_WALL ||
      structureType === STRUCTURE_RAMPART ||
      structureType === STRUCTURE_TOWER ||
      structureType === STRUCTURE_NUKER;
  }

  /**
   * 检查是否是基础设施（由建筑工负责）
   */
  public static isBasicStructure(structureType: StructureConstant): boolean {
    return !GameConfig.isMilitaryStructure(structureType);
  }

  /**
   * 检查建筑工是否负责该结构
   */
  public static isBuilderResponsible(structureType: StructureConstant): boolean {
    return GameConfig.isBasicStructure(structureType);
  }

  /**
   * 检查工程师是否负责该结构
   */
  public static isEngineerResponsible(structureType: StructureConstant): boolean {
    return GameConfig.isMilitaryStructure(structureType);
  }

  /**
   * 获取结构的负责角色
   */
  public static getResponsibleRole(structureType: StructureConstant): string {
    if (GameConfig.isMilitaryStructure(structureType)) {
      return GameConfig.ROLES.ENGINEER;
    }
    if (GameConfig.isBasicStructure(structureType)) {
      return GameConfig.ROLES.BUILDER;
    }
    return 'unknown';
  }

  /**
   * 获取房间指定角色的数量限制
   */
  public static getRoleLimits(roomLevel: number, role: string): { min: number; max: number; priority: number } | null {
    const config = GameConfig.ROLE_LIMITS.BY_RCL[roomLevel as keyof typeof GameConfig.ROLE_LIMITS.BY_RCL];
    if (!config || !(config as any)[role]) {
      return null;
    }
    return (config as any)[role];
  }

  /**
   * 检查是否可以生产更多指定角色的creep
   */
  public static canProduceMoreCreeps(
    roomLevel: number,
    role: string,
    currentCount: number,
    totalCreepsInRoom: number
  ): boolean {
    // 检查全局房间creep上限
    if (totalCreepsInRoom >= GameConfig.ROLE_LIMITS.GLOBAL.MAX_CREEPS_PER_ROOM) {
      return false;
    }

    // 检查角色特定限制
    const limits = GameConfig.getRoleLimits(roomLevel, role);
    if (!limits) {
      return false;
    }

    return currentCount < limits.max;
  }

  /**
   * 检查是否需要生产指定角色的creep
   */
  public static needsMoreCreeps(roomLevel: number, role: string, currentCount: number): boolean {
    const limits = GameConfig.getRoleLimits(roomLevel, role);
    if (!limits) {
      return false;
    }

    return currentCount < limits.min;
  }

  /**
   * 获取角色生产优先级
   */
  public static getRolePriority(roomLevel: number, role: string): number {
    const limits = GameConfig.getRoleLimits(roomLevel, role);
    return limits ? limits.priority : 999;
  }

  /**
   * 获取房间所有角色的配置
   */
  public static getRoomRoleConfig(roomLevel: number): { [role: string]: { min: number; max: number; priority: number } } {
    return GameConfig.ROLE_LIMITS.BY_RCL[roomLevel as keyof typeof GameConfig.ROLE_LIMITS.BY_RCL] || {};
  }

  // 获取房间最大能量容量
  public static getRoomEnergyCapacity(room: Room): number {
    const spawns = room.find(FIND_MY_SPAWNS);
    const extensions = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_EXTENSION }
    });

    return spawns.length * GameConfig.ENERGY_CAPACITY.SPAWN +
      extensions.length * GameConfig.ENERGY_CAPACITY.EXTENSION;
  }

  /**
   * 检查角色是否可以捡拾地面掉落资源
   */
  public static canPickupDroppedResources(role: string): boolean {
    return GameConfig.ROLE_PERMISSIONS.CAN_PICKUP_DROPPED_RESOURCES.includes(role as any);
  }

  /**
   * 检查角色是否只能从存储建筑获取资源
   */
  public static isStorageOnlyRole(role: string): boolean {
    return GameConfig.ROLE_PERMISSIONS.STORAGE_ONLY_ROLES.includes(role as any);
  }

  /**
   * 获取spawn应该保留的能量数量
   */
  public static getSpawnEnergyReserve(roomLevel: number, roomState: 'normal' | 'emergency' | 'critical' = 'normal'): number {
    if (roomState === 'critical') {
      return GameConfig.THRESHOLDS.SPAWN_CRITICAL_RESERVE;
    }

    if (roomState === 'emergency') {
      return GameConfig.THRESHOLDS.SPAWN_EMERGENCY_RESERVE;
    }

    const reserves = GameConfig.THRESHOLDS.SPAWN_ENERGY_RESERVE_BY_RCL;
    return reserves[roomLevel as keyof typeof reserves] || reserves[1];
  }

  /**
   * 检查spawn是否有足够的保留能量供非关键角色使用
   */
  public static canUseSpawnEnergy(room: Room, requestingRole: string): boolean {
    const spawns = room.find(FIND_MY_STRUCTURES, {
      filter: (s) => s.structureType === STRUCTURE_SPAWN
    }) as StructureSpawn[];

    if (spawns.length === 0) {
      console.log(`[canUseSpawnEnergy] 房间 ${room.name} 没有spawn`);
      return false;
    }

    const roomLevel = room.controller?.level || 1;
    const spawn = spawns[0];
    const spawnEnergy = spawn.store.getUsedCapacity(RESOURCE_ENERGY);
    const spawnCapacity = spawn.store.getCapacity(RESOURCE_ENERGY);

    // 检查房间状态
    const roomState = GameConfig.assessRoomEnergyState(room);
    const reserveAmount = GameConfig.getSpawnEnergyReserve(roomLevel, roomState);

    console.log(`[canUseSpawnEnergy] 角色: ${requestingRole}, 房间状态: ${roomState}, RCL: ${roomLevel}, spawn能量: ${spawnEnergy}/${spawnCapacity}, 保留阈值: ${reserveAmount}`);

    // 特殊情况：当spawn满能量时，允许所有角色获取能量
    if (spawnEnergy >= spawnCapacity) {
      console.log(`[canUseSpawnEnergy] spawn满能量，允许所有角色获取`);
      return true;
    }

    // 关键角色（harvester, transporter）可以使用更多能量
    if (requestingRole === GameConfig.ROLES.HARVESTER ||
        requestingRole === GameConfig.ROLES.TRANSPORTER) {
      const canUse = spawnEnergy > GameConfig.THRESHOLDS.SPAWN_CRITICAL_RESERVE;
      console.log(`[canUseSpawnEnergy] 关键角色，需要 > ${GameConfig.THRESHOLDS.SPAWN_CRITICAL_RESERVE}，结果: ${canUse}`);
      return canUse;
    }

    // 非关键角色需要更多保留
    const canUse = spawnEnergy > reserveAmount;
    console.log(`[canUseSpawnEnergy] 非关键角色，需要 > ${reserveAmount}，结果: ${canUse}`);
    return canUse;
  }

  /**
   * 评估房间能量状态
   */
  public static assessRoomEnergyState(room: Room): 'normal' | 'emergency' | 'critical' {
    const creeps = Object.values(Game.creeps).filter(c => c.room.name === room.name);
    const harvesterCount = creeps.filter(c => c.memory.role === GameConfig.ROLES.HARVESTER).length;
    const transporterCount = creeps.filter(c => c.memory.role === GameConfig.ROLES.TRANSPORTER).length;
    const roomLevel = room.controller?.level || 1;

    console.log(`[assessRoomEnergyState] 房间 ${room.name}, RCL: ${roomLevel}, harvester: ${harvesterCount}, transporter: ${transporterCount}`);

    // 关键状态：缺少基础creep
    if (harvesterCount === 0 || (roomLevel >= 2 && transporterCount === 0)) {
      console.log(`[assessRoomEnergyState] 房间状态: critical (缺少基础creep)`);
      return 'critical';
    }

    // 紧急状态：基础creep数量不足
    if (harvesterCount === 1 && transporterCount === 0) {
      console.log(`[assessRoomEnergyState] 房间状态: emergency (基础creep数量不足)`);
      return 'emergency';
    }

    console.log(`[assessRoomEnergyState] 房间状态: normal`);
    return 'normal';
  }
}
