import { BaseService } from "../BaseService";
import { TaskGroupServiceMemory, TaskManagerMemory } from "../../types";
import { EventBus } from "../../core/EventBus";
import { TaskManager } from "../../managers/TaskManager";

/**
 * // TODO 任务组服务
 * 负责管理一组需要协同执行的任务(比如集群作战等)
 */
export class TaskGroupService extends BaseService<TaskGroupServiceMemory> {
  protected onUpdate(): void {}
  protected onCleanup(): void {}
  protected onReset(): void {}

  constructor(eventBus: EventBus, manager: TaskManager, memory: TaskManagerMemory) {
    super(eventBus, manager, memory, 'group');
  }

  protected onInitialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastUpdate = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
    }
  }
}
