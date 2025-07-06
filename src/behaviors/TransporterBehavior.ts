import { BaseBehavior, BehaviorResult } from "./BaseBehavior";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";

/**
 * 搬运工行为状态
 */
enum TransporterState {
  MOVING_TO_PICKUP = "moving_to_pickup",
  PICKING_UP = "picking_up",
  MOVING_TO_DROP = "moving_to_drop",
  DROPPING = "dropping",
  IDLE = "idle"
}

/**
 * 搬运工行为类
 * 负责收集地上的资源、Container中的资源，并运输到需要的地方
 */
export class TransporterBehavior extends BaseBehavior {
  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  public run(creep: Creep): BehaviorResult {
    return this.safeExecute(() => {
      // 初始化creep状态
      if (!creep.memory.state) {
        creep.memory.state = TransporterState.IDLE;
      }

      const state = creep.memory.state as TransporterState;

      switch (state) {
        case TransporterState.MOVING_TO_PICKUP:
        case TransporterState.PICKING_UP:
          return this.handlePickup(creep);

        case TransporterState.MOVING_TO_DROP:
        case TransporterState.DROPPING:
          return this.handleDrop(creep);

        case TransporterState.IDLE:
        default:
          return this.decideNextAction(creep);
      }
    }, `TransporterBehavior.run(${creep.name})`);
  }

  /**
   * 决定下一步行动
   */
  private decideNextAction(creep: Creep): BehaviorResult {
    const currentEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY);
    const capacity = creep.store.getCapacity();

    console.log(`[${creep.name}] 决策: 能量 ${currentEnergy}/${capacity}`);

