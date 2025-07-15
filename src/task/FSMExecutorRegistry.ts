import { ServiceContainer } from "../core/ServiceContainer";
import { TaskType, TaskKind, TaskFSMMemory } from "../types";
import { HarvestFSMExecutor } from "./executors/HarvestFSMExecutor";
import { TransportFSMExecutor } from "./executors/TransportFSMExecutor";
import { TaskStateMachine } from "./fsm/StateMachine";

/**
 * FSM 执行器注册表
 * 管理基于状态机的任务执行器
 */
export class FSMExecutorRegistry {
  // 修改类型定义，使用更宽松的泛型约束
  private executors: Map<TaskType, new (memory: TaskFSMMemory<any>, serviceContainer: ServiceContainer) => TaskStateMachine<any>> = new Map();
  private serviceContainer: ServiceContainer;

  constructor(serviceContainer: ServiceContainer) {
    this.serviceContainer = serviceContainer;
    this.registerExecutors();
  }

  /**
   * 注册所有 FSM 执行器
   */
  private registerExecutors(): void {
    this.executors.set(TaskType.HARVEST, HarvestFSMExecutor);
    this.executors.set(TaskType.TRANSPORT, TransportFSMExecutor);

    // 注意：其他执行器暂时不注册，等后续重构时再添加
    // this.executors.set(TaskType.BUILD, BuildFSMExecutor);
    // this.executors.set(TaskType.UPGRADE, UpgradeFSMExecutor);
    // this.executors.set(TaskType.ATTACK, AttackFSMExecutor);
  }

  /**
   * 获取 FSM 执行器
   */
  public getExecutor(taskType: TaskType): (new (memory: TaskFSMMemory<any>, serviceContainer: ServiceContainer) => TaskStateMachine<any>) | undefined {
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
  public createExecutor(taskType: TaskType, memory: TaskFSMMemory<any>): TaskStateMachine<any> | undefined {
    const ExecutorClass = this.executors.get(taskType);
    if (!ExecutorClass) {
      return undefined;
    }
    return new ExecutorClass(memory, this.serviceContainer);
  }

  /**
   * 获取所有已注册的任务类型
   */
  public getRegisteredTaskTypes(): TaskType[] {
    return Array.from(this.executors.keys());
  }
}
