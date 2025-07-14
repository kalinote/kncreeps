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

    // 检查creep是否即将死亡
    if (this.isCreepDying(creep)) {
      return { success: true, completed: true, message: 'creep即将死亡，任务完成' };
    }

    // 如果creep已满，处理存储
    if (!this.hasCapacity(creep, RESOURCE_ENERGY)) {
      return this.handleStorage(creep, task);
    }

    // 获取或分配采集位置
    const harvestPosition = this.getOrAssignHarvestPosition(creep, task, source);

    if (!harvestPosition) {
      return { success: false, completed: false, message: '无可用采集位置' };
    }

    // 如果不在指定位置，先移动到指定位置
    if (!creep.pos.isEqualTo(harvestPosition)) {
      const moveResult = this.moveToTarget(creep, harvestPosition);
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
    // 如果指定了存储目标，优先使用指定目标
    if (task.params.targetId) {
      const target = Game.getObjectById<Structure>(task.params.targetId as Id<Structure>);
      if (target && 'store' in target) {
        const result = this.transferResource(creep, target, RESOURCE_ENERGY);
        if (result.success && !result.completed) {
          return { success: true, completed: false, message: '已存储到指定目标，继续采集' };
        }
        return result;
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
        return { success: true, completed: false, message: '已丢弃到指定位置，继续采集' };
      } else {
        this.moveToTarget(creep, targetPos);
        return { success: true, completed: false, message: '移动到指定丢弃点' };
      }
    }

    // 默认策略：寻找附近容器，如果没有则丢弃
    return this.findAndUseNearbyStorage(creep);
  }

  private findAndUseNearbyStorage(creep: Creep): TaskResult {
    // 搜索7x7范围内的存储设施
    const storageStructures = creep.pos.findInRange(FIND_STRUCTURES, 3, {
      filter: (structure) => {
        // 检查是否是存储设施且有空间
        if (!('store' in structure)) return false;

        const storeStructure = structure as any;
        const freeCapacity = storeStructure.store.getFreeCapacity(RESOURCE_ENERGY);

        // 优先选择容器，然后是其他存储设施
        if (structure.structureType === STRUCTURE_CONTAINER) {
          return freeCapacity > 0;
        }

        // 其他存储设施（如Storage、Extension等）
        return freeCapacity > 0;
      }
    });

    if (storageStructures.length > 0) {
      // 按优先级排序：容器优先，然后按距离排序
      storageStructures.sort((a, b) => {
        const aIsContainer = a.structureType === STRUCTURE_CONTAINER;
        const bIsContainer = b.structureType === STRUCTURE_CONTAINER;

        if (aIsContainer && !bIsContainer) return -1;
        if (!aIsContainer && bIsContainer) return 1;

        // 都是容器或都不是容器，按距离排序
        return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
      });

      const targetStructure = storageStructures[0];

      // 检查是否已经在目标旁边
      if (creep.pos.isNearTo(targetStructure)) {
        const result = this.transferResource(creep, targetStructure, RESOURCE_ENERGY);
        if (result.success && !result.completed) {
          const structureType = targetStructure.structureType;
          return {
            success: true,
            completed: false,
            message: `已存储到附近${structureType}，继续采集`
          };
        }
        return result;
      } else {
        // 移动到目标设施
        const moveResult = this.moveToTarget(creep, targetStructure);

        if (moveResult === OK || moveResult === ERR_TIRED) {
          return { success: true, completed: false, message: '移动到附近存储设施' };
        } else {
          return { success: false, completed: false, message: `移动失败: ${moveResult}` };
        }
      }
    }

    // 没有找到存储设施，丢弃能量
    creep.drop(RESOURCE_ENERGY);
    return { success: true, completed: false, message: '未找到存储设施，已丢弃能量，继续采集' };
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
