import { LayerType } from "../../types";
import { BaseLayer } from "./BaseLayer";
import { EventBus } from "../../core/EventBus";
import { ServiceContainer } from "../../core/ServiceContainer";
import { VisualConfig } from "../../config/VisualConfig";

export class TaskAssignmentLayer extends BaseLayer {
  protected name: string = "TaskAssignmentLayer";
  public layerType: LayerType = LayerType.DATA;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.textStyle = VisualConfig.STYLES.TASK_ASSIGNMENT_STYLE;
  }

  public preRender(room: Room): void {
    // 使用RoomVisual进行绘制
    this.clearBuffer();
    this.buffer.push({
      type: 'text',
      data: {
        text: "任务分配展示预留位置",
      },
    });
    this.buffer.push({
      type: 'progressBar',
      data: {
        width: 5,
        progress: Game.time % 10,
        total: 10,
        label: "进度条测试",
      },
    });
    for (let i = 0; i < Game.time % 9; i++) {
      this.buffer.push({
        type: 'text',
        data: {
          text: "目前暂时用作测试...",
        },
      });
    }
  }
}
