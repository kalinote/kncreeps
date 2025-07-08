import { BaseTaskExecutor } from "./BaseTaskExecutor";
import { Task, TaskResult, CapabilityRequirement, TaskType, HarvestTask } from "../../types";

/**
 * 采集任务执行器
 */
export class HarvestTaskExecutor extends BaseTaskExecutor {

  public canExecute(creep: Creep, task: Task): boolean {
    if (task.type !== TaskType.HARVEST) return false;
    return this.checkCapabilities(creep);
  }

  public execute(creep: Creep, task: Task): TaskResult {
    if (task.type !== TaskType.HARVEST) {
      return { success: false, completed: false, message: '任务类型不匹配' };
    }

    const harvestTask = task as HarvestTask;

    return this.safeExecute(() => {
      return this.executeHarvest(creep, harvestTask);
    }, `HarvestTaskExecutor.execute(${creep.name})`);
  }

  private executeHarvest(creep: Creep, task: HarvestTask): TaskResult {
    // 获取目标源
    const source = Game.getObjectById<Source>(task.params.sourceId as Id<Source>);
    if (!source || source.energy === 0) {
      return { success: false, completed: true, message: '源不存在，任务完成' };
    }

    // 如果creep即将死亡，完成任务让其他creep接管
    if (creep.ticksToLive && creep.ticksToLive < 50) {
      return { success: true, completed: true, message: 'creep即将死亡，任务完成' };
    }

    // 如果creep已满，处理存储
    if (creep.store.getFreeCapacity() === 0) {
      return this.handleStorage(creep, task);
    }

    // 执行采集
    const harvestResult = creep.harvest(source);

    switch (harvestResult) {
      case OK:
        return { success: true, completed: false, message: '正在采集' };

      case ERR_NOT_IN_RANGE:
        this.moveToTarget(creep, source);
        return { success: true, completed: false, message: '移动到源点' };

      case ERR_NOT_ENOUGH_RESOURCES:
        // 源暂时枯竭，等待恢复
        return { success: true, completed: false, message: '等待源恢复' };

      case ERR_BUSY:
        return { success: true, completed: false, message: '等待孵化完成' };

      default:
        return { success: false, completed: false, message: `采集失败: ${harvestResult}` };
    }
  }

  private handleStorage(creep: Creep, task: HarvestTask): TaskResult {
    // 如果指定了存储目标
    if (task.params.targetId) {
      const target = Game.getObjectById<Structure>(task.params.targetId as Id<Structure>);
      if (target && 'store' in target) {
        const transferResult = creep.transfer(target, RESOURCE_ENERGY);

        switch (transferResult) {
          case OK:
            // 修改：存储成功后不完成任务，继续采集
            return { success: true, completed: false, message: '已存储，继续采集' };

          case ERR_NOT_IN_RANGE:
            this.moveToTarget(creep, target);
            return { success: true, completed: false, message: '移动到存储点' };

          case ERR_FULL:
            // 存储已满，尝试丢弃
            creep.drop(RESOURCE_ENERGY);
            return { success: true, completed: false, message: '存储已满，已丢弃，继续采集' };

          default:
            return { success: false, completed: false, message: `存储失败: ${transferResult}` };
        }
      }
    }

    // 如果指定了目标位置，移动到该位置并丢弃
    if (task.params.targetPos) {
      const targetPos = new RoomPosition(
        task.params.targetPos.x,
        task.params.targetPos.y,
        task.params.targetPos.roomName
      );

      if (creep.pos.isEqualTo(targetPos)) {
        creep.drop(RESOURCE_ENERGY);
        // 修改：丢弃后不完成任务，继续采集
        return { success: true, completed: false, message: '已丢弃，继续采集' };
      } else {
        creep.moveTo(targetPos);
        return { success: true, completed: false, message: '移动到丢弃点' };
      }
    }

    // 默认：在当前位置丢弃
    creep.drop(RESOURCE_ENERGY);
    // 修改：丢弃后不完成任务，继续采集
    return { success: true, completed: false, message: '已丢弃，继续采集' };
  }

  public getRequiredCapabilities(): CapabilityRequirement[] {
    return [
      { bodyPart: WORK, minCount: 1, weight: 3 },
      { bodyPart: CARRY, minCount: 1, weight: 2 },
      { bodyPart: MOVE, minCount: 1, weight: 1 }
    ];
  }

  public getTaskTypeName(): string {
    return 'HARVEST';
  }
}
