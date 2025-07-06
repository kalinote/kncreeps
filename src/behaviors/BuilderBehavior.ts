import { BaseBehavior, BehaviorResult, EnergySourceStrategy, EnergySourceConfig } from "./BaseBehavior";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";

/**
 * 建筑工行为状态
 */
enum BuilderState {
  IDLE = "idle",
  MOVING_TO_ENERGY_SOURCE = "moving_to_energy_source",
  HARVESTING_ENERGY = "harvesting_energy",
  MOVING_TO_CONSTRUCTION = "moving_to_construction",
  BUILDING = "building",
  MOVING_TO_REPAIR = "moving_to_repair",
  REPAIRING = "repairing"
}

/**
 * 建筑工行为类
 * 负责修建建筑和修复受损建筑
 */
export class BuilderBehavior extends BaseBehavior {
  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  /**
   * 获取能量获取配置 - 建筑工使用存储建筑策略
   */
  protected getEnergySourceConfig(): EnergySourceConfig {
    return {
      strategy: EnergySourceStrategy.STORAGE_ONLY,
      allowSpawn: true,
      allowExtensions: true,
      allowContainers: true,
      allowStorage: true,
      allowDroppedResources: false,
      allowDirectHarvest: false,
      minEnergyThreshold: 0
    };
  }

  /**
   * 获取角色名称
   */
  protected getRoleName(): string {
    return GameConfig.ROLES.BUILDER;
  }

  public run(creep: Creep): BehaviorResult {
    return this.safeExecute(() => {
      // 初始化creep状态
      if (!creep.memory.state) {
        creep.memory.state = BuilderState.IDLE;
      }

      const state = creep.memory.state as BuilderState;

      // 状态机逻辑
      switch (state) {
        case BuilderState.IDLE:
          return this.decideNextAction(creep);

        case BuilderState.MOVING_TO_ENERGY_SOURCE:
        case BuilderState.HARVESTING_ENERGY:
          return this.handleEnergyHarvesting(creep);

        case BuilderState.MOVING_TO_CONSTRUCTION:
        case BuilderState.BUILDING:
          return this.handleConstruction(creep);

        case BuilderState.MOVING_TO_REPAIR:
        case BuilderState.REPAIRING:
          return this.handleRepair(creep);

        default:
          creep.memory.state = BuilderState.IDLE;
          return this.decideNextAction(creep);
      }
    }, `BuilderBehavior.run(${creep.name})`);
  }

  /**
   * 决定下一步行动
   */
  private decideNextAction(creep: Creep): BehaviorResult {
    // 如果没有能量，优先获取能量
    if (this.needsEnergy(creep)) {
      creep.memory.state = BuilderState.MOVING_TO_ENERGY_SOURCE;
      return this.handleEnergyHarvesting(creep);
    }

    // 如果有能量，根据优先级选择任务
    if (this.hasEnergy(creep)) {
      // 优先级1：建筑工地
      const constructionSite = this.findBestConstructionSite(creep);
      if (constructionSite) {
        creep.memory.state = BuilderState.MOVING_TO_CONSTRUCTION;
        creep.memory.targetId = constructionSite.id;
        return this.handleConstruction(creep);
      }

      // 优先级2：修复受损建筑
      const repairTarget = this.findBestRepairTarget(creep);
      if (repairTarget) {
        creep.memory.state = BuilderState.MOVING_TO_REPAIR;
        creep.memory.targetId = repairTarget.id;
        return this.handleRepair(creep);
      }

      // 没有任务，等待
      return { success: true, message: "没有建筑任务，等待中" };
    }

    return { success: true, message: "等待任务分配" };
  }

  /**
   * 处理能量获取逻辑
   */
  private handleEnergyHarvesting(creep: Creep): BehaviorResult {
    console.log(`[${creep.name}] 建筑工寻找能量源，当前能量: ${creep.store.getUsedCapacity(RESOURCE_ENERGY)}/${creep.store.getCapacity(RESOURCE_ENERGY)}`);

    const energySource = this.findBestEnergySource(creep);
    if (!energySource) {
      console.log(`[${creep.name}] 建筑工未找到能量源，配置: ${JSON.stringify(this.getEnergySourceConfig())}`);
      return { success: false, message: "未找到能量源" };
    }

    console.log(`[${creep.name}] 建筑工选择能量源: ${energySource.constructor.name}`);

    // 保存目标到内存
    creep.memory.targetId = energySource.id;

    // 使用基类的通用能量获取方法
    const harvestResult = this.handleEnergyCollection(creep, energySource);

    switch (harvestResult) {
      case OK:
        creep.memory.state = BuilderState.HARVESTING_ENERGY;
        // 检查是否已满
        if (creep.store.getFreeCapacity() === 0) {
          creep.memory.state = BuilderState.IDLE;
          delete creep.memory.targetId;
        }
        return { success: true, message: "正在获取能量" };

      case ERR_NOT_IN_RANGE:
        creep.memory.state = BuilderState.MOVING_TO_ENERGY_SOURCE;
        this.moveToTarget(creep, energySource);
        return { success: true, message: "移动到能量源" };

      case ERR_NOT_ENOUGH_RESOURCES:
        // 目标资源不足，清除目标重新寻找
        delete creep.memory.targetId;
        creep.memory.state = BuilderState.IDLE;
        return { success: true, message: "目标资源不足，重新寻找" };

      case ERR_FULL:
        // 已满，去工作
        creep.memory.state = BuilderState.IDLE;
        delete creep.memory.targetId;
        return { success: true, message: "能量已满，准备工作" };

      default:
        return { success: false, message: `获取能量失败: ${harvestResult}` };
    }
  }

