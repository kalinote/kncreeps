import { Task, TaskPriority, CapabilityRequirement, TaskType } from "../types";
import { TaskManager } from "../managers/TaskManager";
import { HarvestTaskExecutor } from "./executors/HarvestTaskExecutor";
import { TransportTaskExecutor } from "./executors/TransportTaskExecutor";

/**
 * 任务调度器 - 负责任务分配和调度
 */
export class TaskScheduler {
  private taskManager: TaskManager;
  private executors: Map<string, any> = new Map();

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager;
    this.initializeExecutors();
  }

  private initializeExecutors(): void {
    this.executors.set(TaskType.HARVEST, new HarvestTaskExecutor());
    this.executors.set(TaskType.TRANSPORT, new TransportTaskExecutor());

    console.log(`[TaskScheduler] 已注册执行器: ${TaskType.HARVEST}, ${TaskType.TRANSPORT}`);
  }

  /**
   * 为空闲creep分配任务
   */
  public assignTasks(): void {
    if (!this.taskManager.isSystemEnabled()) return;

    const pendingTasks = this.taskManager.getPendingTasks();
    const availableCreeps = this.getAvailableCreeps();

    console.log(`[TaskScheduler] 开始分配任务: ${pendingTasks.length} 个待处理任务, ${availableCreeps.length} 个可用creep`);

    if (pendingTasks.length > 0) {
      console.log(`[TaskScheduler] 待分配任务类型: ${pendingTasks.map(t => t.type).join(', ')}`);
    }
    if (availableCreeps.length > 0) {
      console.log(`[TaskScheduler] 可用creep: ${availableCreeps.map(c => c.name).join(', ')}`);
    }

    pendingTasks.sort((a, b) => b.priority - a.priority);

    let assignedCount = 0;
    for (const task of pendingTasks) {
      const executor = this.executors.get(task.type);
      if (!executor) {
        console.log(`[TaskScheduler] 警告: 找不到任务类型 ${task.type} 的执行器`);
        continue;
      }

      const bestCreep = this.findBestCreepForTask(task, availableCreeps);
      if (bestCreep) {
        const success = this.taskManager.assignTask(task.id, bestCreep.name);
        if (success) {
          assignedCount++;
          console.log(`[TaskScheduler] 分配任务 ${task.type}(${task.id}) 给 ${bestCreep.name}`);
        }
        const index = availableCreeps.indexOf(bestCreep);
        if (index > -1) {
          availableCreeps.splice(index, 1);
        }
      } else {
        console.log(`[TaskScheduler] 找不到合适的creep执行任务 ${task.type}(${task.id})`);
      }
    }

    if (assignedCount > 0) {
      console.log(`[TaskScheduler] 成功分配 ${assignedCount} 个任务`);
    } else if (pendingTasks.length > 0) {
      console.log(`[TaskScheduler] 没有分配任何任务，可能需要检查creep能力或任务执行器`);
    }
  }

  /**
   * 获取可用的creep列表
   */
  private getAvailableCreeps(): Creep[] {
    const available: Creep[] = [];

    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      const currentTask = this.taskManager.getCreepTask(name);

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
    const executor = this.executors.get(task.type);
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

    // 能力匹配度 (40%)
    const capabilityScore = executor.calculateCapabilityScore ?
      executor.calculateCapabilityScore(creep) : 0.5;
    score += capabilityScore * 0.4;

    // 距离因素 (30%)
    // 这里简化处理，实际可以根据任务类型计算到目标的距离
    const distanceScore = 0.5; // 暂时固定值
    score += distanceScore * 0.3;

    // 当前负载 (20%)
    const loadScore = creep.store.getFreeCapacity() / creep.store.getCapacity();
    score += loadScore * 0.2;

    // 历史效率 (10%)
    const efficiencyScore = 0.5; // 暂时固定值，后续可以实现
    score += efficiencyScore * 0.1;

    return score;
  }
}
