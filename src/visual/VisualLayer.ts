import { EventBus } from "../core/EventBus";

/**
 * 可视化层抽象基类
 */
export abstract class VisualLayer {
  protected eventBus: EventBus;
  protected enabled: boolean = true;
  protected lastUpdate: number = 0;
  protected updateFrequency: number = 5;
  protected priority: number = 1;
  protected style: any = {};

  constructor(eventBus: EventBus, config: any) {
    this.eventBus = eventBus;
    this.enabled = config.enabled || true;
    this.updateFrequency = config.updateFrequency || 5;
    this.priority = config.priority || 1;
    this.style = config.style || {};
  }

  /**
   * 检查是否应该更新
   */
  protected shouldUpdate(): boolean {
    return this.enabled && (Game.time - this.lastUpdate >= this.updateFrequency);
  }

  /**
   * 更新完成标记
   */
  protected updateCompleted(): void {
    this.lastUpdate = Game.time;
  }

  /**
   * 抽象方法 - 渲染逻辑
   */
  public abstract render(): void;

  /**
   * 启用层
   */
  public enable(): void {
    this.enabled = true;
  }

  /**
   * 禁用层
   */
  public disable(): void {
    this.enabled = false;
  }

  /**
   * 检查是否启用
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 获取优先级
   */
  public getPriority(): number {
    return this.priority;
  }

  /**
   * 获取层名称
   */
  public abstract getName(): string;
}
