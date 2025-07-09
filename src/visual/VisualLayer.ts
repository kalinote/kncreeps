import { EventBus } from '../core/EventBus';

/**
 * 可视化层抽象基类
 */
export abstract class VisualLayer {
  public name: string;
  public priority: number = 99;
  protected eventBus: EventBus;

  constructor(name: string, eventBus: EventBus) {
    this.name = name;
    this.eventBus = eventBus;
  }

  /**
   * 渲染方法，由子类实现
   */
  public abstract render(): void;

  /**
   * 获取此图层的名称
   */
  public getName(): string {
    return this.name;
  }

  /**
   * 获取此图层的渲染优先级
   */
  public getPriority(): number {
    return this.priority;
  }
}
