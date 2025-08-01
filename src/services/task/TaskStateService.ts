import { SafeMemoryAccess } from "../../utils/Decorators";
import { GameConfig } from "../../config/GameConfig";
import {
  Task, TaskType, TaskStatus, TaskAssignmentType, TaskLifetime, TaskFSMMemory,
  TaskKind, HarvestState, TransportState, BuildState, UpgradeState, AttackState,
  TaskStateServiceMemory, TaskManagerMemory
} from "../../types";
import { BaseService } from "../BaseService";
import { EventBus } from "../../core/EventBus";
import { TaskManager } from "../../managers/TaskManager";

/**
 * 任务状态服务 - 管理任务的状态和生命周期
 */
export class TaskStateService extends BaseService<TaskStateServiceMemory> {
  public update(): void { }

  constructor(eventBus: EventBus, manager: TaskManager, memory: TaskManagerMemory) {
    super(eventBus, manager, memory, 'state');
  }

  public initialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastUpdate = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
      this.memory.taskQueue = [];
      this.memory.creepTasks = {};
      this.memory.taskAssignments = {};
      this.memory.completedTasks = [];
      this.memory.tasksCreated = 0;
      this.memory.tasksCompleted = 0;
      this.memory.tasksFailed = 0;
      this.memory.averageExecutionTime = 0;
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

    this.memory.taskQueue.push(newTask);
    this.memory.tasksCreated++;

    this.emit(GameConfig.EVENTS.TASK_CREATED, { taskId });
    return taskId;
  }

  /**
   * 获取待分配的任务
   */
  public getPendingTasks(): Task[] {
    return this.memory.taskQueue.filter(task => task.status === TaskStatus.PENDING);
  }

  /**
   * 获取活跃的任务（包括待分配、已分配、进行中的任务）
   */
  @SafeMemoryAccess()
  public getActiveTasks(): Task[] {
    return this.memory.taskQueue.filter(task =>
      task.status === TaskStatus.PENDING ||
      task.status === TaskStatus.ASSIGNED ||
      task.status === TaskStatus.IN_PROGRESS
    );
  }

  /**
   * 分配任务给creep
   */
  @SafeMemoryAccess()
  public assignTask(taskId: string, creepName: string): boolean {
    const task = this.memory.taskQueue.find(t => t.id === taskId);
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
    this.memory.creepTasks[creepName] = taskId;
    if (!this.memory.taskAssignments[taskId]) {
      this.memory.taskAssignments[taskId] = [];
    }
    this.memory.taskAssignments[taskId].push(creepName);

    return true;
  }

  /**
   * 从任务中移除creep分配
   */
  public unassignCreep(creepName: string): boolean {
    const taskId = this.memory.creepTasks[creepName];
    if (!taskId) return false;

    const task = this.memory.taskQueue.find(t => t.id === taskId);
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
    delete this.memory.creepTasks[creepName];
    if (this.memory.taskAssignments[taskId]) {
      const assignIndex = this.memory.taskAssignments[taskId].indexOf(creepName);
      if (assignIndex > -1) {
        this.memory.taskAssignments[taskId].splice(assignIndex, 1);
      }
    }

    return true;
  }

  /**
   * 获取creep当前的任务
   */
  public getCreepTask(creepName: string): Task | null {
    const taskId = this.memory.creepTasks[creepName];
    if (!taskId) {
      return null;
    }

    return this.memory.taskQueue.find(t => t.id === taskId) || null;
  }

  /**
   * 更新任务状态
   */
  @SafeMemoryAccess()
  public updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.memory.taskQueue.find(t => t.id === taskId);
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
        if (this.memory.creepTasks[creepName]) {
          delete this.memory.creepTasks[creepName];
        }
      }

      // 清理任务分配映射
      if (this.memory.taskAssignments[taskId]) {
        delete this.memory.taskAssignments[taskId];
      }

      if (status === TaskStatus.COMPLETED) {
        this.memory.tasksCompleted++;
      } else {
        this.memory.tasksFailed++;
      }

      this.memory.completedTasks.push(taskId);
    }
  }

  /**
   * 清理过期的和已完成的任务
   */
  @SafeMemoryAccess()
  public cleanup(): void {
    // TODO 后续使用配置文件设置，或者使用非固定时间的更好方法
    const cleanupInterval = 50;
    if (Game.time - this.memory.lastCleanup < cleanupInterval) {
      return;
    }

    // 清理已完成的任务
    const completedTaskIds = this.memory.completedTasks;
    if (completedTaskIds.length > 0) {
      this.memory.taskQueue = this.memory.taskQueue.filter(
        task => !completedTaskIds.includes(task.id)
      );
      this.memory.completedTasks = [];
    }

    this.cleanupDeadCreepTasks();
    this.cleanupExpiredTasks();

    this.memory.lastCleanup = Game.time;
  }

  @SafeMemoryAccess()
  private cleanupDeadCreepTasks(): void {
    for (const creepName in this.memory.creepTasks) {
      if (!Game.creeps[creepName]) {
        const taskId = this.memory.creepTasks[creepName];
        delete this.memory.creepTasks[creepName];

        const task = this.memory.taskQueue.find(t => t.id === taskId);
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
          if (this.memory.taskAssignments[taskId]) {
            const assignIndex = this.memory.taskAssignments[taskId].indexOf(creepName);
            if (assignIndex > -1) {
              this.memory.taskAssignments[taskId].splice(assignIndex, 1);
            }
          }
        }
      }
    }
  }

  @SafeMemoryAccess()
  private cleanupExpiredTasks(): void {
    const expiryTime = 1500;
    this.memory.taskQueue = this.memory.taskQueue.filter(task =>
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.FAILED ||
      (Game.time - task.createdAt < expiryTime)
    );
  }

  private generateTaskId(): string {
    return `task_${Game.time}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected setupEventListeners(): void {
    this.on(GameConfig.EVENTS.CREEP_DIED, (data: any) => {
      const { creepName } = data;
      if (this.memory.creepTasks[creepName]) {
        const taskId = this.memory.creepTasks[creepName];
        delete this.memory.creepTasks[creepName];

        const task = this.memory.taskQueue.find(t => t.id === taskId);
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
          if (this.memory.taskAssignments[taskId]) {
            const assignIndex = this.memory.taskAssignments[taskId].indexOf(creepName);
            if (assignIndex > -1) {
              this.memory.taskAssignments[taskId].splice(assignIndex, 1);
            }
          }
        }
      }
    });
  }

  /**
   * 获取指定房间任务信息
   */
  @SafeMemoryAccess()
  public getTasksByRoom(roomName: string): Task[] {
    return this.memory.taskQueue.filter(task => task.roomName === roomName);
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

  public getTaskIdByCreepName(creepName: string): string | null {
    return this.memory.creepTasks[creepName] || null;
  }

  public getTaskById(taskId: string): Task | null {
    return this.memory.taskQueue.find(t => t.id === taskId) || null;
  }

  public getTaskByCreepName(creepName: string): Task | null {
    const taskId = this.memory.creepTasks[creepName];
    if (!taskId) {
      return null;
    }
    return this.memory.taskQueue.find(t => t.id === taskId) || null;
  }

  public getTasks(status?: TaskStatus): Task[] {
    return this.memory.taskQueue.filter(t => status ? t.status === status : true);
  }

}
