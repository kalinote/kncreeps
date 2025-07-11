import { BaseTaskExecutor } from "./BaseTaskExecutor";
import { Task, TaskResult, CapabilityRequirement, TaskType, HarvestTask } from "../../types";
import { SourceAnalyzer } from "../../utils/SourceAnalyzer";

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

    // 获取或分配采集位置
    const harvestPosition = this.getOrAssignHarvestPosition(creep, task, source);

    if (!harvestPosition) {
      return { success: false, completed: false, message: '无可用采集位置' };
    }

      // 如果不在指定位置，先移动到指定位置
    if (!creep.pos.isEqualTo(harvestPosition)) {
      const moveResult = creep.moveTo(harvestPosition);
        if (moveResult === OK || moveResult === ERR_TIRED) {
        return { success: true, completed: false, message: '移动到采集位置' };
        } else {
          return { success: false, completed: false, message: `移动到采集位置失败: ${moveResult}` };
      }
    }

    // 执行采集
    const harvestResult = creep.harvest(source);

    switch (harvestResult) {
      case OK:
        return { success: true, completed: false, message: '正在采集' };

      case ERR_NOT_IN_RANGE:
        // 重新计算位置，可能被其他creep占用了
        this.clearAssignedPosition(creep);
        return { success: true, completed: false, message: '重新寻找采集位置' };

      case ERR_NOT_ENOUGH_RESOURCES:
        // 源暂时枯竭，等待恢复
        return { success: true, completed: false, message: '等待源恢复' };

      case ERR_BUSY:
        return { success: true, completed: false, message: '等待孵化完成' };

      default:
        return { success: false, completed: false, message: `采集失败: ${harvestResult}` };
    }
  }

  /**
   * 获取或分配采集位置
   */
  private getOrAssignHarvestPosition(creep: Creep, task: HarvestTask, source: Source): RoomPosition | null {
    // 如果任务指定了固定位置，使用指定位置
    if (task.params.harvestPosition) {
      return new RoomPosition(
        task.params.harvestPosition.x,
        task.params.harvestPosition.y,
        task.params.harvestPosition.roomName
      );
    }

    // 检查creep是否已经有分配的位置
    if (creep.memory.assignedHarvestPos) {
      const assignedPos = creep.memory.assignedHarvestPos;
      const position = new RoomPosition(assignedPos.x, assignedPos.y, assignedPos.roomName);

      // 验证位置是否仍然有效（没有被其他creep占用）
      if (this.isPositionAvailable(position, creep.name)) {
        return position;
      } else {
        // 位置已被占用，清除并重新分配
        this.clearAssignedPosition(creep);
      }
    }

    // 动态分配新的采集位置
    return this.assignNewHarvestPosition(creep, source);
  }

  /**
   * 为creep分配新的采集位置
   */
  private assignNewHarvestPosition(creep: Creep, source: Source): RoomPosition | null {
    // 获取source周围的所有可用位置
    const sourceStats = SourceAnalyzer.getRoomSourceStats([source]);
    const sourceDetail = sourceStats.sourceDetails[0];

    if (!sourceDetail || sourceDetail.positions.length === 0) {
      return null;
    }

    // 找到可用的采集位置（没有被其他creep占用）
    for (const position of sourceDetail.positions) {
      const roomPos = new RoomPosition(position.x, position.y, position.roomName);

      if (this.isPositionAvailable(roomPos, creep.name)) {
        // 分配这个位置给creep
        creep.memory.assignedHarvestPos = {
          x: position.x,
          y: position.y,
          roomName: position.roomName
        };
        return roomPos;
      }
    }

    return null; // 所有位置都被占用
  }

  /**
   * 检查位置是否可用（没有被其他creep占用）
   */
  private isPositionAvailable(position: RoomPosition, excludeCreepName: string): boolean {
    // 检查位置上是否有其他creep
    const creepsAtPosition = position.lookFor(LOOK_CREEPS);
    const hasOtherCreep = creepsAtPosition.some(c => c.name !== excludeCreepName);

    if (hasOtherCreep) {
      return false;
    }

    // 检查是否有其他creep也被分配到了这个位置
    for (const creepName in Game.creeps) {
      if (creepName === excludeCreepName) continue;

      const otherCreep = Game.creeps[creepName];
      if (otherCreep.memory.assignedHarvestPos) {
        const assignedPos = otherCreep.memory.assignedHarvestPos;
        if (assignedPos.x === position.x &&
            assignedPos.y === position.y &&
            assignedPos.roomName === position.roomName) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 清除creep的分配位置
   */
  private clearAssignedPosition(creep: Creep): void {
    delete creep.memory.assignedHarvestPos;
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
