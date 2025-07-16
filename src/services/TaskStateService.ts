import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import {
  Task, TaskType, TaskStatus, TaskAssignmentType, TaskLifetime, TaskFSMMemory,
  TaskKind, HarvestState, TransportState, BuildState, UpgradeState, AttackState
} from "../types";
import { BaseService } from "./BaseService";
import { ServiceContainer } from "core/ServiceContainer";

/**
 * 任务状态服务 - 管理任务的状态和生命周期
 */
export class TaskStateService extends BaseService {

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
  }

  public initialize(): void {
    this.initializeMemory();
  }

  /**
   * 初始化内存结构
   */
  private initializeMemory(): void {
    if (!Memory.tasks) {
      Memory.tasks = {
        taskQueue: [],
        creepTasks: {},
        taskAssignments: {},
        completedTasks: [],
        lastCleanup: 0,
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
   * 获取任务类型的默认属性
   * TODO 后续可能需要进一步优化 maxAssignees改成基于创建任务时的状态进行动态配置
   */
  private getTaskDefaults(taskType: TaskType): { assignmentType: TaskAssignmentType; lifetime: TaskLifetime; maxAssignees: number } {
    switch (taskType) {
      case TaskType.HARVEST:
        return { assignmentType: TaskAssignmentType.SHARED, lifetime: TaskLifetime.PERSISTENT, maxAssignees: 3 };
      case TaskType.TRANSPORT:
        return { assignmentType: TaskAssignmentType.EXCLUSIVE, lifetime: TaskLifetime.ONCE, maxAssignees: 1 };
      case TaskType.BUILD:
        return { assignmentType: TaskAssignmentType.SHARED, lifetime: TaskLifetime.ONCE, maxAssignees: 5 };
      case TaskType.REPAIR:
        return { assignmentType: TaskAssignmentType.SHARED, lifetime: TaskLifetime.ONCE, maxAssignees: 3 };
      case TaskType.UPGRADE:
        return { assignmentType: TaskAssignmentType.SHARED, lifetime: TaskLifetime.PERSISTENT, maxAssignees: 4 };
      case TaskType.ATTACK:
        return { assignmentType: TaskAssignmentType.SHARED, lifetime: TaskLifetime.ONCE, maxAssignees: 10 };
      default:
        return { assignmentType: TaskAssignmentType.EXCLUSIVE, lifetime: TaskLifetime.ONCE, maxAssignees: 1 };
    }
  }

  /**
   * 创建新任务
   */
  public createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'retryCount' | 'assignmentType' | 'lifetime' | 'maxAssignees' | 'assignedCreeps'> & Partial<Pick<Task, 'maxAssignees'>>): string {
    const taskId = this.generateTaskId();
    const defaults = this.getTaskDefaults(task.type);

    const newTask: Task = {
      ...task,
      id: taskId,
      status: TaskStatus.PENDING,
      assignmentType: defaults.assignmentType,
      lifetime: defaults.lifetime,
      maxAssignees: task.maxAssignees !== undefined ? task.maxAssignees : defaults.maxAssignees,
      assignedCreeps: [],
      createdAt: Game.time,
      updatedAt: Game.time,
      retryCount: 0,
      maxRetries: 3,
      fsm: this.initializeTaskFSMMemory(task.type)
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
    if (!task) return false;

    // 对于共享任务，允许在PENDING、ASSIGNED、IN_PROGRESS状态下继续分配
    // 对于独占任务，只允许在PENDING状态下分配
    const canAssign = task.assignmentType === TaskAssignmentType.SHARED
      ? (task.status === TaskStatus.PENDING || task.status === TaskStatus.ASSIGNED || task.status === TaskStatus.IN_PROGRESS)
      : (task.status === TaskStatus.PENDING);

    if (!canAssign) {
      return false;
    }

    // 检查是否已达到最大分配数
    if (task.assignedCreeps.length >= task.maxAssignees) {
      return false;
    }

    // 检查该creep是否已被分配到此任务
    if (task.assignedCreeps.includes(creepName)) {
      return false;
    }

    // 添加到分配列表
    task.assignedCreeps.push(creepName);

    // 更新任务状态
    if (task.status === TaskStatus.PENDING) {
      task.status = TaskStatus.ASSIGNED;
    }
    task.updatedAt = Game.time;

    // 更新映射关系
    if (Memory.tasks.creepTasks) {
      Memory.tasks.creepTasks[creepName] = taskId;
    }
    if (Memory.tasks.taskAssignments) {
      if (!Memory.tasks.taskAssignments[taskId]) {
        Memory.tasks.taskAssignments[taskId] = [];
      }
      Memory.tasks.taskAssignments[taskId].push(creepName);
    }

    return true;
  }

  /**
   * 从任务中移除creep分配
   */
  public unassignCreep(creepName: string): boolean {
    if (!Memory.tasks) return false;

    const taskId = Memory.tasks.creepTasks[creepName];
    if (!taskId) return false;

    const task = Memory.tasks.taskQueue.find(t => t.id === taskId);
    if (!task) return false;

    // 从任务的分配列表中移除
    const index = task.assignedCreeps.indexOf(creepName);
    if (index > -1) {
      task.assignedCreeps.splice(index, 1);
    }

    // 更新任务状态
    if (task.assignedCreeps.length === 0) {
      task.status = TaskStatus.PENDING;
    }

    // 清理映射关系
    delete Memory.tasks.creepTasks[creepName];
    if (Memory.tasks.taskAssignments && Memory.tasks.taskAssignments[taskId]) {
      const assignIndex = Memory.tasks.taskAssignments[taskId].indexOf(creepName);
      if (assignIndex > -1) {
        Memory.tasks.taskAssignments[taskId].splice(assignIndex, 1);
      }
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

      // 清理所有分配的creep
      for (const creepName of task.assignedCreeps) {
        if (Memory.tasks.creepTasks[creepName]) {
          delete Memory.tasks.creepTasks[creepName];
        }
      }

      // 清理任务分配映射
      if (Memory.tasks.taskAssignments[taskId]) {
        delete Memory.tasks.taskAssignments[taskId];
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
          // 从任务的分配列表中移除死亡的creep
          const index = task.assignedCreeps.indexOf(creepName);
          if (index > -1) {
            task.assignedCreeps.splice(index, 1);
          }

          // 如果没有分配的creep了，重置状态为PENDING
          if (task.assignedCreeps.length === 0) {
            task.status = TaskStatus.PENDING;
          }

          // 清理任务分配映射
          if (Memory.tasks.taskAssignments && Memory.tasks.taskAssignments[taskId]) {
            const assignIndex = Memory.tasks.taskAssignments[taskId].indexOf(creepName);
            if (assignIndex > -1) {
              Memory.tasks.taskAssignments[taskId].splice(assignIndex, 1);
            }
          }
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
          // 从任务的分配列表中移除死亡的creep
          const index = task.assignedCreeps.indexOf(creepName);
          if (index > -1) {
            task.assignedCreeps.splice(index, 1);
          }

          // 如果没有分配的creep了，重置状态为PENDING
          if (task.assignedCreeps.length === 0) {
            task.status = TaskStatus.PENDING;
          }

          // 清理任务分配映射
          if (Memory.tasks.taskAssignments && Memory.tasks.taskAssignments[taskId]) {
            const assignIndex = Memory.tasks.taskAssignments[taskId].indexOf(creepName);
            if (assignIndex > -1) {
              Memory.tasks.taskAssignments[taskId].splice(assignIndex, 1);
            }
          }
        }
      }
    });
  }

  /**
   * 获取指定房间任务信息
   */
  public getTasksByRoom(roomName: string): Task[] {
    if (!Memory.tasks) return [];
    return Memory.tasks.taskQueue.filter(task => task.roomName === roomName);
  }

  /**
   * 初始化任务的状态机内存
   */
  private initializeTaskFSMMemory(taskType: TaskType): TaskFSMMemory {
    const kind = this.mapTaskTypeToKind(taskType);
    const initialState = this.getInitialState(taskType);

    return {
      kind,
      taskState: initialState,
      context: {},
      groupId: undefined,
      creepStates: {}
    };
  }

  /**
   * 将 TaskType 映射到 TaskKind
   */
  private mapTaskTypeToKind(taskType: TaskType): TaskKind {
    switch (taskType) {
      case TaskType.HARVEST:
        return TaskKind.HARVEST;
      case TaskType.TRANSPORT:
        return TaskKind.TRANSPORT;
      case TaskType.BUILD:
        return TaskKind.BUILD;
      case TaskType.UPGRADE:
        return TaskKind.UPGRADE;
      case TaskType.ATTACK:
        return TaskKind.ATTACK;
      default:
        throw new Error(`未知的任务类型: ${taskType}`);
    }
  }

  /**
   * 获取任务的初始状态
   */
  private getInitialState(taskType: TaskType): string {
    switch (taskType) {
      case TaskType.HARVEST:
        return HarvestState.INIT;
      case TaskType.TRANSPORT:
        return TransportState.INIT;
      case TaskType.BUILD:
        return BuildState.INIT;
      case TaskType.UPGRADE:
        return UpgradeState.INIT;
      case TaskType.ATTACK:
        return AttackState.INIT;
      default:
        throw new Error(`未知的任务类型: ${taskType}`);
    }
  }
}
