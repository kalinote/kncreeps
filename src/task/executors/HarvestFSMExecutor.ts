import { TaskStateMachine } from "../fsm/StateMachine";
import { TaskFSMMemory, HarvestState, HarvestTask, TaskKind, TaskType } from "../../types";
import { CreepMoveService } from "../../services/CreepMoveService";
import { SourceAnalyzer } from "../../utils/SourceAnalyzer";
import { ServiceContainer } from "../../core/ServiceContainer";
import { TaskManager } from "managers/TaskManager";

/**
 * 采集任务 FSM 执行器
 */
export class HarvestFSMExecutor extends TaskStateMachine<HarvestState> {
  private moveService: CreepMoveService;

  constructor(taskMemory: TaskFSMMemory<HarvestState>, creep: Creep, serviceContainer: ServiceContainer) {
    super(taskMemory, creep, serviceContainer);
    this.moveService = this.serviceContainer.get('creepMoveService');
  }

  protected getInitialState(): HarvestState {
    return HarvestState.INIT;
  }

  protected handlers() {
    return {
      [HarvestState.INIT]: (creep: Creep) => {
        return this.handleInit(creep);
      },
      [HarvestState.MOVING]: (creep: Creep) => {
        return this.handleMoving(creep);
      },
      [HarvestState.HARVESTING]: (creep: Creep) => {
        return this.handleHarvesting(creep);
      },
      [HarvestState.DUMPING]: (creep: Creep) => {
        return this.handleDumping(creep);
      },
      [HarvestState.FINISHED]: (creep: Creep) => {
        return this.handleFinished(creep);
      }
    };
  }

  protected getFinishedState(): HarvestState {
    return HarvestState.FINISHED;
  }

  /**
   * 初始化状态处理器
   */
  private handleInit(creep: Creep): HarvestState {
    const task = this.getTask(creep);
    if (!task) {
      return HarvestState.FINISHED;
    }

    // 获取目标源
    const source = Game.getObjectById<Source>(task.params.sourceId as Id<Source>);
    if (!source || source.energy === 0) {
      return HarvestState.FINISHED;
    }

    // 检查creep是否即将死亡
    if (this.isCreepDying(creep)) {
      return HarvestState.FINISHED;
    }

    // 初始化该creep的私有上下文
    this.setContext({
      sourceId: task.params.sourceId,
      targetId: task.params.targetId,
      targetPos: task.params.targetPos,
      harvestPosition: task.params.harvestPosition
    });

    // 如果creep已满，进入丢弃状态
    if (!this.hasCapacity(creep, RESOURCE_ENERGY)) {
      return HarvestState.DUMPING;
    }

    // 获取或分配采集位置
    const harvestPosition = this.getOrAssignHarvestPosition(creep, task, source);
    console.log(`[HarvestFSMExecutor] ${creep.name} harvestPosition: ${JSON.stringify(harvestPosition)}`);
    if (!harvestPosition) {
      return HarvestState.FINISHED;
    }

    // 设置目标位置到该creep的私有上下文
    this.setContext({ ...this.getContext(), targetPosition: harvestPosition });

    return HarvestState.MOVING;
  }

  /**
   * 移动状态处理器
   */
  private handleMoving(creep: Creep): HarvestState {
    const context = this.getContext();
    if (!context || !context.targetPosition) {
      return HarvestState.INIT;
    }

    const targetPos = new RoomPosition(
      context.targetPosition.x,
      context.targetPosition.y,
      context.targetPosition.roomName
    );

    // 检查是否已到达目标位置
    if (creep.pos.isEqualTo(targetPos)) {
      return HarvestState.HARVESTING;
    }

    // 移动到目标位置
    const moveResult = this.moveService.moveTo(creep, targetPos);
    if (moveResult === ERR_NO_PATH) {
      // 路径不可达，清除分配位置并重新初始化
      this.clearAssignedPosition(creep);
      return HarvestState.INIT;
    }

    return HarvestState.MOVING;
  }

