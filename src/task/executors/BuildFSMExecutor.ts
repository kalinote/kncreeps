import { TaskStateMachine } from "../fsm/StateMachine";
import { StateHandlers, TaskType, BuildState, BuildTask } from "../../types";
import { TaskFSMMemory } from "../../types";
import { TaskExecutionService } from "services/task/TaskExecutionService";

export class BuildFSMExecutor extends TaskStateMachine<BuildState> {
  constructor(taskMemory: TaskFSMMemory<BuildState>, service: TaskExecutionService, creep: Creep) {
    super(taskMemory, service, creep);
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
      [BuildState.WAIT_SUPPLY]: (creep: Creep) => {
        return this.handleWaitSupply(creep);
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

    // 计算需要的能量数量
    const need = creep.store.getFreeCapacity(RESOURCE_ENERGY);
    if (need === 0) {
      return this.switchState(BuildState.BUILDING, '能量已满');
    }

    // 请求资源供应并转入等待状态
    const { requestId, suggestedWait } = this.service.supplyService.request(creep, RESOURCE_ENERGY, need);

    // 在 creep 状态记录中保存等待信息
    this.setCreepContext('supplyRequestId', requestId);
    this.setCreepContext('waitUntil', Game.time + suggestedWait);

    return this.switchState(BuildState.WAIT_SUPPLY, `请求能量供应，等待 ${suggestedWait} tick`);
  }

  /**
   * 等待资源供应状态处理器
   */
  private handleWaitSupply(creep: Creep): BuildState {
    // 检查是否已经收到资源
    if (this.hasResource(creep, RESOURCE_ENERGY)) {
      // 取消请求并转入建造状态
      this.service.supplyService.cancel(creep, RESOURCE_ENERGY);
      return this.switchState(BuildState.BUILDING, '收到能量，开始建造');
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
        return this.switchState(BuildState.GET_ENERGY, '自取资源失败，重新请求');
      } else {
        // 无法自取，结束任务
        this.service.supplyService.cancel(creep, RESOURCE_ENERGY);
        return this.switchState(BuildState.FINISHED, '无法获取能量，任务结束');
      }
    }

    // 继续等待
    return this.switchState(BuildState.WAIT_SUPPLY, `继续等待能量供应，剩余 ${waitUntil - Game.time} tick`);
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
        this.service.moveService.moveTo(creep, target);
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
  private pickupResource(creep: Creep, target: Resource | Structure | Source, resourceType: ResourceConstant): BuildState {
    if (target instanceof Resource) {
      if (target.resourceType !== resourceType) return this.switchState(BuildState.GET_ENERGY, '资源类型不匹配');
      const res = creep.pickup(target);
      switch (res) {
        case OK:
          return this.switchState(BuildState.BUILDING, '拾取资源成功');
        case ERR_NOT_IN_RANGE:
          this.service.moveService.moveTo(creep, target);
          return this.switchState(BuildState.GET_ENERGY, '移动到资源');
        case ERR_FULL:
          // 判断creep背包资源类型，如果是能源则转换成BUILDING状态，否则丢弃
          // TODO 检查这里的逻辑
          if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            return this.switchState(BuildState.GET_ENERGY, '背包已满');
          }
          creep.drop(resourceType as ResourceConstant);
          return this.switchState(BuildState.GET_ENERGY, '背包已满');
        case ERR_INVALID_TARGET:
          return this.switchState(BuildState.GET_ENERGY, '目标无效');
        default:
          return this.switchState(BuildState.GET_ENERGY, '拾取资源失败');
      }
    }

    if (target instanceof Structure) {
      if (!('store' in target)) return this.switchState(BuildState.GET_ENERGY, '目标不是存储建筑');
      const storeStruct = target as any;
      if (storeStruct.store.getUsedCapacity(resourceType) === 0) return this.switchState(BuildState.GET_ENERGY, '存储建筑已满');
      const res = creep.withdraw(target, resourceType);
      switch (res) {
        case OK:
          return this.switchState(BuildState.BUILDING, '取用资源成功');
        case ERR_NOT_IN_RANGE:
          this.service.moveService.moveTo(creep, target);
          return this.switchState(BuildState.GET_ENERGY, '移动到资源');
        case ERR_NOT_ENOUGH_RESOURCES:
          return this.switchState(BuildState.GET_ENERGY, '资源不足');
        case ERR_INVALID_TARGET:
          return this.switchState(BuildState.GET_ENERGY, '目标无效');
        default:
          return this.switchState(BuildState.GET_ENERGY, '取用资源失败');
      }
    }

    if (target instanceof Source) {
      if (resourceType !== RESOURCE_ENERGY) return this.switchState(BuildState.GET_ENERGY, '资源类型不匹配');
      const res = creep.harvest(target);
      switch (res) {
        case OK:
          return this.switchState(BuildState.BUILDING, '采集资源成功');
        case ERR_NOT_IN_RANGE:
          this.service.moveService.moveTo(creep, target);
          return this.switchState(BuildState.GET_ENERGY, '移动到资源');
        case ERR_NOT_ENOUGH_RESOURCES:
          return this.switchState(BuildState.GET_ENERGY, '资源不足');
        case ERR_BUSY:
          return this.switchState(BuildState.GET_ENERGY, '采集繁忙');
        default:
          return this.switchState(BuildState.GET_ENERGY, '采集失败');
      }
    }

    return this.switchState(BuildState.GET_ENERGY, '资源类型不匹配');
  }
}
