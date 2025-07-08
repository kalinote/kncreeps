import { BaseTaskExecutor } from "./BaseTaskExecutor";
import { Task, TaskResult, CapabilityRequirement, TaskType, BuildTask } from "../../types";

/**
 * 建筑任务执行器
 */
export class BuildTaskExecutor extends BaseTaskExecutor {
  public canExecute(creep: Creep, task: Task): boolean {
    if (task.type !== TaskType.BUILD) return false;
    return this.checkCapabilities(creep);
  }

  public execute(creep: Creep, task: Task): TaskResult {
    if (task.type !== TaskType.BUILD) {
      return { success: false, completed: false, message: '任务类型不匹配' };
    }

    const buildTask = task as BuildTask;

    return this.safeExecute(() => {
      return this.executeBuild(creep, buildTask);
    }, `BuildTaskExecutor.execute(${creep.name})`);
  }

  public executeBuild(creep: Creep, task: BuildTask): TaskResult {
    // 获取目标建筑，检查是否存在
    const target = Game.getObjectById<ConstructionSite>(task.params.targetId as Id<ConstructionSite>);
    if (!target) {
      return { success: false, completed: true, message: '目标建筑不存在，任务完成' };
    }

    // 如果creep即将死亡，完成任务让其他creep接管
    if (creep.ticksToLive && creep.ticksToLive < 50) {
      return { success: true, completed: true, message: 'creep即将死亡，任务完成' };
    }

    // 检查creep是否有能量
    const energyAmount = creep.store.getUsedCapacity(RESOURCE_ENERGY);
    const hasEnergy = energyAmount > 0;

    if (!hasEnergy) {
      // 没有能量，去获取能量
      return this.getEnergy(creep, task);
    } else {
      // 有能量，执行建造
      return this.performBuild(creep, task);
    }
  }

  /**
   * 获取能量
   */
  private getEnergy(creep: Creep, task: BuildTask): TaskResult {
    const sourceIds = task.params.sourceConstructionIds || [];

    // 如果指定了源建筑列表，优先从列表中获取
    if (sourceIds.length > 0) {
      for (const sourceId of sourceIds) {
        const source = Game.getObjectById<Structure>(sourceId as Id<Structure>);
        if (source && 'store' in source) {
          const storeStructure = source as any;
          if (storeStructure.store && storeStructure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            const withdrawResult = creep.withdraw(source, RESOURCE_ENERGY);

            switch (withdrawResult) {
              case OK:
                return { success: true, completed: false, message: '正在从指定建筑获取能量' };
              case ERR_NOT_IN_RANGE:
                this.moveToTarget(creep, source);
                return { success: true, completed: false, message: '移动到指定能量源' };
              case ERR_NOT_ENOUGH_RESOURCES:
                continue; // 尝试下一个源
              case ERR_FULL:
                return { success: true, completed: false, message: 'creep已满，开始建造' };
              default:
                continue; // 尝试下一个源
            }
          }
        }
      }
    }

    // 从任意符合条件的建筑中获取能量
    const energyStructures = creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        if (!('store' in structure)) return false;
        const storeStructure = structure as any;
        return storeStructure.store && storeStructure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
      }
    });

    if (energyStructures.length > 0) {
      // 选择最近的能量建筑
      const closestStructure = creep.pos.findClosestByPath(energyStructures);
      if (closestStructure) {
        const withdrawResult = creep.withdraw(closestStructure, RESOURCE_ENERGY);

        switch (withdrawResult) {
          case OK:
            return { success: true, completed: false, message: '正在从建筑获取能量' };
          case ERR_NOT_IN_RANGE:
            this.moveToTarget(creep, closestStructure);
            return { success: true, completed: false, message: '移动到能量建筑' };
          case ERR_FULL:
            return { success: true, completed: false, message: 'creep已满，开始建造' };
          default:
            return { success: false, completed: false, message: `获取能量失败: ${withdrawResult}` };
        }
      }
    }

    // 尝试从地面拾取能量
    const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: (resource) => resource.resourceType === RESOURCE_ENERGY
    });

    if (droppedEnergy.length > 0) {
      const closestEnergy = creep.pos.findClosestByPath(droppedEnergy);
      if (closestEnergy) {
        const pickupResult = creep.pickup(closestEnergy);

        switch (pickupResult) {
          case OK:
            return { success: true, completed: false, message: '正在拾取地面能量' };
          case ERR_NOT_IN_RANGE:
            this.moveToTarget(creep, closestEnergy);
            return { success: true, completed: false, message: '移动到地面能量' };
          case ERR_FULL:
            return { success: true, completed: false, message: 'creep已满，开始建造' };
          default:
            return { success: false, completed: false, message: `拾取能量失败: ${pickupResult}` };
        }
      }
    }

    return { success: false, completed: false, message: '找不到可用的能量源' };
  }

  /**
   * 执行建造
   */
  private performBuild(creep: Creep, task: BuildTask): TaskResult {
    const target = Game.getObjectById<ConstructionSite>(task.params.targetId as Id<ConstructionSite>);
    if (!target) {
      return { success: false, completed: true, message: '目标建筑不存在，任务完成' };
    }

    const buildResult = creep.build(target);

    switch (buildResult) {
      case OK:
        return { success: true, completed: false, message: '正在建造' };

      case ERR_NOT_IN_RANGE:
        this.moveToTarget(creep, target);
        return { success: true, completed: false, message: '移动到建造目标' };

      case ERR_INVALID_TARGET:
        return { success: false, completed: true, message: '无效的建造目标，任务完成' };

      case ERR_NOT_ENOUGH_RESOURCES:
        // 能量不足，重新获取能量
        return this.getEnergy(creep, task);

      case ERR_BUSY:
        return { success: true, completed: false, message: '目标正在被其他creep建造' };

      default:
        return { success: false, completed: false, message: `建造失败: ${buildResult}` };
    }
  }

  public getRequiredCapabilities(): CapabilityRequirement[] {
    return [
      { bodyPart: WORK, minCount: 1, weight: 3 },
      { bodyPart: CARRY, minCount: 1, weight: 2 },
      { bodyPart: MOVE, minCount: 1, weight: 1 }
    ];
  }

  public getTaskTypeName(): string {
    return 'BUILD';
  }

}
