import { TaskExecutorRegistry } from "../task/TaskExecutorRegistry";
import { EventBus } from "../core/EventBus";
import { Task, TaskType, TaskStatus, TaskPriority, TaskSystemMemory } from "../types";
import { BaseManager } from "./BaseManager";
import { TaskGenerator } from "../task/TaskGenerator";
import { TaskScheduler } from "../task/TaskScheduler";
import { TaskRoleMapping } from "../config/TaskConfig";
import { GameConfig } from "../config/GameConfig";

/**
 * 任务管理器 - 管理所有任务的生命周期
 */
export class TaskManager extends BaseManager {
  private executorRegistry: TaskExecutorRegistry;
  private taskGenerator: TaskGenerator;
  private taskScheduler: TaskScheduler;

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.executorRegistry = new TaskExecutorRegistry();
    this.taskGenerator = new TaskGenerator(this);
    this.taskScheduler = new TaskScheduler(this);
    this.initializeMemory();
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.on(GameConfig.EVENTS.CREEP_DIED, (data: any) => {
      this.handleCreepDeathEvent(data);
    });
  }

  /**
   * 通过事件处理creep死亡
   */
  private handleCreepDeathEvent(data: any): void {
    const { creepName } = data;

    // 清理死亡creep的任务分配
    if (Memory.tasks && Memory.tasks.creepTasks[creepName]) {
      const taskId = Memory.tasks.creepTasks[creepName];
      delete Memory.tasks.creepTasks[creepName];

      // 重置任务状态，使其可以重新分配
      const task = Memory.tasks.taskQueue.find(t => t.id === taskId);
      if (task && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.FAILED) {
        task.status = TaskStatus.PENDING;
        task.assignedCreep = undefined;
        console.log(`[TaskManager] 通过事件重置死亡creep的任务: ${taskId}`);
      }
    }
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
   * 更新方法 - 被 GameEngine 调用
   */
  public update(): void {
    if (!this.shouldUpdate()) return;

    this.safeExecute(() => {
      // 1. 生成新任务
      this.generateTasks();

      // 2. 分配任务给空闲creep
      this.scheduleTasks();

      // 3. 清理完成的任务
      this.cleanup();

      // 4. 输出调试信息
      if (TaskRoleMapping.shouldPerformCleanup(Game.time, 'STATS_OUTPUT')) {
        this.logTaskStats();
      }
    }, 'TaskManager.update');

    this.updateCompleted();
  }

  /**
   * 生成任务
   */
  private generateTasks(): void {
    // 为每个房间生成任务
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      this.taskGenerator.generateTasksForRoom(room);
    }
  }

  /**
   * 调度任务
   */
  private scheduleTasks(): void {
    this.taskScheduler.assignTasks();
  }

  /**
   * 输出任务统计信息
   */
  private logTaskStats(): void {
    const stats = this.getStats();
    // console.log(`[TaskManager] 任务统计 - 待处理:${stats.pendingTasks}, 总计:${stats.totalTasks}, 已创建:${stats.tasksCreated}, 已完成:${stats.tasksCompleted}`);

    // 输出当前任务分配情况
    if (Memory.tasks?.creepTasks) {
      const assignments = Object.keys(Memory.tasks.creepTasks).length;
      // console.log(`[TaskManager] 已分配任务的creep数量: ${assignments}`);
    }
  }

  /**
   * 获取任务执行器
   */
  public getTaskExecutor(taskType: TaskType) {
    return this.executorRegistry.getExecutor(taskType);
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

    // console.log(`创建任务: ${task.type} (${taskId})`);
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

    Memory.tasks.creepTasks[creepName] = taskId;

    // console.log(`任务 ${taskId} 分配给 ${creepName}`);
    return true;
  }

  /**
   * 获取creep的当前任务
   */
  public getCreepTask(creepName: string): Task | null {
    if (!Memory.tasks) return null;

    const taskId = Memory.tasks.creepTasks[creepName];
    if (!taskId) return null;

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

      // 更新统计信息
      if (status === TaskStatus.COMPLETED) {
        Memory.tasks.stats.tasksCompleted++;
      } else {
        Memory.tasks.stats.tasksFailed++;
      }

      // 添加到完成列表等待清理
      Memory.tasks.completedTasks.push(taskId);
    }
  }

  /**
   * 清理完成的任务
   */
  public cleanup(): void {
    if (!Memory.tasks) return;

    // 使用配置的清理周期
    if (!TaskRoleMapping.shouldPerformCleanup(Memory.tasks.lastCleanup, 'MAIN_CLEANUP')) {
      return;
    }

    // 清理完成的任务（保留配置的数量）
    const completedToKeep = Memory.tasks.completedTasks.slice(
      -TaskRoleMapping.getCleanupConfig('COMPLETED_TASKS_TO_KEEP')
    );
    const tasksToRemove = Memory.tasks.completedTasks.slice(
      0, -TaskRoleMapping.getCleanupConfig('COMPLETED_TASKS_TO_KEEP')
    );

    Memory.tasks.taskQueue = Memory.tasks.taskQueue.filter(task =>
      !tasksToRemove.includes(task.id)
    );

    Memory.tasks.completedTasks = completedToKeep;
    Memory.tasks.lastCleanup = Game.time;

    // 清理死亡creep的任务分配
    this.cleanupDeadCreepTasks();

    // 清理过期任务
    this.cleanupExpiredTasks();

    // console.log(`[TaskManager] 清理完成: 移除 ${tasksToRemove.length} 个已完成任务`);
  }

  /**
   * 清理死亡creep的任务分配
   * 现在只处理事件触发的清理，不再主动检测
   */
  private cleanupDeadCreepTasks(): void {
    if (!Memory.tasks) return;

    // 这个方法现在只处理事件触发的清理
    // 不再主动检测creep状态，完全依赖事件驱动
    // console.log(`[TaskManager] 清理完成`);
  }

  /**
   * 清理过期任务
   */
  private cleanupExpiredTasks(): void {
    if (!Memory.tasks) return;

    const originalCount = Memory.tasks.taskQueue.length;
    Memory.tasks.taskQueue = Memory.tasks.taskQueue.filter(task => {
      // 检查任务是否过期
      if (TaskRoleMapping.isTaskExpired(task.createdAt)) {
        console.log(`[TaskManager] 移除过期任务: ${task.id} (${task.type})`);
        return false;
      }

      // 检查任务执行是否超时
      if (task.startedAt && TaskRoleMapping.isTaskExecutionTimeout(task.startedAt)) {
        console.log(`[TaskManager] 移除超时任务: ${task.id} (${task.type})`);
        return false;
      }

      return true;
    });

    const removedCount = originalCount - Memory.tasks.taskQueue.length;
    if (removedCount > 0) {
      console.log(`[TaskManager] 清理了 ${removedCount} 个过期/超时任务`);
    }
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return `task_${Game.time}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取任务统计信息
   */
  public getStats(): any {
    if (!Memory.tasks) return {};

    return {
      pendingTasks: this.getPendingTasks().length,
      totalTasks: Memory.tasks.taskQueue.length,
      ...Memory.tasks.stats
    };
  }

  /**
   * 重置时的清理工作
   */
  protected onReset(): void {
    // 任务系统现在总是启用，不需要重置开关
  }
}
