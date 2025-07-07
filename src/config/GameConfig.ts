import { RoleConfig } from "./RoleConfig";
import { ThresholdConfig } from "./ThresholdConfig";
import { SystemConfig } from "./SystemConfig";
import { EventConfig } from "./EventConfig";
import { EnergyConfig } from "./EnergyConfig";

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
  public static readonly ROOM_PHASES = SystemConfig.ROOM_PHASES;

  // 导出事件配置
  public static readonly EVENTS = EventConfig.EVENTS;

  // 导出能量配置
  public static readonly BODY_PART_COSTS = EnergyConfig.BODY_PART_COSTS;
  public static readonly ENERGY_CAPACITY = EnergyConfig.ENERGY_CAPACITY;
  public static readonly STRUCTURE_CATEGORIES = EnergyConfig.STRUCTURE_CATEGORIES;

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
}