  /**
   * 处理建筑逻辑
   */
  private handleConstruction(creep: Creep): BehaviorResult {
    // 检查是否还有能量
    if (!this.hasEnergy(creep)) {
      creep.memory.state = BuilderState.IDLE;
      delete creep.memory.targetId;
      return { success: true, message: "能量不足，重新获取" };
    }

    // 获取建筑目标
    let constructionSite: ConstructionSite | null = null;
    if (creep.memory.targetId) {
      constructionSite = Game.getObjectById(creep.memory.targetId) as ConstructionSite;
    }

    // 如果目标不存在，重新寻找
    if (!constructionSite) {
      constructionSite = this.findBestConstructionSite(creep);
      if (!constructionSite) {
        creep.memory.state = BuilderState.IDLE;
        delete creep.memory.targetId;
        return { success: true, message: "没有建筑工地，寻找其他任务" };
      }
      creep.memory.targetId = constructionSite.id;
    }

    const buildResult = creep.build(constructionSite);

    switch (buildResult) {
      case OK:
        creep.memory.state = BuilderState.BUILDING;
        return { success: true, message: "正在建造" };

      case ERR_NOT_IN_RANGE:
        creep.memory.state = BuilderState.MOVING_TO_CONSTRUCTION;
        this.moveToTarget(creep, constructionSite);
        return { success: true, message: "移动到建筑工地" };

      case ERR_NOT_ENOUGH_RESOURCES:
        // 能量不足，去获取能量
        creep.memory.state = BuilderState.IDLE;
        delete creep.memory.targetId;
        return { success: true, message: "能量不足，重新获取" };

      case ERR_INVALID_TARGET:
        // 目标无效，清除并重新寻找
        delete creep.memory.targetId;
        creep.memory.state = BuilderState.IDLE;
        return { success: true, message: "建筑目标无效，重新寻找" };

      default:
        return { success: false, message: `建筑失败: ${buildResult}` };
    }
  }

  /**
   * 处理修复逻辑
   */
  private handleRepair(creep: Creep): BehaviorResult {
    // 检查是否还有能量
    if (!this.hasEnergy(creep)) {
      creep.memory.state = BuilderState.IDLE;
      delete creep.memory.targetId;
      return { success: true, message: "能量不足，重新获取" };
    }

    // 获取修复目标
    let repairTarget: Structure | null = null;
    if (creep.memory.targetId) {
      repairTarget = Game.getObjectById(creep.memory.targetId) as Structure;
    }

    // 如果目标不存在或已修复完成，重新寻找
    if (!repairTarget || repairTarget.hits === repairTarget.hitsMax) {
      repairTarget = this.findBestRepairTarget(creep);
      if (!repairTarget) {
        creep.memory.state = BuilderState.IDLE;
        delete creep.memory.targetId;
        return { success: true, message: "没有需要修复的建筑，寻找其他任务" };
      }
      creep.memory.targetId = repairTarget.id;
    }

    const repairResult = creep.repair(repairTarget);

    switch (repairResult) {
      case OK:
        creep.memory.state = BuilderState.REPAIRING;
        return { success: true, message: "正在修复" };

      case ERR_NOT_IN_RANGE:
        creep.memory.state = BuilderState.MOVING_TO_REPAIR;
        this.moveToTarget(creep, repairTarget);
        return { success: true, message: "移动到修复目标" };

      case ERR_NOT_ENOUGH_RESOURCES:
        // 能量不足，去获取能量
        creep.memory.state = BuilderState.IDLE;
        delete creep.memory.targetId;
        return { success: true, message: "能量不足，重新获取" };

      case ERR_INVALID_TARGET:
        // 目标无效，清除并重新寻找
        delete creep.memory.targetId;
        creep.memory.state = BuilderState.IDLE;
        return { success: true, message: "修复目标无效，重新寻找" };

      default:
        return { success: false, message: `修复失败: ${repairResult}` };
    }
  }

