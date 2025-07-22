import { LayerType, TaskAssignmentType } from "../../types";
import { BaseLayer } from "./BaseLayer";
import { EventBus } from "../../core/EventBus";
import { ServiceContainer } from "../../core/ServiceContainer";
import { VisualConfig } from "../../config/VisualConfig";
import { TaskStateService } from "../../services/TaskStateService";
import { PriorityCalculator } from "../../utils/PriorityCalculator";

export class TaskAssignmentLayer extends BaseLayer {
  protected name: string = "TaskAssignmentLayer";
  protected title: string = "任务分配情况";
  public layerType: LayerType = LayerType.DATA;
  private taskStateService: TaskStateService;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.textStyle = VisualConfig.STYLES.TASK_ASSIGNMENT_STYLE;
    this.taskStateService = this.serviceContainer.get<TaskStateService>("taskStateService");
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