    if (this.needsEnergy(creep)) {
      // 需要能量，去收集
      console.log(`[${creep.name}] 需要能量，开始收集`);
      creep.memory.state = TransporterState.MOVING_TO_PICKUP;
      return this.handlePickup(creep);
    } else if (this.hasEnergy(creep)) {
      // 有能量，去运输
      console.log(`[${creep.name}] 有能量，开始运输`);
      creep.memory.state = TransporterState.MOVING_TO_DROP;
      return this.handleDrop(creep);
    } else {
      // 无事可做，等待
      console.log(`[${creep.name}] 无任务，等待中`);
      return { success: true, message: "等待任务" };
    }
  }

  /**
   * 处理收集逻辑
   */
  private handlePickup(creep: Creep): BehaviorResult {
    // 寻找最佳收集目标
    const target = this.findBestPickupTarget(creep);
    if (!target) {
      return { success: false, message: "未找到收集目标" };
    }

    // 保存目标到内存
    creep.memory.targetId = target.id;

    let pickupResult: ScreepsReturnCode;

    // 根据目标类型执行不同的收集操作
    if (target instanceof Resource) {
      pickupResult = creep.pickup(target);
    } else {
      // 从Container或其他结构中提取
      pickupResult = creep.withdraw(target as StructureContainer, RESOURCE_ENERGY);
    }

    switch (pickupResult) {
      case OK:
        creep.memory.state = TransporterState.PICKING_UP;
        // 检查是否已满
        if (creep.store.getFreeCapacity() === 0) {
          creep.memory.state = TransporterState.MOVING_TO_DROP;
          delete creep.memory.targetId; // 清除目标
        }
        return { success: true, message: "正在收集资源" };

      case ERR_NOT_IN_RANGE:
        creep.memory.state = TransporterState.MOVING_TO_PICKUP;
        this.moveToTarget(creep, target);
        return { success: true, message: "移动到收集点" };

      case ERR_NOT_ENOUGH_RESOURCES:
        // 目标资源不足，清除目标重新寻找
        delete creep.memory.targetId;
        creep.memory.state = TransporterState.IDLE;
        return { success: true, message: "目标资源不足，重新寻找" };

      case ERR_FULL:
        // 已满，去运输
        creep.memory.state = TransporterState.MOVING_TO_DROP;
        delete creep.memory.targetId;
        return { success: true, message: "已满，准备运输" };

      default:
        return { success: false, message: `收集失败: ${pickupResult}` };
    }
  }

  /**
 * 处理运输逻辑
 */
  private handleDrop(creep: Creep): BehaviorResult {
    // 检查是否还有能量可以运输
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      // 没有能量了，回到收集状态
      creep.memory.state = TransporterState.IDLE;
      return { success: true, message: "能量已清空，寻找新任务" };
    }

    // 寻找最佳运输目标
    const target = this.findBestDropTarget(creep);
    if (!target) {
      return { success: false, message: "未找到运输目标" };
    }

    const transferResult = creep.transfer(target, RESOURCE_ENERGY);

    switch (transferResult) {
      case OK:
        creep.memory.state = TransporterState.DROPPING;
        // 检查是否已清空
        if (creep.store.getUsedCapacity() === 0) {
          creep.memory.state = TransporterState.IDLE;
        }
        return { success: true, message: "正在运输资源" };

      case ERR_NOT_IN_RANGE:
        creep.memory.state = TransporterState.MOVING_TO_DROP;
        this.moveToTarget(creep, target);
        return { success: true, message: "移动到运输点" };

      case ERR_NOT_ENOUGH_RESOURCES:
        // 没有资源了，回到收集状态
        creep.memory.state = TransporterState.IDLE;
        return { success: true, message: "能量已清空，寻找新任务" };

      case ERR_FULL:
        // 目标已满，寻找其他目标
        const alternativeTarget = this.findBestDropTarget(creep, target);
        if (alternativeTarget) {
          this.moveToTarget(creep, alternativeTarget);
          return { success: true, message: "寻找其他运输点" };
        }
        return { success: false, message: "所有运输点已满" };

      default:
        return { success: false, message: `运输失败: ${transferResult}` };
    }
  }

  /**
 * 寻找最佳收集目标
 */
  private findBestPickupTarget(creep: Creep): Resource | StructureContainer | StructureStorage | null {
    // 优先使用内存中的目标
    if (creep.memory.targetId) {
      const cachedTarget = Game.getObjectById(creep.memory.targetId);
      if (cachedTarget) {
        // 检查目标是否仍然有效
        if (cachedTarget instanceof Resource && cachedTarget.amount > 0) {
          return cachedTarget;
        }
        if (cachedTarget instanceof StructureContainer &&
          cachedTarget.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          return cachedTarget;
        }
      }
      // 目标无效，清除
      delete creep.memory.targetId;
    }

    // 1. 优先收集地上的资源（矿工放置的）
    const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: resource => resource.resourceType === RESOURCE_ENERGY && resource.amount > 0
    });

    if (droppedResources.length > 0) {
      // 调试日志
      console.log(`[${creep.name}] 找到 ${droppedResources.length} 个掉落资源`);
      // 寻找最近的掉落资源
      const closest = creep.pos.findClosestByPath(droppedResources);
      if (closest) {
        console.log(`[${creep.name}] 选择掉落资源，数量: ${closest.amount}`);
        return closest;
      }
    } else {
      console.log(`[${creep.name}] 没有找到掉落资源`);
    }

    // 2. 其次收集Container中的资源
    const containers = creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return structure.structureType === STRUCTURE_CONTAINER &&
          structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
      }
    }) as StructureContainer[];

    if (containers.length > 0) {
      // 寻找最近的Container
      const closest = creep.pos.findClosestByPath(containers);
      if (closest) {
        return closest;
      }
    }

    // 3. 最后考虑从Storage中提取（如果有的话）
    const storages = creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return structure.structureType === STRUCTURE_STORAGE &&
          structure.store.getUsedCapacity(RESOURCE_ENERGY) > 1000; // 只有足够多才提取
      }
    }) as StructureStorage[];

    if (storages.length > 0) {
      return storages[0];
    }

    return null;
  }

  /**
   * 寻找最佳运输目标
   */
  private findBestDropTarget(creep: Creep, excludeTarget?: Structure): Structure | null {
    console.log(`[${creep.name}] 寻找运输目标，当前能量: ${creep.store.getUsedCapacity(RESOURCE_ENERGY)}`);

    // 优先级：Spawn > Extension > Tower > Container > Storage
    const targets = creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        if (excludeTarget && structure.id === excludeTarget.id) {
          return false;
        }

        // 高优先级：Spawn和Extension（生产用）
        if ((structure.structureType === STRUCTURE_SPAWN ||
          structure.structureType === STRUCTURE_EXTENSION) &&
          (structure as StructureSpawn | StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          return true;
        }

        // 中优先级：Tower（防御用）
        if (structure.structureType === STRUCTURE_TOWER &&
          (structure as StructureTower).store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          return true;
        }

        // 低优先级：Container和Storage（存储用）
        if ((structure.structureType === STRUCTURE_CONTAINER ||
          structure.structureType === STRUCTURE_STORAGE) &&
          (structure as StructureContainer | StructureStorage).store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          return true;
        }

        return false;
      }
    });

    console.log(`[${creep.name}] 找到 ${targets.length} 个潜在目标`);

    if (targets.length === 0) {
      console.log(`[${creep.name}] 没有找到任何可用的运输目标`);
      return null;
    }

    // 分类统计目标
    const spawns = targets.filter(t => t.structureType === STRUCTURE_SPAWN);
    const extensions = targets.filter(t => t.structureType === STRUCTURE_EXTENSION);
    const towers = targets.filter(t => t.structureType === STRUCTURE_TOWER);
    const containers = targets.filter(t => t.structureType === STRUCTURE_CONTAINER);
    const storages = targets.filter(t => t.structureType === STRUCTURE_STORAGE);

    console.log(`[${creep.name}] 目标统计 - Spawn: ${spawns.length}, Extension: ${extensions.length}, Tower: ${towers.length}, Container: ${containers.length}, Storage: ${storages.length}`);

    // 按优先级排序
    targets.sort((a, b) => {
      const priorityA = this.getStructurePriority(a);
      const priorityB = this.getStructurePriority(b);
      return priorityB - priorityA; // 降序排列
    });

    // 返回最高优先级的最近目标
    const bestTarget = creep.pos.findClosestByPath(targets.slice(0, 5)) || targets[0];
    if (bestTarget) {
      // 安全地获取空余容量
      let freeCapacity = 0;
      if (bestTarget.structureType === STRUCTURE_SPAWN ||
          bestTarget.structureType === STRUCTURE_EXTENSION ||
          bestTarget.structureType === STRUCTURE_TOWER ||
          bestTarget.structureType === STRUCTURE_CONTAINER ||
          bestTarget.structureType === STRUCTURE_STORAGE) {
        freeCapacity = (bestTarget as any).store.getFreeCapacity(RESOURCE_ENERGY);
      }
      console.log(`[${creep.name}] 选择目标: ${bestTarget.structureType}, 空余容量: ${freeCapacity}`);
    }
    return bestTarget;
  }

  /**
   * 获取结构优先级
   */
  private getStructurePriority(structure: Structure): number {
    switch (structure.structureType) {
      case STRUCTURE_SPAWN:
        return 100;
      case STRUCTURE_EXTENSION:
        return 90;
      case STRUCTURE_TOWER:
        return 80;
      case STRUCTURE_CONTAINER:
        return 30;
      case STRUCTURE_STORAGE:
        return 20;
      default:
        return 0;
    }
  }

  public canExecute(creep: Creep): boolean {
    return creep.memory.role === GameConfig.ROLES.TRANSPORTER;
  }

  public getPriority(): number {
    return 90; // 高优先级，仅次于矿工
  }

  public getName(): string {
    return "TransporterBehavior";
  }
}
