import { BaseService } from "../BaseService";
import { EventBus } from "../../core/EventBus";
import { TaskManager } from "../../managers/TaskManager";
import { FSMExecutorClass, Task, TaskExecutionServiceMemory, TaskFSMMemory, TaskManagerMemory, TaskStatus, TaskType } from "../../types";
import { GameConfig } from "../../config/GameConfig";
import { Safe } from "../../utils/Decorators";
import { FSMExecutorRegistry } from "../../task/FSMExecutorRegistry";
import { TaskStateMachine } from "task/fsm/StateMachine";
import { CreepMoveService } from "../creep/CreepMoveService";
import { EnergyService } from "../logistics/EnergyService";
import { TransportService } from "../logistics/TransportService";
import { SupplyService } from "../logistics/SupplyService";
import { registerCommand } from "../../command/registerCommand";

/**
 * 任务执行服务 - 负责驱动所有Creep执行其分配到的任务
 */
export class TaskExecutionService extends BaseService<TaskExecutionServiceMemory, TaskManager> {
  private _fsmExecutorRegistry: FSMExecutorRegistry;

  public get fsmExecutorRegistry(): FSMExecutorRegistry {
    return this._fsmExecutorRegistry;
  }

  constructor(eventBus: EventBus, manager: TaskManager, memory: TaskManagerMemory) {
    super(eventBus, manager, memory, 'execution');
    this._fsmExecutorRegistry = new FSMExecutorRegistry(this);
  }

  public get moveService(): CreepMoveService {
    return this.manager.creepManager.moveService;
  }

  public get energyService(): EnergyService {
    return this.manager.logisticsManager.energyService;
  }

  public get transportService(): TransportService {
    return this.manager.logisticsManager.transportService;
  }

  public get supplyService(): SupplyService {
    return this.manager.logisticsManager.supplyService;
  }

  protected onCleanup(): void {}
  protected onReset(): void {}

  protected onInitialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastUpdate = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
    }
  }

  @Safe()
  protected onUpdate(): void {
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      // 如果creep正在生成，则跳过
      if (creep.spawning) {
        continue;
      }

      const task = this.manager.getCreepTask(creep.name);

      if (task) {
        this.executeTask(creep, task);
      }
    }
  }

  // 添加新的 FSM 执行方法：
  private executeTask(creep: Creep, task: Task): { success: boolean; message?: string } {
    try {
      const fsmExecutor = this.manager.createFSMExecutor(task.type, task.fsm!, creep);
      if (!fsmExecutor) {
        const errorMessage = `未找到任务类型 '${task.type}' 的 FSM 执行器`;
        console.log(`[TaskExecutionService] ${errorMessage} for task ID: ${task.id}`);
        this.manager.updateTaskStatus(task.id, TaskStatus.FAILED);
        this.emit(GameConfig.EVENTS.TASK_FAILED, {
          taskId: task.id,
          reason: errorMessage
        });
        return { success: false, message: errorMessage };
      }

      // 执行 FSM tick
      fsmExecutor.tick();

      // 检查该creep的任务是否完成
      if (fsmExecutor.isFinished()) {
        // 该 creep 已完成自身任务，立即解除绑定，防止占用共享任务名额
        this.manager.taskStateService.unassignCreep(creep.name);

        // 检查任务是否整体完成（所有creep都完成）
        if (fsmExecutor.isTaskFinished()) {
          this.manager.updateTaskStatus(task.id, TaskStatus.COMPLETED);
          this.emit(GameConfig.EVENTS.TASK_COMPLETED, {
            taskId: task.id,
            taskType: task.type,
            roomName: task.roomName
          });
        }
        return { success: true, message: '该creep任务完成' };
      }

      // 更新任务状态为进行中
      if (task.status !== TaskStatus.IN_PROGRESS) {
        this.manager.updateTaskStatus(task.id, TaskStatus.IN_PROGRESS);
        this.emit(GameConfig.EVENTS.TASK_STARTED, {
          taskId: task.id,
          taskType: task.type,
          creepName: creep.name,
          roomName: task.roomName
        });
      }

      return { success: true, message: '任务进行中' };
    } catch (error) {
      console.log(`[TaskExecutionService] FSM 执行错误: ${error}`);
      return { success: false, message: `FSM 执行错误: ${error}` };
    }
  }

  public getCreepTask(creepName: string): Task | null {
    return this.manager.getCreepTask(creepName);
  }

  public getExecutor(taskType: TaskType): FSMExecutorClass | undefined {
    return this.fsmExecutorRegistry.getExecutor(taskType);
  }

  public createExecutor(taskType: TaskType, memory: TaskFSMMemory, creep: Creep): TaskStateMachine<any> | undefined {
    return this.fsmExecutorRegistry.createExecutor(taskType, memory, creep);
  }

  public hasExecutor(taskType: TaskType): boolean {
    return this.fsmExecutorRegistry.hasExecutor(taskType);
  }
}
