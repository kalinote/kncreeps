import { BaseService } from "../BaseService";
import { TaskGroupServiceMemory, TaskKind } from "../../types";

/**
 * // TODO 任务组服务
 * 负责管理一组需要协同执行的任务(比如集群作战等)
 */
export class TaskGroupService extends BaseService<TaskGroupServiceMemory> {
  protected readonly memoryKey: string = "group";

  public update(): void {}
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
}
