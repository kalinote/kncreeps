import { TaskStateMachine } from "../fsm/StateMachine";
import { StateHandlers, TaskType, UpgradeState, UpgradeTask } from "../../types";
import { TaskFSMMemory } from "../../types";
import { TaskExecutionService } from "services/task/TaskExecutionService";

export class UpgradeFSMExecutor extends TaskStateMachine<UpgradeState> {
  constructor(taskMemory: TaskFSMMemory<UpgradeState>, service: TaskExecutionService, creep: Creep) {
    super(taskMemory, service, creep);
  }

  protected getFinishedState(): UpgradeState {
    return UpgradeState.FINISHED;
  }

  protected getInitialState(): UpgradeState {
    return UpgradeState.INIT;
  }

  protected getExpectedTaskType(): TaskType {
    return TaskType.UPGRADE;
  }

  protected handlers(): StateHandlers<UpgradeState> {
    return {
      [UpgradeState.INIT]: (creep: Creep) => {
        return this.handleInit(creep);
      },
      [UpgradeState.GET_ENERGY]: (creep: Creep) => {
        return this.handleGetEnergy(creep);
      },
      [UpgradeState.WAIT_SUPPLY]: (creep: Creep) => {
        return this.handleWaitSupply(creep);
      },
      [UpgradeState.UPGRADING]: (creep: Creep) => {
        return this.handleUpgrading(creep);
      },
      [UpgradeState.FINISHED]: (creep: Creep) => {
        return this.handleFinished(creep);
      }
    };
  }

  /**
   * 初始化状态处理器
   */
  private handleInit(creep: Creep): UpgradeState {
    const task = this.getTask<UpgradeTask>(creep);
    if (!task) {
      return this.switchState(UpgradeState.FINISHED, '任务未找到');
    }

    // 检查 creep 是否即将过世
    if (this.isCreepDying(creep)) {
      return this.switchState(UpgradeState.FINISHED, 'creep 即将死亡');
    }

    // 判断身上是否已有能量
    const hasEnergy = this.hasResource(creep, RESOURCE_ENERGY);

    // 如果身上带的是其他资源，先丢弃
    if (!hasEnergy && creep.store.getUsedCapacity() > 0) {
      return this.dropOtherResources(creep, RESOURCE_ENERGY);
    }

    // 已有能量，直接进行升级
    if (hasEnergy) {
      return this.switchState(UpgradeState.UPGRADING, '身上已有能量，直接升级');
    }

    // 需要获取能量
    return this.switchState(UpgradeState.GET_ENERGY, '身上无能量');
  }

  /**
   * 获取能量状态处理器
   */
  private handleGetEnergy(creep: Creep): UpgradeState {
    const task = this.getTask<UpgradeTask>(creep);
    if (!task) {
      return this.switchState(UpgradeState.FINISHED, '任务未找到');
    }

    // 如果已经有能量，进入升级状态
    if (this.hasResource(creep, RESOURCE_ENERGY)) {
      return this.switchState(UpgradeState.UPGRADING, '身上已有能量，直接升级');
    }

    // 计算需要的能量数量
    const need = creep.store.getFreeCapacity(RESOURCE_ENERGY);
    if (need === 0) {
      return this.switchState(UpgradeState.UPGRADING, '能量已满');
    }

    // 请求资源供应并转入等待状态
    const { requestId, suggestedWait } = this.service.supplyService.request(creep, RESOURCE_ENERGY, need);

    // 在 creep 状态记录中保存等待信息
    this.setCreepContext('supplyRequestId', requestId);
    this.setCreepContext('waitUntil', Game.time + suggestedWait);

    return this.switchState(UpgradeState.WAIT_SUPPLY, `请求能量供应，等待 ${suggestedWait} tick`);
  }

