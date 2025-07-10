import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { ServiceContainer } from "../core/ServiceContainer";
import { GameConfig } from "../config/GameConfig";
import { TaskExecutionService } from "../services/TaskExecutionService";

/**
 * 任务执行管理器 - 协调所有creep的任务执行流程
 */
export class TaskExecutionManager extends BaseManager {
  private taskExecutionService: TaskExecutionService;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.taskExecutionService = this.serviceContainer.get('taskExecutionService');
    this.updateInterval = GameConfig.MANAGER_CONFIGS.TASK_EXECUTION_MANAGER.UPDATE_INTERVAL;
  }

  /**
   * 设置事件监听器
   */
  protected setupEventListeners(): void {
    this.on(GameConfig.EVENTS.CREEP_DIED, (data: { creepName: string }) => {
      this.handleCreepDeathEvent(data);
    });
  }

  /**
   * 更新管理器，驱动任务执行服务
   */
  public update(): void {
    if (!this.shouldUpdate()) return;

    this.safeExecute(() => {
      this.taskExecutionService.run();
    }, 'TaskExecutionManager.update');

    this.updateCompleted();
  }

  /**
   * 处理creep死亡事件。
   * 当前，任务状态由TaskManager在检测到creep不存在时处理。
   * 此处可以保留用于未来扩展，例如记录日志或触发特殊协调。
   */
  private handleCreepDeathEvent(data: { creepName: string }): void {
    // console.log(`[TaskExecutionManager] Observed death of ${data.creepName}. No action taken.`);
  }

  /**
   * 重置时调用的钩子。
   * 可以在此清理与此管理器相关的内存状态，如果未来有的话。
   */
  protected onReset(): void {
    // console.log("[TaskExecutionManager] Resetting state.");
  }
}
