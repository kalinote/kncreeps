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
  }

  public preRender(room: Room): void {
    // 使用RoomVisual进行绘制
    this.clearBuffer();
    this.buffer += "任务分配展示预留位置\n";
    for (let i = 0; i < Game.time % 9; i++) {
      this.buffer += "目前暂时用作测试...\n";
    }
    this.buffer += "目前暂时用作测试...";
  }

  public render(room: Room, offset?: { x: number; y: number; }): void {
    if (!offset) return;

    const { x, y } = offset;

    const visual = new RoomVisual(room.name);
    this.drawTextLine(visual, this.buffer, x, y, VisualConfig.STYLES.TASK_ASSIGNMENT_STYLE);
  }
}
