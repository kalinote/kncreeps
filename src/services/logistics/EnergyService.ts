import { EnergySource, EnergySourceConfig, EnergySourceStrategy } from "../../types";
import { GameConfig } from "../../config/GameConfig";
import { BaseService } from "../BaseService";
import { LogisticsManager } from "../../managers/LogisticsManager";
import { EventBus } from "../../core/EventBus";

/**
 * 能量服务 - 专注于能量源查找和配置管理
 */
export class EnergyService extends BaseService {
  protected onUpdate(): void {}
  protected onCleanup(): void {}
  protected onInitialize(): void {}
  protected onReset(): void {}

  constructor(eventBus: EventBus, manager: LogisticsManager, memory: any) {
    super(eventBus, manager, memory, 'energy');
  }

  /**
   * 为creep寻找能量源
   */
  public findEnergySources(creep: Creep): EnergySource[] {
    const roleName = creep.memory.role;
    // console.log(`[${creep.name}] 角色: ${roleName}, 寻找能量源...`);

    const energySources: EnergySource[] = [];

    // 1. 从Storage获取能量
    const storages = creep.room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_STORAGE &&
        'store' in s && s.store && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    }) as StructureStorage[];

    if (storages.length > 0) {
      // console.log(`[${creep.name}] 找到 ${storages.length} 个Storage，能量: ${storages.map(s => s.store.getUsedCapacity(RESOURCE_ENERGY)).join(',')}`);
      energySources.push(...storages.map(storage => ({
        type: 'storage' as const,
        object: storage,
        energy: storage.store.getUsedCapacity(RESOURCE_ENERGY),
        distance: creep.pos.getRangeTo(storage)
      })));
    }

    // 2. 从Container获取能量
    const containers = creep.room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER &&
        'store' in s && s.store && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    }) as StructureContainer[];

    if (containers.length > 0) {
      // console.log(`[${creep.name}] 找到 ${containers.length} 个Container，能量: ${containers.map(s => s.store.getUsedCapacity(RESOURCE_ENERGY)).join(',')}`);
      energySources.push(...containers.map(container => ({
        type: 'container' as const,
        object: container,
        energy: container.store.getUsedCapacity(RESOURCE_ENERGY),
        distance: creep.pos.getRangeTo(container)
      })));
    }

    // 3. 从Spawn获取能量（如果能量充足）
    const spawns = creep.room.find(FIND_MY_SPAWNS);
    for (const spawn of spawns) {
      const spawnEnergy = spawn.store.getUsedCapacity(RESOURCE_ENERGY);
      const canUseSpawn = spawnEnergy > 50; // 保留一些能量给spawn使用

      // console.log(`[${creep.name}] Spawn能量: ${spawnEnergy}, 能否使用: ${canUseSpawn}`);

      if (canUseSpawn) {
        // console.log(`[${creep.name}] 添加Spawn到能量源列表`);
        energySources.push({
          type: 'spawn' as const,
          object: spawn,
          energy: spawnEnergy,
          distance: creep.pos.getRangeTo(spawn)
        });
      }
    }

    // 4. 从Extension获取能量
    const extensions = creep.room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_EXTENSION &&
        'store' in s && s.store && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    }) as StructureExtension[];

    if (extensions.length > 0) {
      // console.log(`[${creep.name}] 找到 ${extensions.length} 个Extension，总能量: ${extensions.reduce((sum, s) => sum + s.store.getUsedCapacity(RESOURCE_ENERGY), 0)}`);
      energySources.push(...extensions.map(extension => ({
        type: 'extension' as const,
        object: extension,
        energy: extension.store.getUsedCapacity(RESOURCE_ENERGY),
        distance: creep.pos.getRangeTo(extension)
      })));
    }

    // 5. 从地面资源获取能量
    const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 10
    });

    if (droppedResources.length > 0) {
      // console.log(`[${creep.name}] 找到 ${droppedResources.length} 个地面资源，总能量: ${droppedResources.reduce((sum, r) => sum + r.amount, 0)}`);
      energySources.push(...droppedResources.map(resource => ({
        type: 'dropped' as const,
        object: resource,
        energy: resource.amount,
        distance: creep.pos.getRangeTo(resource)
      })));
    }

    // 6. 从Source获取能量（最后选择）
    const sources = creep.room.find(FIND_SOURCES, {
      filter: s => s.energy > 0
    });

    if (sources.length > 0) {
      // console.log(`[${creep.name}] 找到 ${sources.length} 个采集源，总能量: ${sources.reduce((sum, s) => sum + s.energy, 0)}`);
      energySources.push(...sources.map(source => ({
        type: 'source' as const,
        object: source,
        energy: source.energy,
        distance: creep.pos.getRangeTo(source)
      })));
    }

    // console.log(`[${creep.name}] 总共找到 ${energySources.length} 个能量源`);

    // 按距离排序，选择最近的
    energySources.sort((a, b) => a.distance - b.distance);

    if (energySources.length > 0) {
      const bestSource = energySources[0];
      // console.log(`[${creep.name}] 选择最近的能量源: ${bestSource.constructor.name}`);
      return [bestSource];
    } else {
      // console.log(`[${creep.name}] 未找到任何可用的能量源`);
      return [];
    }
  }

  /**
   * 验证能量源是否有效
   */
  public static isValidEnergySource(target: Structure | Resource | Source | null, config: EnergySourceConfig, roleName: string): boolean {
    if (!target) return false;

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
          GameConfig.canUseSpawnEnergy(target.room, roleName) &&
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
   * 检查creep是否需要能量
   */
  public static needsEnergy(creep: Creep): boolean {
    return creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
  }

  /**
   * 检查creep是否携带能量
   */
  public static hasEnergy(creep: Creep): boolean {
    return creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
  }

  /**
   * 根据策略生成能量源配置
   */
  public static getEnergySourceConfig(strategy: EnergySourceStrategy = EnergySourceStrategy.STORAGE_ONLY): EnergySourceConfig {
    switch (strategy) {
      case EnergySourceStrategy.STORAGE_ONLY:
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

      case EnergySourceStrategy.INCLUDE_GROUND:
        return {
          strategy: EnergySourceStrategy.INCLUDE_GROUND,
          allowSpawn: true,
          allowExtensions: true,
          allowContainers: true,
          allowStorage: true,
          allowDroppedResources: true,
          allowDirectHarvest: false,
          minEnergyThreshold: 0
        };

      case EnergySourceStrategy.HARVEST_DIRECT:
        return {
          strategy: EnergySourceStrategy.HARVEST_DIRECT,
          allowSpawn: false,
          allowExtensions: false,
          allowContainers: false,
          allowStorage: false,
          allowDroppedResources: true,
          allowDirectHarvest: true,
          minEnergyThreshold: 0
        };

      case EnergySourceStrategy.BALANCED:
        return {
          strategy: EnergySourceStrategy.BALANCED,
          allowSpawn: true,
          allowExtensions: true,
          allowContainers: true,
          allowStorage: true,
          allowDroppedResources: true,
          allowDirectHarvest: true,
          minEnergyThreshold: 0
        };

      default:
        return EnergyService.getEnergySourceConfig(EnergySourceStrategy.STORAGE_ONLY);
    }
  }
}
