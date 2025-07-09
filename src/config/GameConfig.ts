import { RoleConfig } from "./RoleConfig";
import { ThresholdConfig } from "./ThresholdConfig";
import { SystemConfig } from "./SystemConfig";
import { EventConfig } from "./EventConfig";
import { EnergyConfig } from "./EnergyConfig";
import { VisualConfig } from "./VisualConfig";

/**
 * 统一配置接口
 */
export class GameConfig {
  // 导出角色相关配置
  public static readonly ROLES = RoleConfig.ROLES;
  public static readonly PRIORITIES = RoleConfig.PRIORITIES;
  public static readonly ROLE_PERMISSIONS = RoleConfig.ROLE_PERMISSIONS;
  public static readonly ROLE_LIMITS = RoleConfig.ROLE_LIMITS;

  // 导出阈值配置
  public static readonly THRESHOLDS = ThresholdConfig.THRESHOLDS;

  // 导出系统配置
  public static readonly SYSTEM = SystemConfig.SYSTEM;
  public static readonly UPDATE_FREQUENCIES = SystemConfig.UPDATE_FREQUENCIES;
  public static readonly TIMEOUTS = SystemConfig.TIMEOUTS;
  public static readonly ROOM_PHASES = SystemConfig.ROOM_PHASES;

  // 导出事件配置
  public static readonly EVENTS = EventConfig.EVENTS;

  // 导出能量配置
  public static readonly BODY_PART_COSTS = EnergyConfig.BODY_PART_COSTS;
  public static readonly ENERGY_CAPACITY = EnergyConfig.ENERGY_CAPACITY;
  public static readonly STRUCTURE_CATEGORIES = EnergyConfig.STRUCTURE_CATEGORIES;

  // 导出可视化配置
  public static readonly VISUAL = VisualConfig.LAYERS;
  public static readonly VISUAL_PERFORMANCE = VisualConfig.PERFORMANCE;

  // 开局生产配置
  public static readonly BOOTSTRAP_CONFIG = {
    // RCL1开局时的最小配置
    RCL1_MIN_CONFIGS: {
      [RoleConfig.ROLES.WORKER]: {
        body: [WORK, CARRY, MOVE], // 1WORK + 1CARRY + 1MOVE = 200能量
        cost: 200,
        priority: RoleConfig.PRIORITIES.CRITICAL
      },
      [RoleConfig.ROLES.TRANSPORTER]: {
        body: [CARRY, CARRY, MOVE], // 2CARRY + 1MOVE = 150能量
        cost: 150,
        priority: RoleConfig.PRIORITIES.HIGH
      }
    },
    // 开局生产顺序
    PRODUCTION_ORDER: [
      RoleConfig.ROLES.WORKER,    // 第一步：生产worker
      RoleConfig.ROLES.TRANSPORTER // 第二步：生产transporter
    ],
    // 开局完成条件
    COMPLETION_CONDITIONS: {
      MIN_WORKER_COUNT: 1,
      MIN_TRANSPORTER_COUNT: 1,
      MIN_ENERGY_RESERVE: 50  // 保留50能量用于后续生产
    }
  } as const;

  // 导出所有方法以保持向后兼容

  // 角色相关方法
  public static getRoleLimits = RoleConfig.getRoleLimits;
  public static canProduceMoreCreeps = RoleConfig.canProduceMoreCreeps;
  public static needsMoreCreeps = RoleConfig.needsMoreCreeps;
  public static getRolePriority = RoleConfig.getRolePriority;
  public static getRoomRoleConfig = RoleConfig.getRoomRoleConfig;
  public static canPickupDroppedResources = RoleConfig.canPickupDroppedResources;
  public static isStorageOnlyRole = RoleConfig.isStorageOnlyRole;

  // 阈值相关方法
  public static getSpawnEnergyReserve = ThresholdConfig.getSpawnEnergyReserve;
  public static canUseSpawnEnergy = ThresholdConfig.canUseSpawnEnergy;
  public static assessRoomEnergyState = ThresholdConfig.assessRoomEnergyState;

  // 能量相关方法
  public static getBodyCost = EnergyConfig.getBodyCost;
  public static isValidBody = EnergyConfig.isValidBody;
  public static isMilitaryStructure = EnergyConfig.isMilitaryStructure;
  public static isBasicStructure = EnergyConfig.isBasicStructure;
  public static isBuilderResponsible = EnergyConfig.isBuilderResponsible;
  public static isEngineerResponsible = EnergyConfig.isEngineerResponsible;
  public static getResponsibleRole = EnergyConfig.getResponsibleRole;
  public static getRoomEnergyCapacity = EnergyConfig.getRoomEnergyCapacity;

  // 开局相关方法
  public static isBootstrapPhase = (room: Room): boolean => {
    return room.controller?.level === 1;
  };

  public static isBootstrapCompleted = (room: Room): boolean => {
    const workerCount = Object.values(Game.creeps).filter(creep =>
      creep.room.name === room.name && creep.memory.role === GameConfig.ROLES.WORKER
    ).length;
    const transporterCount = Object.values(Game.creeps).filter(creep =>
      creep.room.name === room.name && creep.memory.role === GameConfig.ROLES.TRANSPORTER
    ).length;

    return workerCount >= GameConfig.BOOTSTRAP_CONFIG.COMPLETION_CONDITIONS.MIN_WORKER_COUNT &&
      transporterCount >= GameConfig.BOOTSTRAP_CONFIG.COMPLETION_CONDITIONS.MIN_TRANSPORTER_COUNT;
  };

  public static getBootstrapConfig = (role: string) => {
    return GameConfig.BOOTSTRAP_CONFIG.RCL1_MIN_CONFIGS[role as keyof typeof GameConfig.BOOTSTRAP_CONFIG.RCL1_MIN_CONFIGS];
  };
}
