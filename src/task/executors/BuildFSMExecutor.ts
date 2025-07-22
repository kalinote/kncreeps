import { TaskStateMachine } from "../fsm/StateMachine";
import { StateHandlers, TaskType, BuildState, BuildTask } from "../../types";
import { TaskFSMMemory } from "../../types";
import { ServiceContainer } from "../../core/ServiceContainer";


export class BuildFSMExecutor extends TaskStateMachine<BuildState> {
  constructor(taskMemory: TaskFSMMemory<BuildState>, creep: Creep, serviceContainer: ServiceContainer) {
    super(taskMemory, creep, serviceContainer);
  }

  protected getExpectedTaskType(): TaskType {
    return TaskType.BUILD;
  }

  protected getFinishedState(): BuildState {
    return BuildState.FINISHED;
  }
  protected getInitialState(): BuildState {
    return BuildState.INIT;
  }

  protected handlers(): StateHandlers<BuildState> {
    return {
      [BuildState.INIT]: (creep: Creep) => {
        return this.handleInit(creep);
      },
      [BuildState.GET_ENERGY]: (creep: Creep) => {
        return this.handleGetEnergy(creep);
      },
      [BuildState.BUILDING]: (creep: Creep) => {
        return this.handleBuilding(creep);
      },
      [BuildState.FINISHED]: (creep: Creep) => {
        return this.handleFinished(creep);
      }
    };
  }

  private handleInit(creep: Creep): BuildState {
    const task = this.getTask<BuildTask>(creep);
    if (!task) {
      return this.switchState(BuildState.FINISHED, '任务未找到');
    }

    // 检查身上是否已有能量
    const hasEnergy = this.hasResource(creep, RESOURCE_ENERGY);

    // 如果身上带的是其他资源，先丢弃
    if (!hasEnergy && creep.store.getUsedCapacity() > 0) {
      return this.dropOtherResources(creep, RESOURCE_ENERGY);
    }

    if (hasEnergy) {
      return this.switchState(BuildState.BUILDING, '身上已有能量，直接建造');
    }

    return this.switchState(BuildState.GET_ENERGY, '身上无能量');
  }

  private handleGetEnergy(creep: Creep): BuildState {
    const task = this.getTask<BuildTask>(creep);
    if (!task) {
      return this.switchState(BuildState.FINISHED, '任务未找到');
    }

    if (this.hasResource(creep, RESOURCE_ENERGY)) {
      return this.switchState(BuildState.BUILDING, '身上已有能量，直接建造');
    }

    // 先尝试从任务指定建筑获取能量
    const sourceIds = task.params.sourceIds || [];
    for (const sourceId of sourceIds) {
      const structure = Game.getObjectById<Structure>(sourceId as Id<Structure>);
      if (structure) {
        const result = this.pickupResource(creep, structure, RESOURCE_ENERGY);
        if (result.success) {
          if (result.completed) {
            return this.switchState(BuildState.BUILDING, '获取能量成功');
          }
          return this.switchState(BuildState.GET_ENERGY, '获取能量失败');
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
          return this.switchState(BuildState.BUILDING, '获取能量成功');
        }
        return this.switchState(BuildState.GET_ENERGY, '获取能量失败');
      }
    }

    return this.switchState(BuildState.FINISHED, '未找到能量源');
  }

  private handleBuilding(creep: Creep): BuildState {
    const task = this.getTask<BuildTask>(creep);
    if (!task) {
      return this.switchState(BuildState.FINISHED, '任务未找到');
    }

    const target = Game.getObjectById<ConstructionSite>(task.params.targetId as Id<ConstructionSite>);
    if (!target) {
      return this.switchState(BuildState.FINISHED, '未找到目标建筑');
    }

    if (!this.hasResource(creep, RESOURCE_ENERGY)) {
      return this.switchState(BuildState.GET_ENERGY, '身上无能量');
    }

    const buildResult = creep.build(target);

    switch (buildResult) {
      case OK:
        return this.switchState(BuildState.BUILDING, '建造成功');
      case ERR_NOT_IN_RANGE:
        this.moveService.moveTo(creep, target);
        return this.switchState(BuildState.BUILDING, '移动到目标建筑');
      case ERR_NOT_ENOUGH_ENERGY:
        return this.switchState(BuildState.GET_ENERGY, '能量不足');
      case ERR_BUSY:
        return this.switchState(BuildState.BUILDING, '建造繁忙');
      default:
        return this.switchState(BuildState.FINISHED, '建造失败');
    }
  }

  private handleFinished(creep: Creep): BuildState {
    return this.switchState(BuildState.FINISHED, this.getRecord()?.reason || '完成，没有记录原因');
  }

  private hasResource(creep: Creep, resourceType: ResourceConstant): boolean {
    return creep.store.getUsedCapacity(resourceType) > 0;
  }

  private dropOtherResources(creep: Creep, keepResourceType: ResourceConstant): BuildState {
    for (const resourceType in creep.store) {
      if (resourceType !== keepResourceType) {
        creep.drop(resourceType as ResourceConstant);
      }
    }
    return this.switchState(BuildState.GET_ENERGY, '丢弃其他资源');
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
