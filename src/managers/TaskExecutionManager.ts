import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { TaskManager } from "./TaskManager";
import { Task, TaskStatus } from "types";
import { GameConfig } from "../config/GameConfig";
import { TaskRoleMapping } from "../config/TaskConfig";

/**
 * 任务执行管理器 - 管理所有creep的任务执行
 * 替代原有的 BehaviorManager
 */
export class TaskExecutionManager extends BaseManager {
  private taskManager: TaskManager;

  constructor(eventBus: EventBus, taskManager: TaskManager) {
    super(eventBus);
    this.taskManager = taskManager;
    this.setupEventListeners();
    this.cleanupOldBehaviorData();
  }

  /**
   * 清理旧的行为系统数据
   */
  private cleanupOldBehaviorData(): void {
    // 清理旧的行为统计数据
    if ('behaviorStats' in Memory) {
      (Memory as any).behaviorStats = undefined;
      console.log('[TaskExecutionManager] 已清理旧的行为统计数据');
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.on(GameConfig.EVENTS.CREEP_SPAWNED, (data: any) => {
      console.log(`[TaskExecutionManager] 新creep已出生: ${data.name}, 角色: ${data.role}`);
    });

    this.on(GameConfig.EVENTS.CREEP_DIED, (data: any) => {
      console.log(`[TaskExecutionManager] Creep已死亡: ${data.name}, 角色: ${data.role}`);
    });
  }

  public update(): void {
    if (!this.shouldUpdate()) return;

    this.safeExecute(() => {
      this.executeAllCreepTasks();
    }, 'TaskExecutionManager.update');

    this.updateCompleted();
  }

  /**
   * 执行所有creep的任务
   */
  private executeAllCreepTasks(): void {
    const startTime = Game.cpu.getUsed();
    let executedCount = 0;
    let successCount = 0;

    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      const task = this.taskManager.getCreepTask(creep.name);

      if (task) {
        const result = this.executeTask(creep, task);
        executedCount++;
        if (result.success) {
          successCount++;
        }
      }
    }

    const executionTime = Game.cpu.getUsed() - startTime;

    // 定期输出统计信息
    if (TaskRoleMapping.shouldPerformCleanup(Game.time, 'STATS_OUTPUT')) {
      console.log(`[TaskExecutionManager] 执行了 ${executedCount} 个任务, 成功: ${successCount}, CPU: ${executionTime.toFixed(2)}`);
    }
  }

  /**
   * 执行单个creep的任务
   */
  private executeTask(creep: Creep, task: Task): { success: boolean; message?: string } {
    const executor = this.taskManager.getTaskExecutor(task.type);
    if (!executor) {
      return { success: false, message: `未找到任务执行器: ${task.type}` };
    }

    const result = executor.execute(creep, task);

    // 更新任务状态
    if (result.completed) {
      this.taskManager.updateTaskStatus(task.id,
        result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED);
    } else if (task.status !== TaskStatus.IN_PROGRESS) {
      this.taskManager.updateTaskStatus(task.id, TaskStatus.IN_PROGRESS);
    }

    return {
      success: result.success,
      message: result.message
    };
  }

  /**
   * 获取任务执行统计信息
   */
  public getTaskExecutionStats(): any {
    const stats = {
      totalCreeps: Object.keys(Game.creeps).length,
      assignedTasks: 0,
      completedTasks: 0,
      failedTasks: 0
    };

    for (const name in Game.creeps) {
      const task = this.taskManager.getCreepTask(name);
      if (task) {
        stats.assignedTasks++;
        if (task.status === TaskStatus.COMPLETED) {
          stats.completedTasks++;
        } else if (task.status === TaskStatus.FAILED) {
          stats.failedTasks++;
        }
      }
    }

    return stats;
  }

  protected onReset(): void {
    // 重置时清理任务分配
    if (Memory.tasks && Memory.tasks.creepTasks) {
      Memory.tasks.creepTasks = {};
    }
  }
}
