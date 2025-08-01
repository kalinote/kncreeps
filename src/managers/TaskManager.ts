import { EventBus } from "../core/EventBus";
import { Task, TaskType, TaskStatus, TaskPriority, TaskManagerMemory, TaskFSMMemory, FSMExecutorClass } from "../types";
import { BaseManager } from "./BaseManager";
import { GameConfig } from "../config/GameConfig";
import { TaskStateMachine } from "../task/fsm/StateMachine";
import { ServiceContainer } from "../core/ServiceContainer";
import { TaskExecutionService } from "../services/task/TaskExecutionService";
import { TaskGeneratorService } from "../services/task/TaskGeneratorService";
import { TaskGroupService } from "../services/task/TaskGroupService";
import { TaskSchedulerService } from "services/task/TaskSchedulerService";
import { TaskStateService } from "services/task/TaskStateService";
import { LogisticsManager } from "./LogisticsManager";

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

  public get logisticsManager(): LogisticsManager {
    return this.serviceContainer.get("logisticsManager") as LogisticsManager;
  }

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.updateInterval = GameConfig.MANAGER_CONFIGS.TASK_MANAGER.UPDATE_INTERVAL;

    this.registerServices("taskExecutionService", new TaskExecutionService(this.eventBus, this, this.memory));
    this.registerServices("taskGeneratorService", new TaskGeneratorService(this.eventBus, this, this.memory));
    this.registerServices("taskGroupService", new TaskGroupService(this.eventBus, this, this.memory));
    this.registerServices("taskSchedulerService", new TaskSchedulerService(this.eventBus, this, this.memory));
    this.registerServices("taskStateService", new TaskStateService(this.eventBus, this, this.memory));
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
  public getExecutor(taskType: TaskType): FSMExecutorClass | undefined {
    return this.taskExecutionService.getExecutor(taskType);
  }

  /**
   * 创建 FSM 执行器实例
   */
  public createFSMExecutor(taskType: TaskType, memory: TaskFSMMemory, creep: Creep): TaskStateMachine<any> | undefined {
    return this.taskExecutionService.createExecutor(taskType, memory, creep);
  }
}
