import { BaseService } from "./BaseService";
import { TaskStateService } from "./TaskStateService";
import { Task, TaskType, TaskAssignmentType, TaskPriority, TaskStatus } from "../types";
import { TaskExecutorRegistry } from "../task/TaskExecutorRegistry";
import { EventBus } from "../core/EventBus";

/**
 * 任务调度器服务 - 负责任务分配和调度
 */
export class TaskSchedulerService extends BaseService {
  private executorRegistry: TaskExecutorRegistry;

  constructor(eventBus: EventBus, serviceContainer: any) {
    super(eventBus, serviceContainer);
    this.executorRegistry = new TaskExecutorRegistry();
  }

  private get taskStateService(): TaskStateService {
    return this.serviceContainer.get('taskStateService');
  }

  /**
   * 为空闲creep分配任务
   */
  public update(): void {
    const availableCreeps = this.getAvailableCreeps();
    if (availableCreeps.length === 0) {
      return;
    }

    // 首先处理独占任务（只有PENDING状态的任务）
    const exclusiveTasks = this.taskStateService.getPendingTasks()
      .filter(task => task.assignmentType === TaskAssignmentType.EXCLUSIVE);

    this.processExclusiveTasks(exclusiveTasks, availableCreeps);

    // 然后处理共享任务（包括PENDING和可以继续分配的任务）
    const sharedTasks = this.getAllAvailableSharedTasks();
    this.processSharedTasks(sharedTasks, availableCreeps);
  }

  /**
   * 处理独占任务（一对一分配）
   */
  private processExclusiveTasks(allTasks: Task[], availableCreeps: Creep[]): void {
    const exclusiveTasks = allTasks.filter(task =>
      task.assignmentType === TaskAssignmentType.EXCLUSIVE &&
      task.assignedCreeps.length === 0
    );

    if (exclusiveTasks.length === 0) return;

    // 按优先级排序
    exclusiveTasks.sort((a, b) => b.priority - a.priority);

    for (const task of exclusiveTasks) {
      if (availableCreeps.length === 0) break;

      const bestCreep = this.findBestCreepForTask(task, availableCreeps);
      if (bestCreep) {
        if (this.taskStateService.assignTask(task.id, bestCreep.name)) {
          // 从可用列表中移除已分配的creep
          const index = availableCreeps.findIndex(c => c.id === bestCreep.id);
          if (index > -1) {
            availableCreeps.splice(index, 1);
          }
        }
      }
    }
  }

  /**
   * 处理共享任务（基于加权需求池的动态分配）
   */
  private processSharedTasks(allTasks: Task[], availableCreeps: Creep[]): void {
    const sharedTasks = allTasks.filter(task =>
      task.assignmentType === TaskAssignmentType.SHARED &&
      task.assignedCreeps.length < task.maxAssignees
    );

    if (sharedTasks.length === 0) return;

    // 按任务类型分组
    const tasksByType = this.groupTasksByType(sharedTasks);

    for (const [taskType, tasks] of tasksByType) {
      // 1. 识别资源池 - 找到能执行这种任务类型的creep
      const workforcePool = this.identifyWorkforcePool(taskType, availableCreeps);

      if (workforcePool.length === 0) continue;

      // 2. 计算总需求权重
      const totalDemand = this.calculateTotalDemand(tasks);

      // 3. 按比例分配creep
      const allocations = this.allocateProportionally(tasks, workforcePool, totalDemand);

      // 4. 执行分配
      this.executeAllocations(allocations, availableCreeps);
    }
  }

  /**
   * 按任务类型分组
   */
  private groupTasksByType(tasks: Task[]): Map<TaskType, Task[]> {
    const grouped = new Map<TaskType, Task[]>();

    for (const task of tasks) {
      if (!grouped.has(task.type)) {
        grouped.set(task.type, []);
      }
      grouped.get(task.type)!.push(task);
    }

    return grouped;
  }

  /**
   * 识别工作力池 - 找到能执行指定任务类型的creep
   */
  private identifyWorkforcePool(taskType: TaskType, availableCreeps: Creep[]): Creep[] {
    const executor = this.executorRegistry.getExecutor(taskType);
    if (!executor) return [];

    return availableCreeps.filter(creep => {
      // 检查creep是否可以被中断（如果正在执行任务）
      if (creep.memory.canBeInterrupted === false) {
        return false;
      }

      // 检查是否有执行该任务的能力
      const dummyTask = { type: taskType } as Task;
      return executor.canExecute(creep, dummyTask);
    });
  }

  /**
   * 计算总需求权重
   */
  private calculateTotalDemand(tasks: Task[]): number {
    return tasks.reduce((total, task) => total + this.getPriorityWeight(task.priority), 0);
  }

