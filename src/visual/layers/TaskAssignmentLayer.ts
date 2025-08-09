import { LayerType, Task, TaskAssignmentType, TaskType } from "../../types";
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

    // 按照类型分类任务
    const taskTypes: { [key in TaskType]?: Task[] } = {};
    for (const task of tasks) {
      if (!taskTypes[task.type]) {
        taskTypes[task.type] = [];
      }
      taskTypes[task.type]!.push(task);
    }

    // 遍历每种任务类型
    for (const taskType in taskTypes) {
      const tasksOfType = taskTypes[taskType as TaskType]!;
      const taskTypeShort = taskType.substring(0, 2).toUpperCase();

      if (tasksOfType.length > 5) {
        for (let i = 0; i < 5; i++) {
          const task = tasksOfType[i];
          this.buffer.push({
            type: 'text',
            data: {
              text: `[${taskTypeShort}]${task.id.split('_')[2].substring(0, 4)}(BP:${task.basePriority},EP:${PriorityCalculator.calculate(task, Game.time).toFixed(2)}): ${task.status}(${task.assignmentType}${task.assignmentType === TaskAssignmentType.SHARED ? (',' + task.assignedCreeps.length + "/" + task.maxAssignees) : ''})`,
            },
          });
        }
        this.buffer.push({
          type: 'text',
          data: {
            text: `  ...以及其他${tasksOfType.length - 5}个[${taskTypeShort}]任务`,
          },
        });
      } else {
        for (const task of tasksOfType) {
          this.buffer.push({
            type: 'text',
            data: {
              text: `[${taskTypeShort}]${task.id.split('_')[2].substring(0, 4)}(BP:${task.basePriority},EP:${PriorityCalculator.calculate(task, Game.time).toFixed(2)}): ${task.status}(${task.assignmentType}${task.assignmentType === TaskAssignmentType.SHARED ? (',' + task.assignedCreeps.length + "/" + task.maxAssignees) : ''})`,
            },
          });
        }
      }
    }
  }
}
