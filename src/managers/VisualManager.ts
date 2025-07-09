import { EventBus } from "../core/EventBus";
import { BaseManager } from "./BaseManager";

/**
 * TODO 可视化内容管理器
 */
export class VisualManager extends BaseManager {
  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  public update(): void {
    throw new Error("Method not implemented.");
  }
}