  /**
   * 等待资源供应状态处理器
   */
  private handleWaitSupply(creep: Creep): UpgradeState {
    // 检查是否已经收到资源
    if (this.hasResource(creep, RESOURCE_ENERGY)) {
      // 取消请求并转入升级状态
      this.service.supplyService.cancel(creep, RESOURCE_ENERGY);
      return this.switchState(UpgradeState.UPGRADING, '收到能量，开始升级');
    }

    const waitUntil = this.getCreepContext().waitUntil || 0;

    // 检查是否超时
    if (Game.time >= waitUntil) {
      // 超时，尝试自取资源
      const need = creep.store.getFreeCapacity(RESOURCE_ENERGY);
      const selfFetchPlan = this.service.supplyService.suggestSelfFetchPlan(creep, RESOURCE_ENERGY, need);

      if (selfFetchPlan) {
        // 取消供应请求
        this.service.supplyService.cancel(creep, RESOURCE_ENERGY);

        // 执行自取计划
        if (selfFetchPlan.sourceId) {
          const target = Game.getObjectById(selfFetchPlan.sourceId as Id<Structure | Resource | Source>);
          if (target) {
            return this.pickupResource(creep, target, RESOURCE_ENERGY);
          }
        } else if (selfFetchPlan.sourcePos) {
          const pos = new RoomPosition(selfFetchPlan.sourcePos.x, selfFetchPlan.sourcePos.y, selfFetchPlan.sourcePos.roomName);
          const targets = pos.lookFor(LOOK_RESOURCES).filter(r => r.resourceType === RESOURCE_ENERGY);
          if (targets.length > 0) {
            return this.pickupResource(creep, targets[0], RESOURCE_ENERGY);
          }
        }

        // 自取失败，重新请求或结束任务
        return this.switchState(UpgradeState.GET_ENERGY, '自取资源失败，重新请求');
      } else {
        // 无法自取，结束任务
        this.service.supplyService.cancel(creep, RESOURCE_ENERGY);
        return this.switchState(UpgradeState.FINISHED, '无法获取能量，任务结束');
      }
    }

    // 继续等待
    return this.switchState(UpgradeState.WAIT_SUPPLY, `继续等待能量供应，剩余 ${waitUntil - Game.time} tick`);
  }

  /**
   * 升级状态处理器
   */
  private handleUpgrading(creep: Creep): UpgradeState {
    const task = this.getTask<UpgradeTask>(creep);
    if (!task) {
      return this.switchState(UpgradeState.FINISHED, '任务未找到');
    }

    const controller = Game.getObjectById<StructureController>(task.params.controllerId as Id<StructureController>);
    if (!controller) {
      return this.switchState(UpgradeState.FINISHED, '未找到控制器');
    }

    // 没能量则回去取能量
    if (!this.hasResource(creep, RESOURCE_ENERGY)) {
      return this.switchState(UpgradeState.GET_ENERGY, '身上无能量');
    }

    const upgradeResult = creep.upgradeController(controller);

    switch (upgradeResult) {
      case OK:
        return this.switchState(UpgradeState.UPGRADING, '升级成功');
      case ERR_NOT_IN_RANGE:
        this.service.moveService.moveTo(creep, controller);
        return this.switchState(UpgradeState.UPGRADING, '移动到控制器');
      case ERR_NOT_ENOUGH_RESOURCES:
        return this.switchState(UpgradeState.GET_ENERGY, '能量不足');
      case ERR_BUSY:
        return this.switchState(UpgradeState.UPGRADING, '升级繁忙');
      default:
        return this.switchState(UpgradeState.FINISHED, '升级失败');
    }
  }

  /**
   * 完成状态处理器
   */
  private handleFinished(creep: Creep): UpgradeState {
    // 解除任何中断保护
    this.setInterruptible(true);
    return this.switchState(UpgradeState.FINISHED, this.getRecord()?.reason || '完成，没有记录原因');
  }

  // ====================== 辅助工具方法 ======================

