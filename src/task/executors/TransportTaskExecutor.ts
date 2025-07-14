import { BaseTaskExecutor } from "./BaseTaskExecutor";
import { Task, TaskResult, CapabilityRequirement, TaskType, TransportTask } from "../../types";

/**
 * 运输任务执行器
 * 负责在指定位置、建筑间运输资源
 */
export class TransportTaskExecutor extends BaseTaskExecutor {

  public canExecute(creep: Creep, task: Task): boolean {
    if (task.type !== TaskType.TRANSPORT) return false;
    return this.checkCapabilities(creep);
  }

  public execute(creep: Creep, task: Task): TaskResult {
    if (task.type !== TaskType.TRANSPORT) {
      return { success: false, completed: false, message: '任务类型不匹配' };
    }

    const transportTask = task as TransportTask;

    return this.safeExecute(() => {
      return this.executeTransport(creep, transportTask);
    }, `TransportTaskExecutor.execute(${creep.name})`);
  }

  private executeTransport(creep: Creep, task: TransportTask): TaskResult {
    const resourceType = task.params.resourceType;

    // 如果creep即将死亡，完成任务让其他creep接管
    if (this.isCreepDying(creep)) {
      return { success: true, completed: true, message: 'creep即将死亡，任务完成' };
    }

    // 检查creep是否有目标资源
    const hasResource = this.hasResource(creep, resourceType);
    const hasAnyResource = creep.store.getUsedCapacity() > 0;

    // 初始化中断保护状态
    if (creep.memory.canBeInterrupted === undefined) {
      creep.memory.canBeInterrupted = true;
    }

    if (!hasResource && hasAnyResource) {
      // 有其他资源但没有目标资源，先丢弃其他资源
      return this.dropOtherResources(creep, resourceType);
    }

    if (!hasResource) {
      // 没有目标资源，去拾取
      return this.pickupResourceFromTask(creep, task);
    } else {
      // 有目标资源，去传输
      return this.deliverResource(creep, task);
    }
  }

  /**
   * 拾取资源
   */
  private pickupResourceFromTask(creep: Creep, task: TransportTask): TaskResult {
    const params = task.params;

    // 优先从指定建筑拾取
    if (params.sourceId) {
      const source = Game.getObjectById<Structure>(params.sourceId as Id<Structure>);
      if (!source) {
        return { success: false, completed: true, message: '源建筑不存在，任务完成' };
      }

      // 使用基类的通用拾取方法
      const result = this.pickupResource(creep, source, params.resourceType);
      if (result.success) {
        // 成功拾取资源后，设置中断保护
        creep.memory.canBeInterrupted = false;
      }
      return result;
    }

    // 从指定位置拾取地面资源
    if (params.sourcePos) {
      const targetPos = new RoomPosition(params.sourcePos.x, params.sourcePos.y, params.sourcePos.roomName);

      // 优先尝试拾取目标位置的资源（确保是正确的资源）
      const targetResources = creep.room.lookForAt(LOOK_RESOURCES, targetPos)
        .filter(r => r.resourceType === params.resourceType);

      if (targetResources.length > 0) {
        // 目标位置有资源，检查是否在拾取范围内
        const distance = creep.pos.getRangeTo(targetPos);

        if (distance <= 1) {
          // 在拾取范围内，直接拾取目标位置的资源
          const result = this.pickupResource(creep, targetResources[0], params.resourceType);
          if (result.success) {
            // 成功拾取资源后，设置中断保护
            creep.memory.canBeInterrupted = false;
          }
          return result;
        } else {
          // 不在拾取范围内，使用智能移动（灵活范围）
          const moveResult = this.smartMoveToTarget(creep, targetPos, false);
          return { success: moveResult.success, completed: false, message: moveResult.message };
        }
      } else {
        // 目标位置没有资源，在附近寻找相同类型的资源
        const nearbyResources = creep.room.lookForAtArea(
          LOOK_RESOURCES,
          Math.max(0, targetPos.y - 2),
          Math.max(0, targetPos.x - 2),
          Math.min(49, targetPos.y + 2),
          Math.min(49, targetPos.x + 2),
          true
        ).filter(item =>
          item.resource.resourceType === params.resourceType &&
          creep.pos.getRangeTo(item.x, item.y) <= 1
        );

        if (nearbyResources.length > 0) {
          // 按距离目标位置排序，优先拾取最接近目标的资源
          nearbyResources.sort((a, b) =>
            targetPos.getRangeTo(a.x, a.y) - targetPos.getRangeTo(b.x, b.y)
          );

          const result = this.pickupResource(creep, nearbyResources[0].resource, params.resourceType);
          if (result.success) {
            // 成功拾取资源后，设置中断保护
            creep.memory.canBeInterrupted = false;
          }
          return result;
        } else {
          // 附近没有可拾取的资源，移动到目标位置附近寻找
          if (creep.pos.getRangeTo(targetPos) > 2) {
            const moveResult = this.smartMoveToTarget(creep, targetPos, false);
            return { success: moveResult.success, completed: false, message: `移动寻找资源: ${moveResult.message}` };
          } else {
            return { success: false, completed: true, message: '目标区域没有指定资源，任务完成' };
          }
        }
      }
    }

    // 从当前位置拾取资源
    const nearbyResources = creep.room.lookForAt(LOOK_RESOURCES, creep.pos)
      .filter(r => r.resourceType === params.resourceType);

    if (nearbyResources.length > 0) {
      const result = this.pickupResource(creep, nearbyResources[0], params.resourceType);
      if (result.success) {
        // 成功拾取资源后，设置中断保护
        creep.memory.canBeInterrupted = false;
      }
      return result;
    }

    return { success: false, completed: true, message: '找不到指定资源，任务完成' };
  }

