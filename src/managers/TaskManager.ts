import { TaskExecutorRegistry } from "../task/TaskExecutorRegistry";
import { EventBus } from "../core/EventBus";
import { Task, TaskType, TaskStatus, TaskPriority, TaskSystemMemory, TaskFSMMemory } from "../types";
import { BaseManager } from "./BaseManager";
import { TaskRoleMapping } from "../config/TaskConfig";
import { GameConfig } from "../config/GameConfig";
import { TaskGeneratorService } from "../services/TaskGeneratorService";
import { TaskSchedulerService } from "../services/TaskSchedulerService";
import { TaskStateService } from "../services/TaskStateService";
import { FSMExecutorRegistry } from "../task/FSMExecutorRegistry";
import { TaskStateMachine } from "../task/fsm/StateMachine";
import { ServiceContainer } from "../core/ServiceContainer";

/**
 * 任务管理器 - 管理所有任务的生命周期
 */
export class TaskManager extends BaseManager {
  private executorRegistry: TaskExecutorRegistry;
  private fsmExecutorRegistry: FSMExecutorRegistry;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.updateInterval = GameConfig.MANAGER_CONFIGS.TASK_MANAGER.UPDATE_INTERVAL;
    this.executorRegistry = new TaskExecutorRegistry();
    this.fsmExecutorRegistry = new FSMExecutorRegistry(serviceContainer);
    this.taskStateService.initialize();
  }

  private get taskGeneratorService(): TaskGeneratorService {
    return this.serviceContainer.get('taskGeneratorService');
  }

  private get taskSchedulerService(): TaskSchedulerService {
    return this.serviceContainer.get('taskSchedulerService');
  }

  private get taskStateService(): TaskStateService {
    return this.serviceContainer.get('taskStateService');
  }

  /**
   * 更新方法 - 被 GameEngine 调用
   */
  public update(): void {
    if (!this.shouldUpdate()) return;

    this.safeExecute(() => {
      // 1. 生成新任务
      this.taskGeneratorService.update();

      // 2. 分配任务给空闲creep
      this.taskSchedulerService.update();

      // 3. 清理完成的任务
      this.taskStateService.cleanup();

      // 4. 输出调试信息
      if (TaskRoleMapping.shouldPerformCleanup(Game.time, 'STATS_OUTPUT')) {
        this.logTaskStats();
      }
    }, 'TaskManager.update');

    this.updateCompleted();
  }

  /**
   * 输出任务统计信息
   */
  private logTaskStats(): void {
    const stats = this.taskStateService.getStats();
    // console.log(`[TaskManager] 任务统计 - 待处理:${stats.pendingTasks}, 总计:${stats.totalTasks}, 已创建:${stats.tasksCreated}, 已完成:${stats.tasksCompleted}`);

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

  // All other methods are now moved to TaskStateService.
  // We can add proxy methods here if other managers need them,
  // but for now, we assume they will get the service from the container.
  public getCreepTask(creepName: string): Task | null {
    return this.taskStateService.getCreepTask(creepName);
  }

  public updateTaskStatus(taskId: string, status: TaskStatus): void {
    this.taskStateService.updateTaskStatus(taskId, status);
  }

  // 下面的代码是状态机重构新增的
  /**
   * 获取 FSM 执行器
   */
  public getFSMExecutor(taskType: TaskType) {
    return this.fsmExecutorRegistry.getExecutor(taskType);
  }

  /**
   * 创建 FSM 执行器实例
   */
  public createFSMExecutor(taskType: TaskType, memory: TaskFSMMemory, creep: Creep): TaskStateMachine<any> | undefined {
    return this.fsmExecutorRegistry.createExecutor(taskType, memory, creep);
  }

  /**
   * 检查任务是否使用 FSM 执行器
   */
  public isFSMTask(taskType: TaskType): boolean {
    return this.fsmExecutorRegistry.hasExecutor(taskType);
  }
}
