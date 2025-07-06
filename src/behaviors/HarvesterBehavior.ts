import { BaseBehavior, BehaviorResult, EnergySourceStrategy, EnergySourceConfig } from "./BaseBehavior";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";

/**
 * 矿工行为状态
 */
enum HarvesterState {
  MOVING_TO_SOURCE = "moving_to_source",
  HARVESTING = "harvesting",
  MOVING_TO_DROP = "moving_to_drop",      // 初期：移动到存储点
  DROPPING = "dropping",                  // 初期：放置资源
  PROFESSIONAL_HARVESTING = "professional_harvesting", // 专业采矿：持续挖掘
  PROFESSIONAL_DROPPING = "professional_dropping",     // 专业采矿：放在地上
  IDLE = "idle"
}

/**
 * 矿工行为类
 * 初期模式：采矿 + 运输（全能型）
 * 后期模式：专业采矿（只负责挖掘，资源放在地上或存储点）
 */
export class HarvesterBehavior extends BaseBehavior {
  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  /**
   * 获取能量获取配置 - 采集工使用直接采集策略
   */
  protected getEnergySourceConfig(): EnergySourceConfig {
    return {
      strategy: EnergySourceStrategy.HARVEST_DIRECT,
      allowSpawn: false,
      allowExtensions: false,
      allowContainers: false,
      allowStorage: false,
      allowDroppedResources: true,   // 可以捡拾地面资源
      allowDirectHarvest: true,      // 主要功能：直接采集
      minEnergyThreshold: 0
    };
  }

  /**
   * 获取角色名称
   */
  protected getRoleName(): string {
    return GameConfig.ROLES.HARVESTER;
  }

  public run(creep: Creep): BehaviorResult {
    return this.safeExecute(() => {
      // 初始化creep状态
      if (!creep.memory.state) {
        creep.memory.state = HarvesterState.MOVING_TO_SOURCE;
      }

      // 检查是否需要切换到专业采矿模式
      // TODO: 后期扩展 - 当房间内有专门的搬运工时，切换到专业采矿模式
      const shouldUseProfessionalMode = this.shouldUseProfessionalMode(creep);

      if (shouldUseProfessionalMode) {
        return this.runProfessionalHarvesting(creep);
      } else {
        return this.runHybridHarvesting(creep);
      }
    }, `HarvesterBehavior.run(${creep.name})`);
  }

  /**
   * 判断是否应该使用专业采矿模式
   * TODO: 后期扩展 - 实现更复杂的判断逻辑
   */
  private shouldUseProfessionalMode(creep: Creep): boolean {
    // 当前简单判断：如果房间内有搬运工，则使用专业模式
    const transporters = creep.room.find(FIND_MY_CREEPS, {
      filter: c => c.memory.role === GameConfig.ROLES.TRANSPORTER
    });

    // TODO: 后期扩展判断条件：
    // 1. 房间内搬运工数量 >= 2
    // 2. 矿点附近有Container或Storage
    // 3. 房间控制器等级 >= 3
    // 4. 能量产出稳定

    return transporters.length >= GameConfig.THRESHOLDS.HARVESTER_PROFESSIONAL_MODE_THRESHOLD; // 搬运工数量达到阈值时切换专业模式
  }

  /**
   * 混合采矿模式（初期）- 采矿 + 运输
   */
  private runHybridHarvesting(creep: Creep): BehaviorResult {
    const state = creep.memory.state as HarvesterState;

    switch (state) {
      case HarvesterState.MOVING_TO_SOURCE:
      case HarvesterState.HARVESTING:
        return this.handleHarvesting(creep);

      case HarvesterState.MOVING_TO_DROP:
      case HarvesterState.DROPPING:
        return this.handleDropping(creep);

      case HarvesterState.IDLE:
      default:
        // 根据当前状态决定下一步行动
        if (this.needsEnergy(creep)) {
          creep.memory.state = HarvesterState.MOVING_TO_SOURCE;
          return this.handleHarvesting(creep);
        } else if (this.hasEnergy(creep)) {
          creep.memory.state = HarvesterState.MOVING_TO_DROP;
          return this.handleDropping(creep);
        }
        return { success: true, message: "等待中" };
    }
  }

  /**
 * 专业采矿模式（后期）- 只负责挖掘
 */
  private runProfessionalHarvesting(creep: Creep): BehaviorResult {
    const state = creep.memory.state as HarvesterState;

    // 如果从混合模式切换过来，重置状态
    if (state === HarvesterState.MOVING_TO_DROP || state === HarvesterState.DROPPING) {
      creep.memory.state = HarvesterState.MOVING_TO_SOURCE;
    }

    switch (state) {
      case HarvesterState.MOVING_TO_SOURCE:
      case HarvesterState.PROFESSIONAL_HARVESTING:
        return this.handleProfessionalHarvesting(creep);

      case HarvesterState.PROFESSIONAL_DROPPING:
        return this.handleProfessionalDropping(creep);

      case HarvesterState.IDLE:
      default:
        // 专业模式下，总是优先采矿
        creep.memory.state = HarvesterState.MOVING_TO_SOURCE;
        return this.handleProfessionalHarvesting(creep);
    }
  }

