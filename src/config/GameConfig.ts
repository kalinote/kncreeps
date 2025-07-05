/**
 * 游戏配置常量
 */
export class GameConfig {
  // 角色类型
  public static readonly ROLES = {
    HARVESTER: 'harvester',
    TRANSPORTER: 'transporter',
    BUILDER: 'builder',
    UPGRADER: 'upgrader',
    SCOUT: 'scout',
    WARRIOR: 'warrior',
    DEFENDER: 'defender',
    CLAIMER: 'claimer'
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
    EMERGENCY_ENERGY_LEVEL: 100
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
    RESOURCE_DEPLETED: 'resource.depleted'
  } as const;

  // 默认角色配置
  public static readonly DEFAULT_ROLE_CONFIGS = {
    [GameConfig.ROLES.HARVESTER]: {
      minParts: [WORK, CARRY, MOVE],
      maxParts: [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
      priority: GameConfig.PRIORITIES.CRITICAL
    },
    [GameConfig.ROLES.TRANSPORTER]: {
      minParts: [CARRY, MOVE],
      maxParts: [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
      priority: GameConfig.PRIORITIES.HIGH
    },
    [GameConfig.ROLES.BUILDER]: {
      minParts: [WORK, CARRY, MOVE],
      maxParts: [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
      priority: GameConfig.PRIORITIES.MEDIUM
    },
    [GameConfig.ROLES.UPGRADER]: {
      minParts: [WORK, CARRY, MOVE],
      maxParts: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE],
      priority: GameConfig.PRIORITIES.MEDIUM
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

  // 获取房间最大能量容量
  public static getRoomEnergyCapacity(room: Room): number {
    const spawns = room.find(FIND_MY_SPAWNS);
    const extensions = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_EXTENSION }
    });

    return spawns.length * GameConfig.ENERGY_CAPACITY.SPAWN +
           extensions.length * GameConfig.ENERGY_CAPACITY.EXTENSION;
  }
}
