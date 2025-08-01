import { LayerType, TaskAssignmentType } from "../../types";
import { BaseLayer } from "./BaseLayer";
import { VisualConfig } from "../../config/VisualConfig";
import { TaskStateService } from "../../services/task/TaskStateService";
import { PriorityCalculator } from "../../utils/PriorityCalculator";
import { VisualLayoutService } from '../../services/visual/VisualLayoutService';

export class TaskAssignmentLayer extends BaseLayer {
  protected name: string = "TaskAssignmentLayer";
  protected title: string = "任务分配情况";
  public layerType: LayerType = LayerType.DATA;

  protected get taskStateService(): TaskStateService {
    return this.service.taskStateService;
  }

  constructor(service: VisualLayoutService) {
    super(service);
    this.textStyle = VisualConfig.STYLES.TASK_ASSIGNMENT_STYLE;
  }

  public preRender(room: Room): void {
    const tasks = this.taskStateService.getTasksByRoom(room.name);

    this.clearBuffer();
    this.buffer.push({
      type: 'text',
      data: {
        text: `${room.name} 总计 ${tasks.length} 个任务`,
      },
    });
    for (const task of tasks) {
      this.buffer.push({
        type: 'text',
        data: {
          // TODO 这里每次都会再计算一次动态优先级，后续可以考虑一次计算后缓存起来
          text: `[${task.type.substring(0, 2).toUpperCase()}]${task.id.split('_')[2].substring(0, 4)}(BP:${task.basePriority},EP:${PriorityCalculator.calculate(task, Game.time).toFixed(2)}): ${task.status}(${task.assignmentType}${task.assignmentType === TaskAssignmentType.SHARED ? (',' + task.assignedCreeps.length + "/"  + task.maxAssignees) : ''})`,
        },
      });
    }
  }
}
