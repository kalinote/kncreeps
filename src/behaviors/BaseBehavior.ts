import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";

/**
 * 行为执行结果
 */
export interface BehaviorResult {
  success: boolean;
  message?: string;
  nextState?: string;
}

/**
 * 能量获取策略
 */
export enum EnergySourceStrategy {
  STORAGE_ONLY = "storage_only",           // 只从存储建筑获取（升级工、建筑工）
  INCLUDE_GROUND = "include_ground",       // 包括地面资源（搬运工）
  HARVEST_DIRECT = "harvest_direct",       // 直接采集（采集工）
  BALANCED = "balanced"                    // 平衡策略（工程师等）
}

/**
 * 能量获取配置
 */
export interface EnergySourceConfig {
  strategy: EnergySourceStrategy;
  allowSpawn: boolean;                     // 是否允许从spawn获取
  allowExtensions: boolean;                // 是否允许从extension获取
  allowContainers: boolean;                // 是否允许从container获取
  allowStorage: boolean;                   // 是否允许从storage获取
  allowDroppedResources: boolean;          // 是否允许捡拾地面资源
  allowDirectHarvest: boolean;             // 是否允许直接采集
  minEnergyThreshold: number;              // 最小能量阈值
}

/**
 * 行为基类 - 所有具体行为的基础
 */
export abstract class BaseBehavior {
  protected eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * 执行行为的主要方法
   */
  public abstract run(creep: Creep): BehaviorResult;

  /**
   * 检查行为是否可以执行
   */
  public abstract canExecute(creep: Creep): boolean;

  /**
   * 行为优先级（数字越大优先级越高）
   */
  public abstract getPriority(): number;

  /**
   * 获取行为名称
   */
  public abstract getName(): string;

  /**
   * 获取能量获取配置 - 子类可重写
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
   * 获取角色名称 - 子类可重写以返回具体角色
   */
  protected getRoleName(): string {
    return "unknown";
  }

  /**
   * 寻找最佳能量源 - 通用实现
   */
  protected findBestEnergySource(creep: Creep): Structure | Resource | Source | null {
    // 优先使用内存中的目标
    if (creep.memory.targetId) {
      const cachedTarget = Game.getObjectById(creep.memory.targetId) as Structure | Resource | Source | null;
      if (cachedTarget && this.isValidEnergySource(cachedTarget)) {
        return cachedTarget;
      }
      delete creep.memory.targetId;
    }

    const config = this.getEnergySourceConfig();
    const energySources: (Structure | Resource | Source)[] = [];
    const roleName = this.getRoleName();

    console.log(`[${creep.name}] 角色: ${roleName}, 寻找能量源...`);

    // 1. Storage (优先级最高)
    if (config.allowStorage) {
      const storages = creep.room.find(FIND_MY_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_STORAGE &&
          (s as StructureStorage).store.getUsedCapacity(RESOURCE_ENERGY) > config.minEnergyThreshold
      });
      energySources.push(...storages);
      if (storages.length > 0) {
        console.log(`[${creep.name}] 找到 ${storages.length} 个Storage，能量: ${storages.map(s => (s as StructureStorage).store.getUsedCapacity(RESOURCE_ENERGY)).join(',')}`);
      }
    }

    // 2. Container
    if (config.allowContainers) {
      const containers = creep.room.find(FIND_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_CONTAINER &&
          (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > config.minEnergyThreshold
      });
      energySources.push(...containers);
      if (containers.length > 0) {
        console.log(`[${creep.name}] 找到 ${containers.length} 个Container，能量: ${containers.map(s => (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY)).join(',')}`);
      }
    }

    // 3. Spawn (有spawn能量保护机制)
    if (config.allowSpawn) {
      const spawns = creep.room.find(FIND_MY_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_SPAWN
      }) as StructureSpawn[];

