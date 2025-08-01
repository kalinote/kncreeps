import { EventBus } from "../core/EventBus";
import { Task, TaskType, TaskStatus, TaskPriority, TaskManagerMemory, TaskFSMMemory } from "../types";
import { BaseManager } from "./BaseManager";
import { GameConfig } from "../config/GameConfig";
import { TaskStateMachine } from "../task/fsm/StateMachine";
import { ServiceContainer } from "../core/ServiceContainer";
import { TaskExecutionService } from "../services/task/TaskExecutionService";
import { TaskGeneratorService } from "../services/task/TaskGeneratorService";
import { TaskGroupService } from "../services/task/TaskGroupService";
import { TaskSchedulerService } from "services/task/TaskSchedulerService";
import { TaskStateService } from "services/task/TaskStateService";

/**
 * 任务管理器 - 管理所有任务的生命周期
 */
export class TaskManager extends BaseManager<TaskManagerMemory> {
  protected readonly memoryKey: string = "taskManager";

  public get taskExecutionService(): TaskExecutionService {
    return this.services.get("taskExecutionService") as TaskExecutionService;
  }
  public get taskGeneratorService(): TaskGeneratorService {
    return this.services.get("taskGeneratorService") as TaskGeneratorService;
  }
  public get taskGroupService(): TaskGroupService {
    return this.services.get("taskGroupService") as TaskGroupService;
  }

  public get taskSchedulerService(): TaskSchedulerService {
    return this.services.get("taskSchedulerService") as TaskSchedulerService;
  }

  public get taskStateService(): TaskStateService {
    return this.services.get("taskStateService") as TaskStateService;
  }

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.updateInterval = GameConfig.MANAGER_CONFIGS.TASK_MANAGER.UPDATE_INTERVAL;

    this.registerServices("taskExecutionService", new TaskExecutionService(this.eventBus, this.serviceContainer));
    this.registerServices("taskGeneratorService", new TaskGeneratorService(this.eventBus, this.serviceContainer));
    this.registerServices("taskGroupService", new TaskGroupService(this.eventBus, this.serviceContainer));
    this.registerServices("taskSchedulerService", new TaskSchedulerService(this.eventBus, this.serviceContainer));
    this.registerServices("taskStateService", new TaskStateService(this.eventBus, this.serviceContainer));
  }

  public updateManager(): void {}
  public cleanup(): void {}

  public initialize(): void {
    if (!this.memory.initAt) {
      this.memory = {
        initAt: Game.time,
        lastUpdate: Game.time,
        lastCleanup: Game.time,
        errorCount: 0
      }
    }
  }

  /**
   * 获取任务执行器
   */
  public getTaskExecutor(taskType: TaskType) {
    return this.executorRegistry.getExecutor(taskType);
  }

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
