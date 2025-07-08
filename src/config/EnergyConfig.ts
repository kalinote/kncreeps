import { RoleConfig } from "./RoleConfig";
import { ThresholdConfig } from "./ThresholdConfig";

/**
 * 能量相关配置
 */
export class EnergyConfig {
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

  // 获取身体部件总成本
  public static getBodyCost(body: BodyPartConstant[]): number {
    return body.reduce((cost, part) => cost + EnergyConfig.BODY_PART_COSTS[part], 0);
  }

  // 验证身体配置是否有效
  public static isValidBody(body: BodyPartConstant[]): boolean {
    return body.length > 0 &&
      body.length <= ThresholdConfig.THRESHOLDS.MAX_CREEP_BODY_SIZE &&
      body.includes(MOVE); // 至少需要一个移动部件
  }

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
    return !EnergyConfig.isMilitaryStructure(structureType);
  }

  /**
   * 检查建筑工是否负责该结构
   */
  public static isBuilderResponsible(structureType: StructureConstant): boolean {
    return EnergyConfig.isBasicStructure(structureType);
  }

  /**
   * 检查工程师是否负责该结构
   */
  public static isEngineerResponsible(structureType: StructureConstant): boolean {
    return EnergyConfig.isMilitaryStructure(structureType);
  }

  /**
   * 获取结构的负责角色
   */
  public static getResponsibleRole(structureType: StructureConstant): string {
    if (EnergyConfig.isMilitaryStructure(structureType)) {
      return RoleConfig.ROLES.WORKER; // 军事设施由工作者负责（原工程师）
    }
    if (EnergyConfig.isBasicStructure(structureType)) {
      return RoleConfig.ROLES.WORKER; // 基础设施由工作者负责
    }
    return 'unknown';
  }

  // 获取房间最大能量容量
  public static getRoomEnergyCapacity(room: Room): number {
    const spawns = room.find(FIND_MY_SPAWNS);
    const extensions = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_EXTENSION }
    });

    return spawns.length * EnergyConfig.ENERGY_CAPACITY.SPAWN +
      extensions.length * EnergyConfig.ENERGY_CAPACITY.EXTENSION;
  }
}