  /**
   * 处理采矿逻辑
   */
  private handleHarvesting(creep: Creep): BehaviorResult {
    // 寻找最近的能量源
    const source = this.findBestHarvestSource(creep);
    if (!source) {
      return { success: false, message: "未找到能量源" };
    }

    // 保存目标到内存，避免重复寻找
    creep.memory.targetSourceId = source.id;

    const harvestResult = creep.harvest(source);

    switch (harvestResult) {
      case OK:
        creep.memory.state = HarvesterState.HARVESTING;
        // 检查是否已满
        if (creep.store.getFreeCapacity() === 0) {
          creep.memory.state = HarvesterState.MOVING_TO_DROP;
        }
        return { success: true, message: "正在采矿" };

      case ERR_NOT_IN_RANGE:
        creep.memory.state = HarvesterState.MOVING_TO_SOURCE;
        this.moveToTarget(creep, source);
        return { success: true, message: "移动到矿点" };

      case ERR_NOT_ENOUGH_RESOURCES:
        // 能量源暂时枯竭，等待恢复
        return { success: true, message: "等待能量源恢复" };

      case ERR_BUSY:
        return { success: false, message: "等待孵化完成" };

      default:
        return { success: false, message: `采矿失败: ${harvestResult}` };
    }
  }

  /**
   * 处理放置资源逻辑（初期模式）
   */
  private handleDropping(creep: Creep): BehaviorResult {
    // 寻找最佳存储目标
    const target = this.findBestDropTarget(creep);
    if (!target) {
      return { success: false, message: "未找到存储目标" };
    }

    const transferResult = creep.transfer(target, RESOURCE_ENERGY);

    switch (transferResult) {
      case OK:
        creep.memory.state = HarvesterState.DROPPING;
        // 检查是否已清空
        if (creep.store.getUsedCapacity() === 0) {
          creep.memory.state = HarvesterState.MOVING_TO_SOURCE;
        }
        return { success: true, message: "正在存储能量" };

      case ERR_NOT_IN_RANGE:
        creep.memory.state = HarvesterState.MOVING_TO_DROP;
        this.moveToTarget(creep, target);
        return { success: true, message: "移动到存储点" };

      case ERR_FULL:
        // 目标已满，寻找其他目标
        const alternativeTarget = this.findBestDropTarget(creep, target);
        if (alternativeTarget) {
          this.moveToTarget(creep, alternativeTarget);
          return { success: true, message: "寻找其他存储点" };
        }
        // 所有存储点已满，切换到专业模式在矿点放置资源
        creep.memory.state = HarvesterState.PROFESSIONAL_DROPPING;
        return { success: true, message: "存储点已满，切换到专业模式" };

      default:
        return { success: false, message: `存储失败: ${transferResult}` };
    }
  }

  /**
   * 寻找最佳采集源
   */
  private findBestHarvestSource(creep: Creep): Source | null {
    // 优先使用内存中的目标
    if (creep.memory.targetSourceId) {
      const cachedSource = Game.getObjectById(creep.memory.targetSourceId) as Source;
      if (cachedSource && cachedSource.energy > 0) {
        return cachedSource;
      }
    }

    // 寻找最近的有能量的能量源
    const sources = creep.room.find(FIND_SOURCES, {
      filter: source => source.energy > 0
    });

    if (sources.length === 0) {
      return null;
    }

    // TODO: 后期扩展 - 更智能的能量源选择算法
    // 1. 考虑其他creep的目标，避免拥挤
    // 2. 考虑能量源的恢复时间
    // 3. 考虑路径长度和安全性

    return creep.pos.findClosestByPath(sources) || sources[0];
  }

