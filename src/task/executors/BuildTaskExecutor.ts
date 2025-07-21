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

    // 检查creep是否即将死亡
    if (this.isCreepDying(creep)) {
      return { success: true, completed: true, message: 'creep即将死亡，任务完成' };
    }

    // 检查creep是否有能量
    if (!this.hasResource(creep, RESOURCE_ENERGY)) {
      // 没有能量，去获取能量
      return this.getEnergy(creep, this.getEnergySources(task));
    } else {
      // 有能量，执行建造
      return this.performBuild(creep, task);
    }
  }

  /**
   * 获取能量源列表
   * TODO 该方法需要重构，将获取能量源的工作交给后勤系统的运输系统来解决
   */
  private getEnergySources(task: BuildTask): Structure[] {
    const sourceIds = task.params.sourceIds || [];
    const sourceStructures: Structure[] = [];

    // 如果指定了源建筑列表，优先从列表中获取
    if (sourceIds.length > 0) {
      for (const sourceId of sourceIds) {
        const source = Game.getObjectById<Structure>(sourceId as Id<Structure>);
        if (source && 'store' in source) {
          const storeStructure = source as any;
          if (storeStructure.store && storeStructure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            sourceStructures.push(source);
          }
        }
      }
    }

    return sourceStructures;
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
        return this.getEnergy(creep, this.getEnergySources(task));

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