  /**
   * 传输资源
   */
  private deliverResource(creep: Creep, task: TransportTask): TaskResult {
    const params = task.params;
    const resourceType = params.resourceType;
    const carriedAmount = creep.store.getUsedCapacity(resourceType);

    if (carriedAmount === 0) {
      // 没有资源可传输，解除中断保护
      creep.memory.canBeInterrupted = true;
      return { success: false, completed: true, message: '没有资源可传输，任务完成' };
    }

    // 优先传输到指定建筑
    if (params.targetId) {
      const target = Game.getObjectById<Structure>(params.targetId as Id<Structure>);
      if (!target) {
        // 目标不存在，解除中断保护
        creep.memory.canBeInterrupted = true;
        return { success: false, completed: true, message: '目标建筑不存在，任务完成' };
      }

      // 使用基类的通用传输方法
      const result = this.transferResource(creep, target, resourceType);
      if (result.success && result.completed) {
        // 成功传输资源后，解除中断保护
        creep.memory.canBeInterrupted = true;
      }
      return result;
    }

    // 传输到指定位置
    if (params.targetPos) {
      const targetPos = new RoomPosition(params.targetPos.x, params.targetPos.y, params.targetPos.roomName);

      // 检查是否已经到达目标位置
      if (creep.pos.isEqualTo(targetPos)) {
        // 已在目标位置，直接丢弃资源并解除中断保护
        creep.drop(resourceType);
        creep.memory.canBeInterrupted = true;
        return { success: true, completed: true, message: '资源已精确丢弃到目标位置，任务完成' };
      }

      // 使用智能移动尝试到达精确位置
      const moveResult = this.smartMoveToTarget(creep, targetPos, true);

      if (!moveResult.success) {
        // 无法到达精确位置，在当前位置丢弃并解除中断保护
        creep.drop(resourceType);
        creep.memory.canBeInterrupted = true;
        return { success: true, completed: true, message: `无法到达目标位置，已在当前位置丢弃资源: ${moveResult.message}` };
      }

      // 检查是否在传输范围内（可以丢弃）
      const distance = creep.pos.getRangeTo(targetPos);
      if (distance <= 1) {
        // 在范围内，可以丢弃资源并解除中断保护
        creep.drop(resourceType);
        creep.memory.canBeInterrupted = true;
        return { success: true, completed: true, message: `资源已丢弃到目标附近 (距离${distance})，任务完成` };
      } else {
        // 继续移动
        return { success: true, completed: false, message: moveResult.message };
      }
    }

    // 默认：在当前位置丢弃并解除中断保护
    creep.drop(resourceType);
    creep.memory.canBeInterrupted = true;
    return { success: true, completed: true, message: '资源已丢弃，任务完成' };
  }

  /**
   * 丢弃其他资源
   */
  private dropOtherResources(creep: Creep, keepResourceType: ResourceConstant): TaskResult {
    for (const resourceType in creep.store) {
      if (resourceType !== keepResourceType && resourceType !== RESOURCE_ENERGY) {
        creep.drop(resourceType as ResourceConstant);
      }
    }
    return { success: true, completed: false, message: '已丢弃其他资源' };
  }

  public getRequiredCapabilities(): CapabilityRequirement[] {
    return [
      { bodyPart: CARRY, minCount: 1, weight: 3 },
      { bodyPart: MOVE, minCount: 1, weight: 2 }
    ];
  }

  public getTaskTypeName(): string {
    return 'TRANSPORT';
  }
}
