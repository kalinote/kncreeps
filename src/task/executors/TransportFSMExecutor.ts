import { TaskStateMachine } from "../fsm/StateMachine";
import { TaskFSMMemory, TransportState, TransportTask, TaskKind, TaskType } from "../../types";
import { CreepMoveService } from "../../services/creep/CreepMoveService";
import { ManagerContainer } from "../../core/ManagerContainer";
import { TaskManager } from "managers/TaskManager";
import { TaskExecutionService } from "services/task/TaskExecutionService";

/**
 * 运输任务 FSM 执行器
 */
export class TransportFSMExecutor extends TaskStateMachine<TransportState> {
  constructor(taskMemory: TaskFSMMemory<TransportState>, service: TaskExecutionService, creep: Creep) {
    super(taskMemory, service, creep);
  }

  protected getFinishedState(): TransportState {
    return TransportState.FINISHED;
  }

  protected getInitialState(): TransportState {
    return TransportState.INIT;
  }

  protected getExpectedTaskType(): TaskType {
    return TaskType.TRANSPORT;
  }

  protected handlers() {
    return {
      [TransportState.INIT]: (creep: Creep) => {
        return this.handleInit(creep);
      },
      [TransportState.PICKUP]: (creep: Creep) => {
        return this.handlePickup(creep);
      },
      [TransportState.DELIVER]: (creep: Creep) => {
        return this.handleDeliver(creep);
      },
      [TransportState.DROPPING]: (creep: Creep) => {
        return this.handleDropping(creep);
      },
      [TransportState.FINISHED]: (creep: Creep) => {
        return this.handleFinished(creep);
      }
    };
  }

  /**
   * 初始化状态处理器
   */
  private handleInit(creep: Creep): TransportState {
    const task = this.getTask<TransportTask>(creep);
    if (!task) {
      return this.switchState(TransportState.FINISHED, '任务未找到');
    }

    // 检查creep是否即将死亡
    if (this.isCreepDying(creep)) {
      return this.switchState(TransportState.FINISHED, 'creep 即将死亡');
    }

    // 检查creep是否有目标资源
    const hasResource = this.hasResource(creep, task.params.resourceType);
    const hasAnyResource = creep.store.getUsedCapacity() > 0;

    if (!hasResource && hasAnyResource) {
      // 有其他资源但没有目标资源，先丢弃其他资源
      return this.dropOtherResources(creep, task.params.resourceType);
    }

    if (!hasResource) {
      // 没有目标资源，去拾取
      return this.switchState(TransportState.PICKUP, '没有目标资源，去拾取');
    } else {
      // 有目标资源，去传输
      return this.switchState(TransportState.DELIVER, '有目标资源，去传输');
    }
  }

