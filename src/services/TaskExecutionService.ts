import { BaseService } from "./BaseService";
import { EventBus } from "../core/EventBus";
import { ServiceContainer } from "../core/ServiceContainer";
import { TaskManager } from "../managers/TaskManager";
import { Task, TaskStatus } from "../types";
import { GameConfig } from "../config/GameConfig";

/**
 * 任务执行服务 - 负责驱动所有Creep执行其分配到的任务
 */
export class TaskExecutionService extends BaseService {
  private get taskManager(): TaskManager {
    return this.serviceContainer.get('taskManager');
  }

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
  }

  /**
   * 执行所有Creep的任务
   */
  public run(): void {
    this.safeExecute(() => {
      for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        // 如果creep正在生成，则跳过
        if (creep.spawning) {
          continue;
        }

        const task = this.taskManager.getCreepTask(creep.name);

        if (task) {
          this.executeTask(creep, task);
        }
      }
    }, 'TaskExecutionService.run');
  }

  /**
   * 执行单个Creep的任务，并根据结果更新任务状态和发送事件
   */
  private executeTask(creep: Creep, task: Task): { success: boolean; message?: string } {
    const executor = this.taskManager.getTaskExecutor(task.type);
    if (!executor) {
      const errorMessage = `未找到任务类型 '${task.type}' 的执行器`;
      console.log(`[TaskExecutionService] ${errorMessage} for task ID: ${task.id}`);
      this.taskManager.updateTaskStatus(task.id, TaskStatus.FAILED);
      this.emit(GameConfig.EVENTS.TASK_FAILED, {
        taskId: task.id,
        reason: errorMessage
      });
      return { success: false, message: errorMessage };
    }

    // 执行任务并获取结果
    const result = executor.execute(creep, task);

    // 根据执行结果更新任务状态
    if (result.completed) {
      const newStatus = result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED;
      this.taskManager.updateTaskStatus(task.id, newStatus);

      // 发送任务完成或失败的事件
      const eventType = result.success ? GameConfig.EVENTS.TASK_COMPLETED : GameConfig.EVENTS.TASK_FAILED;
      this.emit(eventType, {
        taskId: task.id,
        taskType: task.type,
        creepName: creep.name,
        roomName: task.roomName,
        reason: result.message // 失败时附带原因
      });
    } else if (task.status !== TaskStatus.IN_PROGRESS) {
      // 如果任务是首次执行，则更新状态为IN_PROGRESS并发送开始事件
      this.taskManager.updateTaskStatus(task.id, TaskStatus.IN_PROGRESS);
      this.emit(GameConfig.EVENTS.TASK_STARTED, {
        taskId: task.id,
        taskType: task.type,
        creepName: creep.name,
        roomName: task.roomName
      });
    } else {
      // 任务正在进行中，可以发送进度事件（如果需要）
      // this.emit(GameConfig.EVENTS.TASK_PROGRESS, { ... });
    }

    return {
      success: result.success,
      message: result.message
    };
  }
}