  /**
   * 寻找最佳存储目标
   */
  private findBestDropTarget(creep: Creep, excludeTarget?: Structure): Structure | null {
    // 优先级：Spawn > Extension > Container > Storage
    const targets = creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        if (excludeTarget && structure.id === excludeTarget.id) {
          return false;
        }

        return (
          (structure.structureType === STRUCTURE_SPAWN ||
            structure.structureType === STRUCTURE_EXTENSION) &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        ) || (
            (structure.structureType === STRUCTURE_CONTAINER ||
              structure.structureType === STRUCTURE_STORAGE) &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
      }
    });

    if (targets.length === 0) {
      return null;
    }

    // TODO: 后期扩展 - 更智能的目标选择
    // 1. 按优先级排序（Spawn > Extension > Container > Storage）
    // 2. 考虑距离和路径
    // 3. 考虑其他creep的目标，避免拥挤

    return creep.pos.findClosestByPath(targets) || targets[0];
  }

  public canExecute(creep: Creep): boolean {
    return creep.memory.role === GameConfig.ROLES.HARVESTER;
  }

  public getPriority(): number {
    return 100; // 高优先级
  }

  public getName(): string {
    return "HarvesterBehavior";
  }

  /**
   * 处理专业采矿逻辑
   */
  private handleProfessionalHarvesting(creep: Creep): BehaviorResult {
    // 寻找最近的能量源
    const source = this.findBestHarvestSource(creep);
    if (!source) {
      return { success: false, message: "未找到能量源" };
    }

    // 保存目标到内存，避免重复寻找
    creep.memory.targetSourceId = source.id;

    const harvestResult = creep.harvest(source);

    switch (harvestResult) {
      case OK:
        creep.memory.state = HarvesterState.PROFESSIONAL_HARVESTING;
        // 专业模式：检查是否已满，满了就放在地上
        if (creep.store.getFreeCapacity() === 0) {
          creep.memory.state = HarvesterState.PROFESSIONAL_DROPPING;
        }
        return { success: true, message: "专业采矿中" };

      case ERR_NOT_IN_RANGE:
        creep.memory.state = HarvesterState.MOVING_TO_SOURCE;
        this.moveToTarget(creep, source);
        return { success: true, message: "移动到矿点" };

      case ERR_NOT_ENOUGH_RESOURCES:
        // 能量源暂时枯竭，等待恢复
        return { success: true, message: "等待能量源恢复" };

      default:
        return { success: false, message: `专业采矿失败: ${harvestResult}` };
    }
  }

  /**
 * 处理专业采矿的资源放置逻辑
 */
  private handleProfessionalDropping(creep: Creep): BehaviorResult {
    // 检查是否还有能量可以放置
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      // 没有能量了，直接回到采矿状态
      creep.memory.state = HarvesterState.MOVING_TO_SOURCE;
      return { success: true, message: "能量已清空，继续采矿" };
    }

    // 专业模式：优先寻找Container，其次放在地上
    const container = this.findNearbyContainer(creep);

    if (container) {
      // 有Container，放入Container
      const transferResult = creep.transfer(container, RESOURCE_ENERGY);

      switch (transferResult) {
        case OK:
          // 检查是否已清空
          if (creep.store.getUsedCapacity() === 0) {
            creep.memory.state = HarvesterState.MOVING_TO_SOURCE;
          }
          return { success: true, message: "存储到Container" };

        case ERR_NOT_IN_RANGE:
          this.moveToTarget(creep, container);
          return { success: true, message: "移动到Container" };

        case ERR_NOT_ENOUGH_RESOURCES:
          // 没有资源了，回到采矿状态
          creep.memory.state = HarvesterState.MOVING_TO_SOURCE;
          return { success: true, message: "能量已清空，继续采矿" };

        case ERR_FULL:
          // Container满了，放在地上
          return this.dropEnergyOnGround(creep);

        default:
          return { success: false, message: `Container存储失败: ${transferResult}` };
      }
    } else {
      // 没有Container，直接放在地上
      return this.dropEnergyOnGround(creep);
    }
  }

  /**
   * 寻找附近的Container
   */
  private findNearbyContainer(creep: Creep): StructureContainer | null {
    const containers = creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return structure.structureType === STRUCTURE_CONTAINER &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    }) as StructureContainer[];

    if (containers.length === 0) {
      return null;
    }

    // 寻找最近的Container
    return creep.pos.findClosestByRange(containers);
  }

  /**
 * 在地上放置能量
 */
  private dropEnergyOnGround(creep: Creep): BehaviorResult {
    // 检查是否还有能量可以放置
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      // 没有能量了，直接回到采矿状态
      creep.memory.state = HarvesterState.MOVING_TO_SOURCE;
      return { success: true, message: "能量已清空，继续采矿" };
    }

    const dropResult = creep.drop(RESOURCE_ENERGY);

    switch (dropResult) {
      case OK:
        // 检查是否已清空
        if (creep.store.getUsedCapacity() === 0) {
          creep.memory.state = HarvesterState.MOVING_TO_SOURCE;
        }
        return { success: true, message: "能量放在地上" };

      case ERR_NOT_ENOUGH_RESOURCES:
        // 没有资源了，回到采矿状态
        creep.memory.state = HarvesterState.MOVING_TO_SOURCE;
        return { success: true, message: "能量已清空，继续采矿" };

      default:
        return { success: false, message: `放置能量失败: ${dropResult}` };
    }
  }
}
