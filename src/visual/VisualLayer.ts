import { EventBus } from '../core/EventBus';
import { ServiceContainer } from '../core/ServiceContainer';

/**
 * 可视化层抽象基类
 */
export abstract class VisualLayer {
  protected abstract name: string;
  public priority: number = 99;
  protected eventBus: EventBus;
  protected serviceContainer: ServiceContainer;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    this.eventBus = eventBus;
    this.serviceContainer = serviceContainer;
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
