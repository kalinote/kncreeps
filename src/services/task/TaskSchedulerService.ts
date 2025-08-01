import { BaseService } from "../BaseService";
import { Task, TaskType, TaskAssignmentType, TaskStatus, TaskSchedulerServiceMemory, TaskManagerMemory } from "../../types";
import { PriorityCalculator } from "../../utils/PriorityCalculator";
import { TaskManager } from "../../managers/TaskManager";
import { EventBus } from "../../core/EventBus";

/**
 * 任务调度器服务 - 负责任务分配和调度
 * 采用统一的动态优先级模型，取代了旧的"独占-共享"两段式调度。
 */
export class TaskSchedulerService extends BaseService<TaskSchedulerServiceMemory, TaskManager> {
  public cleanup(): void {}

  constructor(eventBus: EventBus, manager: TaskManager, memory: TaskManagerMemory) {
    super(eventBus, manager, memory, 'scheduler');
  }

  public initialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastUpdate = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
    }
  }

  public update(): void {
    const availableCreeps = this.getAvailableCreeps();
    if (availableCreeps.length === 0) {
      return;
    }

    const assignableTasks = this.getAllAssignableTasks();
    if (assignableTasks.length === 0) {
      return;
    }

    // 1. 计算所有可分配任务的动态有效优先级
    const tasksWithPriority = assignableTasks
      .map(task => ({
        task,
        effectivePriority: PriorityCalculator.calculate(task, Game.time)
      }))
      .filter(item => item.effectivePriority > 0); // 过滤掉无效或已饱和的任务

    // 2. 按有效优先级降序排序
    tasksWithPriority.sort((a, b) => b.effectivePriority - a.effectivePriority);

    // 3. 遍历排序后的任务列表，逐一进行分配
    for (const { task } of tasksWithPriority) {
      if (availableCreeps.length === 0) break; // 如果没有可用的creep，则停止分配

      const remainingCapacity = task.maxAssignees - task.assignedCreeps.length;
      if (remainingCapacity <= 0) continue;

      let assignedCreeps: Creep[] = [];

      // 为独占任务寻找最佳的一个creep
      if (task.assignmentType === TaskAssignmentType.EXCLUSIVE) {
        const bestCreep = this.findBestCreepsForTask(task, availableCreeps, 1);
        if (bestCreep.length > 0) {
          assignedCreeps.push(bestCreep[0]);
        }
      }
      // 为共享任务寻找最佳的一组creeps
      else if (task.assignmentType === TaskAssignmentType.SHARED) {
        const bestCreeps = this.findBestCreepsForTask(task, availableCreeps, remainingCapacity);
        if (bestCreeps.length > 0) {
          assignedCreeps.push(...bestCreeps);
        }
      }

      // 执行分配，并从可用creep池中移除已分配的creep
      for (const creep of assignedCreeps) {
        if (this.manager.taskStateService.assignTask(task.id, creep.name)) {
          const index = availableCreeps.findIndex(c => c.id === creep.id);
          if (index > -1) {
            availableCreeps.splice(index, 1);
          }
        }
      }
    }
  }

  /**
   * 获取所有可分配的任务
   * 包括：
   * 1. 处于 PENDING 状态的独占任务
   * 2. 处于 PENDING, ASSIGNED, IN_PROGRESS 状态且未达到分配上限的共享任务
   */
  private getAllAssignableTasks(): Task[] {
    const allTasks = this.manager.taskStateService.getActiveTasks();

    return allTasks.filter(task => {
      const canAssignMore = task.assignedCreeps.length < task.maxAssignees;
      if (!canAssignMore) {
        return false;
      }

      // 对于独占任务，只有 PENDING 状态的才可分配
      if (task.assignmentType === TaskAssignmentType.EXCLUSIVE) {
        return task.status === TaskStatus.PENDING;
      }

      // 对于共享任务，多种状态下都可以追加分配
      if (task.assignmentType === TaskAssignmentType.SHARED) {
        return (
          task.status === TaskStatus.PENDING ||
          task.status === TaskStatus.ASSIGNED ||
          task.status === TaskStatus.IN_PROGRESS
        );
      }

      return false;
    });
  }

  /**
   * 找到最适合任务的多个creep
   */
  private findBestCreepsForTask(task: Task, creeps: Creep[], count: number): Creep[] {
    // 计算所有creep的评分
    const creepScores = creeps
      .filter(creep => this.canExecuteFSMTask(creep, task))
      .map(creep => ({
        creep,
        score: this.calculateCreepScore(creep, task, null) // FSM执行器不需要用于评分
      }))
      .sort((a, b) => b.score - a.score);

    // 返回评分最高的creep
    return creepScores.slice(0, count).map(item => item.creep);
  }

    /**
   * 检查creep是否能执行FSM任务
   * // TODO 这个函数需要进一步优化
   */
  private canExecuteFSMTask(creep: Creep, task: Task): boolean {
    // 对于FSM执行器，我们主要检查creep的基本能力
    // 具体的执行逻辑由FSM执行器在运行时处理

    // 检查creep是否还活着
    if (creep.spawning) return false;

    // 检查creep是否有基本的移动能力
    if (creep.getActiveBodyparts(MOVE) === 0) return false;

    // 根据任务类型进行基本能力检查
    switch (task.type) {
      case TaskType.HARVEST:
        return creep.getActiveBodyparts(WORK) > 0;
      case TaskType.TRANSPORT:
        return creep.getActiveBodyparts(CARRY) > 0;
      case TaskType.UPGRADE:
        return creep.getActiveBodyparts(WORK) > 0;
      case TaskType.BUILD:
        return creep.getActiveBodyparts(WORK) > 0;
      case TaskType.ATTACK:
        return creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0;
      default:
        // 对于其他任务类型（如REPAIR），默认需要WORK部件
        return creep.getActiveBodyparts(WORK) > 0;
    }
  }

  /**
   * 获取可用的creep列表
   */
  private getAvailableCreeps(): Creep[] {
    const available: Creep[] = [];
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      if (creep.spawning) continue;
      // TODO 计入共享任务的状态为FINISHED的creep，该creep任务已完成
      const currentTask = this.manager.taskStateService.getCreepTask(name);
      if (!currentTask) {
        available.push(creep);
      }
    }
    return available;
  }

  /**
   * 计算creep执行任务的评分
   */
  private calculateCreepScore(creep: Creep, task: Task, executor: any): number {
    let score = 0;

    // Capability score
    // FIXME 这是一个临时解决方案，用于任务执行器重构的过度方案，完成任务执行器重构后删除
    const capabilityScore = executor?.calculateCapabilityScore ? executor.calculateCapabilityScore(creep) : 0.5;
    score += capabilityScore * 0.5;

    let distance = 0;
    const taskTargetPos = this.getTaskPosition(task);
    if (taskTargetPos) {
      distance = creep.pos.getRangeTo(taskTargetPos);
    }

    const distanceWeight = 0.3;
    const distanceScore = Math.max(0, (50 - distance) / 50);
    score += distanceScore * distanceWeight;

    const totalCapacity = creep.store.getCapacity();
    let loadScore = 0.5;
    if (totalCapacity > 0) {
      loadScore = creep.store.getFreeCapacity() / totalCapacity;
    }
    const loadWeight = 0.2;
    score += loadScore * loadWeight;

    return score;
  }

  private getTaskPosition(task: Task): RoomPosition | null {
    if ((task as any).params.harvestPosition) {
      const pos = (task as any).params.harvestPosition;
      return new RoomPosition(pos.x, pos.y, pos.roomName);
    }
    if ((task as any).params.targetId) {
      const target = Game.getObjectById((task as any).params.targetId as Id<any>);
      return target ? target.pos : null;
    }
    if ((task as any).params.sourcePos) {
      const pos = (task as any).params.sourcePos;
      return new RoomPosition(pos.x, pos.y, pos.roomName);
    }
    return null;
  }

  /**
   * 获取待分配的任务 - 包含需要生产creep的任务
   */
  public getPendingTasks(): Task[] {
    return this.manager.taskStateService.getPendingTasks()
  }

  public getPendingTasksByRoom(roomName: string): Task[] {
    return this.manager.taskStateService.getPendingTasks().filter(task => task.roomName === roomName);
  }
}