  /**
   * 检查是否是工程师专用结构（建筑工不应该建造或修复）
   */
  private isEngineerOnlyStructure(structureType: StructureConstant): boolean {
    return GameConfig.isMilitaryStructure(structureType);
  }

  /**
 * 寻找最佳建筑工地
 */
  private findBestConstructionSite(creep: Creep): ConstructionSite | null {
    // 过滤掉不应该由建筑工建造的结构
    const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES, {
      filter: (site) => !this.isEngineerOnlyStructure(site.structureType)
    });

    if (constructionSites.length === 0) {
      return null;
    }

    // 按优先级排序建筑工地
    const sortedSites = constructionSites.sort((a, b) => {
      const priorityA = this.getConstructionPriority(a);
      const priorityB = this.getConstructionPriority(b);

      if (priorityA !== priorityB) {
        return priorityB - priorityA; // 优先级高的排前面
      }

      // 同优先级按距离排序
      const distanceA = creep.pos.getRangeTo(a);
      const distanceB = creep.pos.getRangeTo(b);
      return distanceA - distanceB;
    });

    return sortedSites[0];
  }

  /**
   * 获取建筑优先级
   */
  private getConstructionPriority(site: ConstructionSite): number {
    switch (site.structureType) {
      case STRUCTURE_SPAWN: return 10;
      case STRUCTURE_EXTENSION: return 9;
      case STRUCTURE_CONTAINER: return 8;
      case STRUCTURE_STORAGE: return 7;
      case STRUCTURE_ROAD: return 5;
      // 以下结构由工程师负责，建筑工不处理
      case STRUCTURE_WALL:
      case STRUCTURE_RAMPART:
      case STRUCTURE_TOWER:
      case STRUCTURE_NUKER:
        return 0;
      default: return 4;
    }
  }

  /**
 * 寻找最佳修复目标
 */
  private findBestRepairTarget(creep: Creep): Structure | null {
    // 过滤掉不应该由建筑工修复的结构
    const repairTargets = creep.room.find(FIND_STRUCTURES, {
      filter: (s) => s.hits < s.hitsMax && !this.isEngineerOnlyStructure(s.structureType)
    });

    if (repairTargets.length === 0) {
      return null;
    }

    // 按紧急程度排序
    const sortedTargets = repairTargets.sort((a, b) => {
      const urgencyA = this.getRepairUrgency(a);
      const urgencyB = this.getRepairUrgency(b);

      if (urgencyA !== urgencyB) {
        return urgencyB - urgencyA; // 紧急程度高的排前面
      }

      // 同紧急程度按距离排序
      const distanceA = creep.pos.getRangeTo(a);
      const distanceB = creep.pos.getRangeTo(b);
      return distanceA - distanceB;
    });

    return sortedTargets[0];
  }

  /**
 * 获取修复紧急程度
 */
  private getRepairUrgency(structure: Structure): number {
    const damagePercent = 1 - (structure.hits / structure.hitsMax);

    let basePriority = 0;
    switch (structure.structureType) {
      case STRUCTURE_SPAWN: basePriority = 10; break;
      case STRUCTURE_EXTENSION: basePriority = 8; break;
      case STRUCTURE_CONTAINER: basePriority = 7; break;
      case STRUCTURE_STORAGE: basePriority = 6; break;
      case STRUCTURE_ROAD: basePriority = 4; break;
      // 以下结构由工程师负责，建筑工不处理
      case STRUCTURE_WALL:
      case STRUCTURE_RAMPART:
      case STRUCTURE_TOWER:
      case STRUCTURE_NUKER:
        return 0;
      default: basePriority = 3; break;
    }

    // 受损程度越高，优先级越高
    return basePriority + Math.floor(damagePercent * 10);
  }

  /**
 * 检查行为是否可以执行 - 当房间中有建筑任务时需要建筑工
 */
  public canExecute(creep: Creep): boolean {
    // 检查是否有可由建筑工处理的建筑工地
    const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES, {
      filter: (site) => !this.isEngineerOnlyStructure(site.structureType)
    });
    if (constructionSites.length > 0) {
      return true;
    }

    // 检查是否有需要修复的建筑（排除工程师专用结构）
    const repairTargets = creep.room.find(FIND_STRUCTURES, {
      filter: (s) => s.hits < s.hitsMax * GameConfig.THRESHOLDS.REPAIR_THRESHOLD && !this.isEngineerOnlyStructure(s.structureType)
    });

    return repairTargets.length > 0;
  }

  public getPriority(): number {
    return GameConfig.PRIORITIES.MEDIUM;
  }

  public getName(): string {
    return "BuilderBehavior";
  }
}