      if (spawns.length > 0) {
        const spawn = spawns[0];
        const spawnEnergy = spawn.store.getUsedCapacity(RESOURCE_ENERGY);
        const canUseSpawn = GameConfig.canUseSpawnEnergy(creep.room, roleName);

        console.log(`[${creep.name}] Spawn能量: ${spawnEnergy}, 能否使用: ${canUseSpawn}`);

        if (canUseSpawn && spawnEnergy > config.minEnergyThreshold) {
          energySources.push(spawn);
          console.log(`[${creep.name}] 添加Spawn到能量源列表`);
        }
      }
    }

    // 4. Extension
    if (config.allowExtensions) {
      const extensions = creep.room.find(FIND_MY_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_EXTENSION &&
          (s as StructureExtension).store.getUsedCapacity(RESOURCE_ENERGY) > config.minEnergyThreshold
      });
      energySources.push(...extensions);
      if (extensions.length > 0) {
        console.log(`[${creep.name}] 找到 ${extensions.length} 个Extension，总能量: ${extensions.reduce((sum, s) => sum + (s as StructureExtension).store.getUsedCapacity(RESOURCE_ENERGY), 0)}`);
      }
    }

    // 5. 地面掉落资源
    if (config.allowDroppedResources) {
      const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
        filter: (r) => r.resourceType === RESOURCE_ENERGY &&
          r.amount > config.minEnergyThreshold
      });
      energySources.push(...droppedResources);
      if (droppedResources.length > 0) {
        console.log(`[${creep.name}] 找到 ${droppedResources.length} 个地面资源，总能量: ${droppedResources.reduce((sum, r) => sum + r.amount, 0)}`);
      }
    }

    // 6. 直接采集源
    if (config.allowDirectHarvest) {
      const sources = creep.room.find(FIND_SOURCES, {
        filter: (s) => s.energy > config.minEnergyThreshold
      });
      energySources.push(...sources);
      if (sources.length > 0) {
        console.log(`[${creep.name}] 找到 ${sources.length} 个采集源，总能量: ${sources.reduce((sum, s) => sum + s.energy, 0)}`);
      }
    }

    console.log(`[${creep.name}] 总共找到 ${energySources.length} 个能量源`);

    // 选择最近的能量源
    if (energySources.length > 0) {
      const bestSource = creep.pos.findClosestByRange(energySources);
      if (bestSource) {
        console.log(`[${creep.name}] 选择最近的能量源: ${bestSource.constructor.name}`);
      }
      return bestSource;
    }

    console.log(`[${creep.name}] 未找到任何可用的能量源`);
    return null;
  }

  /**
   * 验证能量源是否有效
   */
  protected isValidEnergySource(target: Structure | Resource | Source | null): boolean {
    if (!target) return false;

    const config = this.getEnergySourceConfig();

    // 检查结构类型
    if (target instanceof Structure) {
      // Storage检查
      if (target.structureType === STRUCTURE_STORAGE) {
        return config.allowStorage &&
          (target as StructureStorage).store.getUsedCapacity(RESOURCE_ENERGY) > config.minEnergyThreshold;
      }

      // Container检查
      if (target.structureType === STRUCTURE_CONTAINER) {
        return config.allowContainers &&
          (target as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > config.minEnergyThreshold;
      }

      // Spawn检查
      if (target.structureType === STRUCTURE_SPAWN) {
        return config.allowSpawn &&
          GameConfig.canUseSpawnEnergy(target.room, this.getRoleName()) &&
          (target as StructureSpawn).store.getUsedCapacity(RESOURCE_ENERGY) > config.minEnergyThreshold;
      }

      // Extension检查
      if (target.structureType === STRUCTURE_EXTENSION) {
        return config.allowExtensions &&
          (target as StructureExtension).store.getUsedCapacity(RESOURCE_ENERGY) > config.minEnergyThreshold;
      }
    }

    // 检查地面资源
    if (target instanceof Resource) {
      return config.allowDroppedResources &&
        target.resourceType === RESOURCE_ENERGY &&
        target.amount > config.minEnergyThreshold;
    }

    // 检查采集源
    if (target instanceof Source) {
      return config.allowDirectHarvest &&
        target.energy > config.minEnergyThreshold;
    }

    return false;
  }

  /**
   * 通用的能量获取处理逻辑
   */
  protected handleEnergyCollection(creep: Creep, target: Structure | Resource | Source): ScreepsReturnCode {
    // 结构建筑 - 使用withdraw
    if (target instanceof Structure) {
      return creep.withdraw(target, RESOURCE_ENERGY);
    }

    // 地面资源 - 使用pickup
    if (target instanceof Resource) {
      return creep.pickup(target);
    }

    // 采集源 - 使用harvest
    if (target instanceof Source) {
      return creep.harvest(target);
    }

    return ERR_INVALID_TARGET;
  }

  /**
   * 安全执行方法，包装错误处理
   */
  protected safeExecute(action: () => BehaviorResult, context: string): BehaviorResult {
    try {
      return action();
    } catch (error) {
      console.log(`[${context}] 行为执行错误: ${error}`);
      return { success: false, message: `执行错误: ${error}` };
    }
  }

  /**
   * 通用的移动到目标方法
   */
  protected moveToTarget(creep: Creep, target: RoomPosition | RoomObject): ScreepsReturnCode {
    return creep.moveTo(target, {
      visualizePathStyle: { stroke: '#ffffff' },
      reusePath: 10
    });
  }

  /**
   * 检查creep是否需要能量
   */
  protected needsEnergy(creep: Creep): boolean {
    return creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
  }

  /**
   * 检查creep是否携带能量
   */
  protected hasEnergy(creep: Creep): boolean {
    return creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
  }
}
