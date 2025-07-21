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
      return BuildState.FINISHED;
    }

    this.setContext({
      targetId: task.params.targetId,
      sourceIds: task.params.sourceIds,
    });

    // 检查身上是否已有能量
    const hasEnergy = this.hasResource(creep, RESOURCE_ENERGY);

    // 如果身上带的是其他资源，先丢弃
    if (!hasEnergy && creep.store.getUsedCapacity() > 0) {
      return this.dropOtherResources(creep, RESOURCE_ENERGY);
    }

    if (hasEnergy) {
      return BuildState.BUILDING;
    }

    return BuildState.GET_ENERGY;
  }

  private handleGetEnergy(creep: Creep): BuildState {
    const task = this.getTask<BuildTask>(creep);
    if (!task) {
      return BuildState.FINISHED;
    }

    if (this.hasResource(creep, RESOURCE_ENERGY)) {
      return BuildState.BUILDING;
    }

    // 先尝试从任务指定建筑获取能量
    const sourceIds = task.params.sourceIds || [];
    for (const sourceId of sourceIds) {
      const structure = Game.getObjectById<Structure>(sourceId as Id<Structure>);
      if (structure) {
        const result = this.pickupResource(creep, structure, RESOURCE_ENERGY);
        if (result.success) {
          if (result.completed) {
            return BuildState.BUILDING;
          }
          return BuildState.GET_ENERGY;
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
          return BuildState.BUILDING;
        }
        return BuildState.GET_ENERGY;
      }
    }

    return BuildState.FINISHED;
  }

  private handleBuilding(creep: Creep): BuildState {
    const task = this.getTask<BuildTask>(creep);
    if (!task) {
      return BuildState.FINISHED;
    }

    const target = Game.getObjectById<ConstructionSite>(task.params.targetId as Id<ConstructionSite>);
    if (!target) {
      return BuildState.FINISHED;
    }

    if (!this.hasResource(creep, RESOURCE_ENERGY)) {
      return BuildState.GET_ENERGY;
    }

    const buildResult = creep.build(target);

    switch (buildResult) {
      case OK:
        return BuildState.BUILDING;
      case ERR_NOT_IN_RANGE:
        this.moveService.moveTo(creep, target);
        return BuildState.BUILDING;
      case ERR_NOT_ENOUGH_ENERGY:
        return BuildState.GET_ENERGY;
      case ERR_BUSY:
        return BuildState.BUILDING;
      default:
        return BuildState.FINISHED;
    }
  }

  private handleFinished(creep: Creep): BuildState {
    return BuildState.FINISHED;
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
    return BuildState.GET_ENERGY;
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