  /**
   * 采集状态处理器
   */
  private handleHarvesting(creep: Creep): HarvestState {
    const task = this.getTask(creep);
    if (!task) {
      return HarvestState.FINISHED;
    }

    const source = Game.getObjectById<Source>(task.params.sourceId as Id<Source>);
    if (!source || source.energy === 0) {
      return HarvestState.FINISHED;
    }

    // 检查creep是否即将死亡
    if (this.isCreepDying(creep)) {
      return HarvestState.FINISHED;
    }

    // 如果creep已满，进入丢弃状态
    if (!this.hasCapacity(creep, RESOURCE_ENERGY)) {
      return HarvestState.DUMPING;
    }

    // 执行采集
    const harvestResult = creep.harvest(source);

    switch (harvestResult) {
      case OK:
        return HarvestState.HARVESTING;

      case ERR_NOT_IN_RANGE:
        // 重新计算位置，可能被其他creep占用了
        this.clearAssignedPosition(creep);
        return HarvestState.INIT;

      case ERR_NOT_ENOUGH_RESOURCES:
        // 源暂时枯竭，等待恢复
        return HarvestState.HARVESTING;

      case ERR_BUSY:
        return HarvestState.HARVESTING;

      default:
        return HarvestState.FINISHED;
    }
  }

  /**
   * 丢弃状态处理器
   */
  private handleDumping(creep: Creep): HarvestState {
    const task = this.getTask(creep);
    if (!task) {
      return HarvestState.FINISHED;
    }

    // 如果指定了存储目标，优先使用指定目标
    if (task.params.targetId) {
      const target = Game.getObjectById<Structure>(task.params.targetId as Id<Structure>);
      if (target && 'store' in target) {
        const result = this.transferResource(creep, target, RESOURCE_ENERGY);
        if (result.success && !result.completed) {
          return HarvestState.HARVESTING;
        }
        return HarvestState.DUMPING;
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
        return HarvestState.HARVESTING;
      } else {
        this.moveService.moveTo(creep, targetPos);
        return HarvestState.DUMPING;
      }
    }

    // 默认策略：寻找附近容器，如果没有则丢弃
    return this.findAndUseNearbyStorage(creep);
  }

  /**
   * 完成状态处理器
   */
  private handleFinished(creep: Creep): HarvestState {
    // 清理分配的位置
    this.clearAssignedPosition(creep);
    return HarvestState.FINISHED;
  }

  /**
   * 获取任务对象
   */
  private getTask(creep: Creep): HarvestTask | null {
    // 从服务容器获取任务管理器
    const taskManager: TaskManager = this.serviceContainer.get('taskManager');
    const task = taskManager.getCreepTask(creep.name);

    if (task && task.type === TaskType.HARVEST) {
      return task as HarvestTask;
    }
    return null;
  }

  /**
   * 检查creep是否即将死亡
   */
  private isCreepDying(creep: Creep, threshold: number = 50): boolean {
    return creep.ticksToLive !== undefined && creep.ticksToLive < threshold;
  }

  /**
   * 检查creep是否有空间
   */
  private hasCapacity(creep: Creep, resourceType: ResourceConstant): boolean {
    return creep.store.getFreeCapacity(resourceType) > 0;
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

  /**
   * 寻找并使用附近存储设施
   */
  private findAndUseNearbyStorage(creep: Creep): HarvestState {
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
      const result = this.transferResource(creep, targetStructure, RESOURCE_ENERGY);

      if (result.success && result.completed) {
        return HarvestState.HARVESTING;
      }
      return HarvestState.DUMPING;
    } else {
      // 没有找到存储设施，直接丢弃
      creep.drop(RESOURCE_ENERGY);
      return HarvestState.HARVESTING;
    }
  }

  /**
   * 传输资源
   */
  private transferResource(creep: Creep, target: Structure, resourceType: ResourceConstant): { success: boolean; completed: boolean } {
    if (!('store' in target)) {
      return { success: false, completed: false };
    }

    const transferResult = creep.transfer(target, resourceType);

    switch (transferResult) {
      case OK:
        return { success: true, completed: true };
      case ERR_NOT_IN_RANGE:
        this.moveService.moveTo(creep, target);
        return { success: true, completed: false };
      case ERR_FULL:
        return { success: false, completed: true };
      default:
        return { success: false, completed: false };
    }
  }
}
