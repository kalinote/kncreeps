import { TaskManager } from '../../managers/TaskManager';
import { VisualLayer } from '../VisualLayer';
import { VisualConfig } from '../../config/VisualConfig';
import { ServiceContainer } from '../../core/ServiceContainer';
import { EventBus } from '../../core/EventBus';
import { Task, TaskType } from '../../types';

/**
 * 任务追踪图层
 */
export class TaskTrackLayer extends VisualLayer {
  private taskManager: TaskManager;

  constructor(eventBus: EventBus) {
    const serviceContainer = (global as any).serviceContainer as ServiceContainer;
    super(VisualConfig.LAYERS.TASK_TRACK, eventBus);
    this.taskManager = serviceContainer.get<TaskManager>('taskManager');
    this.priority = VisualConfig.LAYER_DEFAULTS.TaskTrackLayer.priority;
  }

  /**
   * 渲染任务信息
   */
  public render(): void {
    if (!this.taskManager) {
      return;
    }

    const activeTasks = this.taskManager.getActiveTasks();

    for (const task of activeTasks) {
      if (task.assignedCreep) {
        const creep = Game.creeps[task.assignedCreep];
        if (!creep) continue;

        const targetPos = this.getTaskTargetPosition(task);
        if (targetPos) {
          // 绘制从 creep 到目标的连线
          Game.map.visual.line(creep.pos, targetPos, {
            ...VisualConfig.STYLES.TASK_TRACK_STYLE,
            lineStyle: 'dashed'
          });

          // 在目标位置显示任务类型
          Game.map.visual.text(task.type.substring(0, 2).toUpperCase(), targetPos, {
            ...VisualConfig.STYLES.TASK_TRACK_STYLE
          });
        }
      }
    }
  }

  /**
   * 根据任务获取其目标位置
   */
  private getTaskTargetPosition(task: Task): RoomPosition | null {
    let target: RoomObject | null = null;
    let targetPos: { x: number; y: number; roomName: string } | undefined;

    switch (task.type) {
      case TaskType.HARVEST:
        target = Game.getObjectById(task.params.sourceId as Id<Source>);
        targetPos = task.params.targetPos;
        break;
      case TaskType.TRANSPORT:
        target = Game.getObjectById(task.params.targetId as Id<AnyStoreStructure>);
        targetPos = task.params.targetPos;
        break;
      case TaskType.BUILD:
        target = Game.getObjectById(task.params.targetId as Id<ConstructionSite>);
        break;
      case TaskType.UPGRADE:
        target = Game.getObjectById(task.params.controllerId as Id<StructureController>);
        break;
      case TaskType.ATTACK:
        target = Game.getObjectById(task.params.targetId as Id<Creep | Structure>);
        break;
    }

    if (target) {
      return target.pos;
    }
    if (targetPos) {
      return new RoomPosition(targetPos.x, targetPos.y, targetPos.roomName);
    }

    return null;
  }
}
