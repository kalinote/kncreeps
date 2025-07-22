import { TaskType } from "../types";
import { BaseTaskExecutor } from "./executors/BaseTaskExecutor";
import { AttackTaskExecutor } from "./executors/AttackTaskExecutor";
import { UpgradeTaskExecutor } from "./executors/UpgradeTaskExecutor";

/**
 * 任务执行器注册表
 */
export class TaskExecutorRegistry {
  private executors: Map<TaskType, BaseTaskExecutor> = new Map();

  constructor() {
    this.registerExecutors();
  }

  /**
   * 注册所有任务执行器
   */
  private registerExecutors(): void {
    // 注册升级任务执行器
    this.executors.set(TaskType.UPGRADE, new UpgradeTaskExecutor());

    // 注册攻击任务执行器
    this.executors.set(TaskType.ATTACK, new AttackTaskExecutor());

    // console.log(`[TaskExecutorRegistry] 已注册 ${this.executors.size} 种任务执行器`);
  }

  /**
   * 获取任务执行器
   */
  public getExecutor(taskType: TaskType): BaseTaskExecutor | undefined {
    return this.executors.get(taskType);
  }

  /**
   * 检查是否存在指定类型的执行器
   */
  public hasExecutor(taskType: TaskType): boolean {
    return this.executors.has(taskType);
  }

  /**
   * 获取所有已注册的任务类型
   */
  public getRegisteredTaskTypes(): TaskType[] {
    return Array.from(this.executors.keys());
  }
}