  /**
   * 获取优先级权重
   */
  private getPriorityWeight(priority: TaskPriority): number {
    switch (priority) {
      case TaskPriority.EMERGENCY: return 10;
      case TaskPriority.CRITICAL: return 8;
      case TaskPriority.HIGH: return 6;
      case TaskPriority.NORMAL: return 4;
      case TaskPriority.LOW: return 2;
      case TaskPriority.BACKGROUND: return 1;
      default: return 4;
    }
  }

  /**
   * 按比例分配creep
   */
  private allocateProportionally(tasks: Task[], workforcePool: Creep[], totalDemand: number): Map<string, Creep[]> {
    const allocations = new Map<string, Creep[]>();
    let remainingCreeps = [...workforcePool];

    // 按优先级排序任务，优先级相同的任务随机化顺序以确保公平分配
    const sortedTasks = [...tasks].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // 优先级高的在前
      }
      // 优先级相同时，基于任务ID的哈希值来排序，确保相对稳定但公平的分配
      return a.id.localeCompare(b.id);
    });

    for (const task of sortedTasks) {
      if (remainingCreeps.length === 0) break;

      const taskWeight = this.getPriorityWeight(task.priority);
      const proportion = taskWeight / totalDemand;

      // 计算应分配的creep数量
      let allocatedCount = Math.floor(proportion * workforcePool.length);

      // 确保至少分配1个creep（如果有可用的）
      if (allocatedCount === 0 && remainingCreeps.length > 0) {
        allocatedCount = 1;
      }

      // 不能超过任务的最大分配数和当前已分配数的差值
      const maxNewAssignees = task.maxAssignees - task.assignedCreeps.length;
      allocatedCount = Math.min(allocatedCount, maxNewAssignees, remainingCreeps.length);

      if (allocatedCount > 0) {
        // 找到最适合的creep
        const bestCreeps = this.findBestCreepsForTask(task, remainingCreeps, allocatedCount);
        allocations.set(task.id, bestCreeps);

        // 从剩余creep中移除已分配的
        for (const creep of bestCreeps) {
          const index = remainingCreeps.findIndex(c => c.id === creep.id);
          if (index > -1) {
            remainingCreeps.splice(index, 1);
          }
        }
      }
    }

    return allocations;
  }

  /**
   * 找到最适合任务的多个creep
   */
  private findBestCreepsForTask(task: Task, creeps: Creep[], count: number): Creep[] {
    const executor = this.executorRegistry.getExecutor(task.type);
    if (!executor) return [];

    // 计算所有creep的评分
    const creepScores = creeps
      .filter(creep => executor.canExecute(creep, task))
      .map(creep => ({
        creep,
        score: this.calculateCreepScore(creep, task, executor)
      }))
      .sort((a, b) => b.score - a.score);

    // 返回评分最高的creep
    return creepScores.slice(0, count).map(item => item.creep);
  }

  /**
   * 执行分配
   */
  private executeAllocations(allocations: Map<string, Creep[]>, availableCreeps: Creep[]): void {
    for (const [taskId, assignedCreeps] of allocations) {
      for (const creep of assignedCreeps) {
        if (this.taskStateService.assignTask(taskId, creep.name)) {
          // 从可用列表中移除已分配的creep
          const index = availableCreeps.findIndex(c => c.id === creep.id);
          if (index > -1) {
            availableCreeps.splice(index, 1);
          }
        }
      }
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
      const currentTask = this.taskStateService.getCreepTask(name);
      if (!currentTask) {
        available.push(creep);
      }
    }
    return available;
  }

  /**
   * 为任务找到最佳creep
   */
  private findBestCreepForTask(task: Task, creeps: Creep[]): Creep | null {
    const executor = this.executorRegistry.getExecutor(task.type);
    if (!executor) return null;

    let bestCreep: Creep | null = null;
    let bestScore = -1;

    for (const creep of creeps) {
      if (executor.canExecute(creep, task)) {
        const score = this.calculateCreepScore(creep, task, executor);
        if (score > bestScore) {
          bestScore = score;
          bestCreep = creep;
        }
      }
    }
    return bestCreep;
  }

  /**
   * 计算creep执行任务的评分
   */
  private calculateCreepScore(creep: Creep, task: Task, executor: any): number {
    let score = 0;

    // Capability score
    const capabilityScore = executor.calculateCapabilityScore ? executor.calculateCapabilityScore(creep) : 0.5;
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
   * 获取所有可分配的共享任务
   */
  private getAllAvailableSharedTasks(): Task[] {
    const allTasks = this.taskStateService.getActiveTasks();

    return allTasks.filter(task => {
      // 只考虑共享任务
      if (task.assignmentType !== TaskAssignmentType.SHARED) {
        return false;
      }

      // 任务必须是待分配或正在进行中，且未达到最大分配数
      const canAssignMore = task.assignedCreeps.length < task.maxAssignees;
      const isAvailable = task.status === TaskStatus.PENDING ||
        task.status === TaskStatus.ASSIGNED ||
        task.status === TaskStatus.IN_PROGRESS;

      return canAssignMore && isAvailable;
    });
  }
}
