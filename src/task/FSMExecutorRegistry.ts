import { TaskType, TaskFSMMemory, FSMExecutorClass } from "../types";
import { HarvestFSMExecutor } from "./executors/HarvestFSMExecutor";
import { TransportFSMExecutor } from "./executors/TransportFSMExecutor";
import { UpgradeFSMExecutor } from "./executors/UpgradeFSMExecutor";
import { BuildFSMExecutor } from "./executors/BuildFSMExecutor";
import { TaskStateMachine } from "./fsm/StateMachine";
import { TaskExecutionService } from "services/task/TaskExecutionService";

/**
 * FSM 执行器注册表
 * 管理基于状态机的任务执行器
 */
export class FSMExecutorRegistry {
  private service: TaskExecutionService;
  private executors: Map<TaskType, FSMExecutorClass> = new Map();

  constructor(service: TaskExecutionService) {
    this.service = service;
    this.registerExecutors();
  }

  /**
   * 注册所有 FSM 执行器
   */
  private registerExecutors(): void {
    this.executors.set(TaskType.HARVEST, HarvestFSMExecutor);
    this.executors.set(TaskType.TRANSPORT, TransportFSMExecutor);
    this.executors.set(TaskType.UPGRADE, UpgradeFSMExecutor);
    this.executors.set(TaskType.BUILD, BuildFSMExecutor);
  }

  /**
   * 获取 FSM 执行器
   */
  public getExecutor(taskType: TaskType): FSMExecutorClass | undefined {
    return this.executors.get(taskType);
  }

  /**
   * 检查是否存在指定类型的 FSM 执行器
   */
  public hasExecutor(taskType: TaskType): boolean {
    return this.executors.has(taskType);
  }

  /**
   * 创建 FSM 执行器实例
   */
  public createExecutor(taskType: TaskType, memory: TaskFSMMemory<any>, creep: Creep): TaskStateMachine<any> | undefined {
    const ExecutorClass = this.executors.get(taskType);
    if (!ExecutorClass) {
      return undefined;
    }
    return new ExecutorClass(memory, this.service, creep);
  }

  /**
   * 获取所有已注册的任务类型
   */
  public getRegisteredTaskTypes(): TaskType[] {
    return Array.from(this.executors.keys());
  }
}
