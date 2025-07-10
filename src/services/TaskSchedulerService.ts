import { BaseService } from "./BaseService";
import { TaskStateService } from "./TaskStateService";
import { Task, TaskType } from "../types";
import { TaskExecutorRegistry } from "../task/TaskExecutorRegistry";
import { EventBus } from "../core/EventBus";

/**
 * 任务调度器服务 - 负责任务分配和调度
 */
export class TaskSchedulerService extends BaseService {
  private executorRegistry: TaskExecutorRegistry;

  constructor(eventBus: EventBus, serviceContainer: any) {
    super(eventBus, serviceContainer);
    // TaskExecutorRegistry is stateless, so it's fine to new it up here.
    // In a more advanced scenario, this could also be a service.
    this.executorRegistry = new TaskExecutorRegistry();
  }

  private get taskStateService(): TaskStateService {
    return this.serviceContainer.get('taskStateService');
  }

  /**
   * 为空闲creep分配任务
   */
  public update(): void {
    const pendingTasks = this.taskStateService.getPendingTasks();
    const availableCreeps = this.getAvailableCreeps();

    if (pendingTasks.length === 0 || availableCreeps.length === 0) {
      return;
    }

    pendingTasks.sort((a, b) => b.priority - a.priority);

    for (const task of pendingTasks) {
      if (availableCreeps.length === 0) break; // No more creeps to assign

      const bestCreep = this.findBestCreepForTask(task, availableCreeps);
      if (bestCreep) {
        if (this.taskStateService.assignTask(task.id, bestCreep.name)) {
          // Remove assigned creep from available list
          const index = availableCreeps.findIndex(c => c.id === bestCreep.id);
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

    // Distance score
    let distance = 0;
    const taskTargetPos = this.getTaskPosition(task);
    if (taskTargetPos) {
      distance = creep.pos.getRangeTo(taskTargetPos);
    }
    // Normalize distance score (closer is better, max range 50)
    const distanceScore = Math.max(0, (50 - distance) / 50);
    score += distanceScore * 0.3;

    // Current load (more free space is better for some tasks)
    const totalCapacity = creep.store.getCapacity();
    let loadScore = 0.5;
    if (totalCapacity > 0) {
      loadScore = creep.store.getFreeCapacity() / totalCapacity;
    }
    score += loadScore * 0.2;

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
}
