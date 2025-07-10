import { GameConfig } from "../config/GameConfig";
import { Task, TaskStatus, TaskSystemMemory } from "../types";
import { BaseService } from "./BaseService";

/**
 * 任务状态服务 - 管理任务队列和状态
 */
export class TaskStateService extends BaseService {

  public initialize(): void {
    this.initializeMemory();
  }

  /**
   * 初始化任务系统内存
   */
  private initializeMemory(): void {
    if (!Memory.tasks) {
      Memory.tasks = {
        taskQueue: [],
        creepTasks: {},
        completedTasks: [],
        lastCleanup: Game.time,
        stats: {
          tasksCreated: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
          averageExecutionTime: 0
        }
      };
    }
  }

  /**
   * 创建新任务
   */
  public createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'retryCount'>): string {
    const taskId = this.generateTaskId();
    const newTask: Task = {
      ...task,
      id: taskId,
      status: TaskStatus.PENDING,
      createdAt: Game.time,
      updatedAt: Game.time,
      retryCount: 0,
      maxRetries: 3
    } as Task;

    if (Memory.tasks) {
      Memory.tasks.taskQueue.push(newTask);
      Memory.tasks.stats.tasksCreated++;
    }

    this.emit(GameConfig.EVENTS.TASK_CREATED, { taskId });
    return taskId;
  }

  /**
   * 获取待分配的任务
   */
  public getPendingTasks(): Task[] {
    if (!Memory.tasks) return [];
    return Memory.tasks.taskQueue.filter(task => task.status === TaskStatus.PENDING);
  }

  /**
   * 获取活跃的任务（包括待分配、已分配、进行中的任务）
   */
  public getActiveTasks(): Task[] {
    if (!Memory.tasks) return [];
    return Memory.tasks.taskQueue.filter(task =>
      task.status === TaskStatus.PENDING ||
      task.status === TaskStatus.ASSIGNED ||
      task.status === TaskStatus.IN_PROGRESS
    );
  }

  /**
   * 分配任务给creep
   */
  public assignTask(taskId: string, creepName: string): boolean {
    if (!Memory.tasks) return false;

    const task = Memory.tasks.taskQueue.find(t => t.id === taskId);
    if (!task || task.status !== TaskStatus.PENDING) {
      return false;
    }

    task.assignedCreep = creepName;
    task.status = TaskStatus.ASSIGNED;
    task.updatedAt = Game.time;

    if (Memory.tasks.creepTasks) {
        Memory.tasks.creepTasks[creepName] = taskId;
    }
    return true;
  }

  /**
   * 获取creep当前的任务
   */
  public getCreepTask(creepName: string): Task | null {
    if (!Memory.tasks || !Memory.tasks.creepTasks || !Memory.tasks.creepTasks[creepName]) {
      return null;
    }

    const taskId = Memory.tasks.creepTasks[creepName];
    return Memory.tasks.taskQueue.find(t => t.id === taskId) || null;
  }

  /**
   * 更新任务状态
   */
  public updateTaskStatus(taskId: string, status: TaskStatus): void {
    if (!Memory.tasks) return;

    const task = Memory.tasks.taskQueue.find(t => t.id === taskId);
    if (!task) return;

    task.status = status;
    task.updatedAt = Game.time;

    if (status === TaskStatus.IN_PROGRESS && !task.startedAt) {
      task.startedAt = Game.time;
    }

    if (status === TaskStatus.COMPLETED || status === TaskStatus.FAILED) {
      task.completedAt = Game.time;
      if (task.assignedCreep) {
        delete Memory.tasks.creepTasks[task.assignedCreep];
      }

      if (status === TaskStatus.COMPLETED) {
        Memory.tasks.stats.tasksCompleted++;
      } else {
        Memory.tasks.stats.tasksFailed++;
      }

      Memory.tasks.completedTasks.push(taskId);
    }
  }

  /**
   * 清理过期的和已完成的任务
   */
  public cleanup(): void {
    if (!Memory.tasks) return;

    const cleanupInterval = 50;
    if (Game.time - Memory.tasks.lastCleanup < cleanupInterval) {
      return;
    }

    // 清理已完成的任务
    const completedTaskIds = Memory.tasks.completedTasks;
    if (completedTaskIds.length > 0) {
      Memory.tasks.taskQueue = Memory.tasks.taskQueue.filter(
        task => !completedTaskIds.includes(task.id)
      );
      Memory.tasks.completedTasks = [];
    }

    this.cleanupDeadCreepTasks();
    this.cleanupExpiredTasks();

    Memory.tasks.lastCleanup = Game.time;
  }

  private cleanupDeadCreepTasks(): void {
    if (!Memory.tasks || !Memory.tasks.creepTasks) return;

    for (const creepName in Memory.tasks.creepTasks) {
      if (!Game.creeps[creepName]) {
        const taskId = Memory.tasks.creepTasks[creepName];
        delete Memory.tasks.creepTasks[creepName];

        const task = Memory.tasks.taskQueue.find(t => t.id === taskId);
        if (task && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.FAILED) {
          task.status = TaskStatus.PENDING;
          task.assignedCreep = undefined;
        }
      }
    }
  }

  private cleanupExpiredTasks(): void {
    if (!Memory.tasks) return;
    const expiryTime = 1500;
    Memory.tasks.taskQueue = Memory.tasks.taskQueue.filter(task =>
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.FAILED ||
      (Game.time - task.createdAt < expiryTime)
    );
  }

  private generateTaskId(): string {
    return `task_${Game.time}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getStats(): any {
    if (!Memory.tasks) return {};
    return {
      totalTasks: Memory.tasks.taskQueue.length,
      pendingTasks: this.getPendingTasks().length,
      activeTasks: this.getActiveTasks().length,
      ...Memory.tasks.stats
    };
  }

  protected setupEventListeners(): void {
    this.on(GameConfig.EVENTS.CREEP_DIED, (data: any) => {
        const { creepName } = data;
        if (Memory.tasks && Memory.tasks.creepTasks[creepName]) {
            const taskId = Memory.tasks.creepTasks[creepName];
            delete Memory.tasks.creepTasks[creepName];

            const task = Memory.tasks.taskQueue.find(t => t.id === taskId);
            if (task && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.FAILED) {
                task.status = TaskStatus.PENDING;
                task.assignedCreep = undefined;
            }
        }
    });
  }
}