  /**
   * 拾取状态处理器
   */
  private handlePickup(creep: Creep): TransportState {
    const task = this.getTask<TransportTask>(creep);
    if (!task) {
      return this.switchState(TransportState.FINISHED, '任务未找到');
    }

    const params = task.params;

    // 优先从指定建筑拾取
    if (params.sourceId) {
      const source = Game.getObjectById<Structure>(params.sourceId as Id<Structure>);
      if (!source) {
        return this.switchState(TransportState.FINISHED, '未找到源建筑');
      }

      const result = this.pickupResource(creep, source, params.resourceType);
      if (result.success) {
        // 成功拾取资源后，设置中断保护
        this.setInterruptible(false);
        return this.switchState(TransportState.DELIVER, '拾取成功');
      }
      return this.switchState(TransportState.PICKUP, '拾取失败');
    }

    // 从指定位置拾取地面资源
    if (params.sourcePos) {
      const targetPos = new RoomPosition(params.sourcePos.x, params.sourcePos.y, params.sourcePos.roomName);

      // 优先尝试拾取目标位置的资源
      const targetResources = creep.room.lookForAt(LOOK_RESOURCES, targetPos)
        .filter(r => r.resourceType === params.resourceType);

      if (targetResources.length > 0) {
        const distance = creep.pos.getRangeTo(targetPos);

        if (distance <= 1) {
          // 在拾取范围内，直接拾取目标位置的资源
          const result = this.pickupResource(creep, targetResources[0], params.resourceType);
          if (result.success) {
            this.setInterruptible(false);
            return this.switchState(TransportState.DELIVER, '拾取成功');
          }
          return this.switchState(TransportState.PICKUP, '拾取失败');
        } else {
          // 不在拾取范围内，移动到目标位置
          this.service.moveService.moveTo(creep, targetPos);
          return this.switchState(TransportState.PICKUP, '移动到目标位置');
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
            this.setInterruptible(false);
            return this.switchState(TransportState.DELIVER, '拾取成功');
          }
          return this.switchState(TransportState.PICKUP, '拾取失败');
        } else {
          // 附近没有可拾取的资源，移动到目标位置附近寻找
          if (creep.pos.getRangeTo(targetPos) > 2) {
            this.service.moveService.moveTo(creep, targetPos);
            return this.switchState(TransportState.PICKUP, '移动到目标位置');
          } else {
            return this.switchState(TransportState.FINISHED, '完成');
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
        this.setInterruptible(false);
        return this.switchState(TransportState.DELIVER, '拾取成功');
      }
      return this.switchState(TransportState.PICKUP, '拾取失败');
    }

    return this.switchState(TransportState.FINISHED, '未找到资源');
  }

  /**
   * 传输状态处理器
   */
  private handleDeliver(creep: Creep): TransportState {
    const task = this.getTask<TransportTask>(creep);
    // console.log(`[TransportFSMExecutor] handleDeliver creep: ${creep.name} task: ${JSON.stringify(task)}`);
    if (!task) {
      return this.switchState(TransportState.FINISHED, '任务未找到');
    }

    const params = task.params;
    const resourceType = params.resourceType;
    const carriedAmount = creep.store.getUsedCapacity(resourceType);

    if (carriedAmount === 0) {
      // 没有资源可传输，解除中断保护
      this.setInterruptible(true);
      return this.switchState(TransportState.FINISHED, '没有资源可传输');
    }

    // console.log(`[TransportFSMExecutor] task.params.targetId: ${params.targetId}`);

    // 优先传输到指定建筑
    if (params.targetId) {
      const target = Game.getObjectById<Structure>(params.targetId as Id<Structure>);
      // console.log(`[TransportFSMExecutor] target: ${JSON.stringify(target)}`);
      if (!target) {
        // 目标不存在，解除中断保护
        this.setInterruptible(true);
        return this.switchState(TransportState.FINISHED, '未找到目标建筑');
      }

      // console.log(`[TransportFSMExecutor] creep.pos.getRangeTo(target.pos): ${creep.pos.getRangeTo(target.pos)}`);

      // 移动到指定建筑
      if (creep.pos.getRangeTo(target.pos) > 1) {
        this.service.moveService.moveTo(creep, target.pos);
      } else {
        const result = this.transferResource(creep, target, resourceType);
        // console.log(`[TransportFSMExecutor] result: ${JSON.stringify(result)}`);
        if (result.success && result.completed) {
          // 成功传输资源后，解除中断保护
          this.setInterruptible(true);
          return this.switchState(TransportState.FINISHED, '传输成功');
        }
      }
      return this.switchState(TransportState.DELIVER, '移动到目标建筑');
    }

    // 传输到指定位置
    if (params.targetPos) {
      const targetPos = new RoomPosition(params.targetPos.x, params.targetPos.y, params.targetPos.roomName);

      // 检查是否已经到达目标位置
      if (creep.pos.isEqualTo(targetPos)) {
        // 已在目标位置，直接丢弃资源并解除中断保护
        creep.drop(resourceType);
        this.setInterruptible(true);
        return this.switchState(TransportState.FINISHED, '到达目标位置');
      }

      // 移动到目标位置
      this.service.moveService.moveTo(creep, targetPos);
      return this.switchState(TransportState.DELIVER, '移动到目标位置');
    }

    // 默认：在当前位置丢弃并解除中断保护
    creep.drop(resourceType);
    this.setInterruptible(true);
    return this.switchState(TransportState.FINISHED, '完成');
  }

  /**
   * 丢弃状态处理器
   */
  private handleDropping(creep: Creep): TransportState {
    const task = this.getTask<TransportTask>(creep);
    if (!task) {
      return this.switchState(TransportState.FINISHED, '任务未找到');
    }

    // 丢弃其他资源
    for (const resourceType in creep.store) {
      if (resourceType !== task.params.resourceType && resourceType !== RESOURCE_ENERGY) {
        creep.drop(resourceType as ResourceConstant);
      }
    }

    return this.switchState(TransportState.INIT, '丢弃其他资源');
  }

  /**
   * 完成状态处理器
   */
  private handleFinished(creep: Creep): TransportState {
    // 清理任何剩余的中断保护状态
    this.setInterruptible(true);
    return this.switchState(TransportState.FINISHED, this.getRecord()?.reason || '完成，没有记录原因');
  }

  /**
   * 检查creep是否携带指定资源
   */
  private hasResource(creep: Creep, resourceType: ResourceConstant): boolean {
    return creep.store.getUsedCapacity(resourceType) > 0;
  }

  /**
   * 丢弃其他资源
   */
  private dropOtherResources(creep: Creep, keepResourceType: ResourceConstant): TransportState {
    for (const resourceType in creep.store) {
      if (resourceType !== keepResourceType && resourceType !== RESOURCE_ENERGY) {
        creep.drop(resourceType as ResourceConstant);
      }
    }
    return this.switchState(TransportState.INIT, '已丢弃其他资源');
  }

  /**
   * 拾取资源
   */
  private pickupResource(creep: Creep, target: Resource | Structure | Source, resourceType: ResourceConstant): { success: boolean; completed: boolean } {
    // 检查目标类型并执行相应的拾取操作
    if (target instanceof Resource) {
      // 地面资源
      if (target.resourceType !== resourceType) {
        return { success: false, completed: false };
      }

      const pickupResult = creep.pickup(target);
      return this.handlePickupResult(pickupResult);
    } else if (target instanceof Structure) {
      // 建筑资源
      if (!('store' in target)) {
        return { success: false, completed: false };
      }

      const storeStructure = target as any;
      if (storeStructure.store.getUsedCapacity(resourceType) === 0) {
        return { success: false, completed: false };
      }

      const withdrawResult = creep.withdraw(target, resourceType);
      return this.handleWithdrawResult(withdrawResult);
    } else if (target instanceof Source) {
      // 采集源
      if (resourceType !== RESOURCE_ENERGY) {
        return { success: false, completed: false };
      }

      const harvestResult = creep.harvest(target);
      return this.handleHarvestResult(harvestResult);
    }

    return { success: false, completed: false };
  }

  /**
   * 传输资源
   */
  private transferResource(creep: Creep, target: Structure, resourceType: ResourceConstant): { success: boolean; completed: boolean } {
    if (!('store' in target)) {
      return { success: false, completed: false };
    }

    const transferResult = creep.transfer(target, resourceType);
    return this.handleTransferResult(transferResult);
  }

  /**
   * 处理拾取结果
   */
  private handlePickupResult(result: ScreepsReturnCode): { success: boolean; completed: boolean } {
    switch (result) {
      case OK:
        return { success: true, completed: true };
      case ERR_NOT_IN_RANGE:
        return { success: true, completed: false };
      case ERR_FULL:
        return { success: true, completed: false };
      case ERR_INVALID_TARGET:
        return { success: false, completed: true };
      default:
        return { success: false, completed: false };
    }
  }

  /**
   * 处理取用结果
   */
  private handleWithdrawResult(result: ScreepsReturnCode): { success: boolean; completed: boolean } {
    switch (result) {
      case OK:
        return { success: true, completed: true };
      case ERR_NOT_IN_RANGE:
        return { success: true, completed: false };
      case ERR_NOT_ENOUGH_RESOURCES:
        return { success: false, completed: false };
      case ERR_INVALID_TARGET:
        return { success: false, completed: true };
      default:
        return { success: false, completed: false };
    }
  }

  /**
   * 处理采集结果
   */
  private handleHarvestResult(result: ScreepsReturnCode): { success: boolean; completed: boolean } {
    switch (result) {
      case OK:
        return { success: true, completed: true };
      case ERR_NOT_IN_RANGE:
        return { success: true, completed: false };
      case ERR_NOT_ENOUGH_RESOURCES:
        return { success: true, completed: false };
      case ERR_BUSY:
        return { success: true, completed: false };
      default:
        return { success: false, completed: false };
    }
  }

  /**
   * 处理传输结果
   */
  private handleTransferResult(result: ScreepsReturnCode): { success: boolean; completed: boolean } {
    switch (result) {
      case OK:
        return { success: true, completed: true };
      case ERR_NOT_IN_RANGE:
        return { success: true, completed: false };
      case ERR_FULL:
        return { success: false, completed: true };
      case ERR_INVALID_TARGET:
        return { success: false, completed: true };
      default:
        return { success: false, completed: false };
    }
  }
}
