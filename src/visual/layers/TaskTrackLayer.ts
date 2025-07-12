import { BaseLayer } from './BaseLayer';
import { VisualConfig } from '../../config/VisualConfig';
import { ServiceContainer } from '../../core/ServiceContainer';
import { EventBus } from '../../core/EventBus';
import { LayerType, Task, TaskType } from '../../types';
import { TaskStateService } from '../../services/TaskStateService';

/**
 * 任务追踪图层
 */
export class TaskTrackLayer extends BaseLayer {
  protected name: string = "TaskTrackLayer";
  public layerType: LayerType = LayerType.MAP;
  private taskStateService: TaskStateService;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.taskStateService = this.serviceContainer.get<TaskStateService>('taskStateService');
    this.priority = VisualConfig.LAYER_DEFAULTS.TaskTrackLayer.priority;
  }

  /**
   * 渲染任务信息
   */
  public render(room: Room): void {
    if (!this.taskStateService) {
      console.log('[TaskTrackLayer] TaskStateService not found');
      return;
    }

    const activeTasks = this.taskStateService.getActiveTasks();

    for (const task of activeTasks) {
      // 为每个分配的creep绘制连线
      for (const creepName of task.assignedCreeps) {
        const creep = Game.creeps[creepName];
        if (!creep) continue;

        const taskInfo = this.getTaskInfo(task);
        if (taskInfo.targetPos) {
          // 使用RoomVisual进行绘制
          const visual = new RoomVisual(creep.pos.roomName);

          // 绘制从 creep 到目标的连线
          visual.line(creep.pos.x, creep.pos.y, taskInfo.targetPos.x, taskInfo.targetPos.y, {
            ...taskInfo.style,
            lineStyle: 'dashed'
          });

          // 在目标位置显示任务类型
          visual.text(task.type.substring(0, 2).toUpperCase(), taskInfo.targetPos.x, taskInfo.targetPos.y, {
            ...taskInfo.style
          });
        }
      }
    }
  }

  /**
   * 获取任务信息（样式和目标位置）
   */
  private getTaskInfo(task: Task): { style: any; targetPos: RoomPosition | null } {
    const taskColors = VisualConfig.TASK_COLORS;
    let target: RoomObject | null = null;
    let targetPos: { x: number; y: number; roomName: string } | undefined;
    let style: any;

    switch (task.type) {
      case TaskType.HARVEST:
        target = Game.getObjectById(task.params.sourceId as Id<Source>);
        targetPos = (task.params as any).targetPos;
        style = taskColors.HARVEST;
        break;
      case TaskType.TRANSPORT:
        target = Game.getObjectById((task.params as any).targetId as Id<AnyStoreStructure>);
        targetPos = (task.params as any).targetPos;
        style = taskColors.TRANSPORT;
        break;
      case TaskType.BUILD:
        target = Game.getObjectById((task.params as any).targetId as Id<ConstructionSite>);
        style = taskColors.BUILD;
        break;
      case TaskType.UPGRADE:
        target = Game.getObjectById((task.params as any).controllerId as Id<StructureController>);
        style = taskColors.UPGRADE;
        break;
      case TaskType.ATTACK:
        target = Game.getObjectById((task.params as any).targetId as Id<Creep | Structure>);
        style = taskColors.ATTACK;
        break;
      default:
        // 默认使用原来的样式
        style = VisualConfig.STYLES.TASK_TRACK_STYLE;
        break;
    }

    // 确定最终的目标位置
    let finalTargetPos: RoomPosition | null = null;
    if (target) {
      finalTargetPos = target.pos;
    } else if (targetPos) {
      finalTargetPos = new RoomPosition(targetPos.x, targetPos.y, targetPos.roomName);
    }

    return { style, targetPos: finalTargetPos };
  }
}
