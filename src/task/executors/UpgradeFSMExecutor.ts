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

    // 先尝试从任务指定建筑获取能量
    const sourceIds = task.params.sourceIds || [];
    for (const sourceId of sourceIds) {
      const structure = Game.getObjectById<Structure>(sourceId as Id<Structure>);
      if (structure) {
        const result = this.pickupResource(creep, structure, RESOURCE_ENERGY);
        if (result.success) {
          if (result.completed) {
            return this.switchState(UpgradeState.UPGRADING, '获取能量成功');
          }
          return this.switchState(UpgradeState.GET_ENERGY, '获取能量失败');
        }
      }
    }

    // 若未获取到能量，使用能量服务寻找最近能量源
    const sources = this.energyService.findEnergySources(creep);
    if (sources && sources.length > 0) {
      const target = sources[0].object;
      const result = this.pickupResource(creep, target, RESOURCE_ENERGY);
      if (result.success) {
        if (result.completed) {
          return this.switchState(UpgradeState.UPGRADING, '获取能量成功');
        }
        return this.switchState(UpgradeState.GET_ENERGY, '获取能量失败');
      }
    }

    // 未找到能量源，任务结束
    return this.switchState(UpgradeState.FINISHED, '未找到能量源');
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
        this.moveService.moveTo(creep, controller);
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
  private pickupResource(creep: Creep, target: Resource | Structure | Source, resourceType: ResourceConstant): { success: boolean; completed: boolean } {
    if (target instanceof Resource) {
      if (target.resourceType !== resourceType) return { success: false, completed: false };
      const res = creep.pickup(target);
      return this.handlePickupResult(res);
    }

    if (target instanceof Structure) {
      if (!('store' in target)) return { success: false, completed: false };
      const storeStruct = target as any;
      if (storeStruct.store.getUsedCapacity(resourceType) === 0) return { success: false, completed: false };
      const res = creep.withdraw(target, resourceType);
      return this.handleWithdrawResult(res);
    }

    if (target instanceof Source) {
      if (resourceType !== RESOURCE_ENERGY) return { success: false, completed: false };
      const res = creep.harvest(target);
      return this.handleHarvestResult(res);
    }

    return { success: false, completed: false };
  }

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
}