  /**
   * 检查creep是否携带指定资源
   */
  private hasResource(creep: Creep, resourceType: ResourceConstant): boolean {
    return creep.store.getUsedCapacity(resourceType) > 0;
  }

  /**
   * 丢弃其他资源，只保留指定类型
   */
  private dropOtherResources(creep: Creep, keepResourceType: ResourceConstant): UpgradeState {
    for (const resourceType in creep.store) {
      if (resourceType !== keepResourceType) {
        creep.drop(resourceType as ResourceConstant);
      }
    }
    return this.switchState(UpgradeState.GET_ENERGY, '已丢弃其他资源');
  }

  /**
   * 拾取 / 取用 / 采集资源
   */
  private pickupResource(creep: Creep, target: Resource | Structure | Source, resourceType: ResourceConstant): UpgradeState {
    if (target instanceof Resource) {
      if (target.resourceType !== resourceType) return this.switchState(UpgradeState.GET_ENERGY, '资源类型不匹配');
      const res = creep.pickup(target);
      switch (res) {
        case OK:
          return this.switchState(UpgradeState.UPGRADING, '拾取资源成功');
        case ERR_NOT_IN_RANGE:
          this.service.moveService.moveTo(creep, target);
          return this.switchState(UpgradeState.GET_ENERGY, '移动到资源');
        case ERR_FULL:
          // 判断creep背包资源类型，如果是能源则转换成 UPGRADING 状态，否则丢弃
          // TODO 检查这里的逻辑
          if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            return this.switchState(UpgradeState.GET_ENERGY, '背包已满');
          }
          creep.drop(resourceType as ResourceConstant);
          return this.switchState(UpgradeState.GET_ENERGY, '背包已满');
        case ERR_INVALID_TARGET:
          return this.switchState(UpgradeState.GET_ENERGY, '目标无效');
        default:
          return this.switchState(UpgradeState.GET_ENERGY, '拾取资源失败');
      }
    }

    if (target instanceof Structure) {
      if (!('store' in target)) return this.switchState(UpgradeState.GET_ENERGY, '目标不是存储建筑');
      const storeStruct = target as any;
      if (storeStruct.store.getUsedCapacity(resourceType) === 0) return this.switchState(UpgradeState.GET_ENERGY, '存储建筑已满');
      const res = creep.withdraw(target, resourceType);
      switch (res) {
        case OK:
          return this.switchState(UpgradeState.UPGRADING, '取用资源成功');
        case ERR_NOT_IN_RANGE:
          this.service.moveService.moveTo(creep, target);
          return this.switchState(UpgradeState.GET_ENERGY, '移动到资源');
        case ERR_NOT_ENOUGH_RESOURCES:
          return this.switchState(UpgradeState.GET_ENERGY, '资源不足');
        case ERR_INVALID_TARGET:
          return this.switchState(UpgradeState.GET_ENERGY, '目标无效');
        default:
          return this.switchState(UpgradeState.GET_ENERGY, '取用资源失败');
      }
    }

    if (target instanceof Source) {
      if (resourceType !== RESOURCE_ENERGY) return this.switchState(UpgradeState.GET_ENERGY, '资源类型不匹配');
      const res = creep.harvest(target);
      switch (res) {
        case OK:
          return this.switchState(UpgradeState.UPGRADING, '采集资源成功');
        case ERR_NOT_IN_RANGE:
          this.service.moveService.moveTo(creep, target);
          return this.switchState(UpgradeState.GET_ENERGY, '移动到资源');
        case ERR_NOT_ENOUGH_RESOURCES:
          return this.switchState(UpgradeState.GET_ENERGY, '资源不足');
        case ERR_BUSY:
          return this.switchState(UpgradeState.GET_ENERGY, '采集繁忙');
        default:
          return this.switchState(UpgradeState.GET_ENERGY, '采集失败');
      }
    }

    return this.switchState(UpgradeState.GET_ENERGY, '资源类型不匹配');
  }
}
