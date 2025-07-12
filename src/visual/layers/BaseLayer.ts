import { EventBus } from '../../core/EventBus';
import { ServiceContainer } from '../../core/ServiceContainer';
import { LayerType } from '../../types'; // 从全局类型文件导入

/**
 * 可视化层抽象基类
 */
export abstract class BaseLayer {
  protected abstract name: string;
  public abstract layerType: LayerType;
  public priority: number = 99;
  protected eventBus: EventBus;
  protected serviceContainer: ServiceContainer;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    this.eventBus = eventBus;
    this.serviceContainer = serviceContainer;
  }

  /**
   * 渲染方法，由子类实现
   * @param room 当前渲染的房间
   * @param offset 对于数据类图层，这是由布局服务计算出的渲染起始坐标
   */
  public abstract render(room: Room, offset?: { x: number; y: number }): void;

  /**
   * 对于数据类图层，计算并返回其所需的显示尺寸
   * @param visual RoomVisual 对象，用于辅助计算
   * @returns 返回包含宽度和高度的对象
   */
  public calculateDimensions(visual: RoomVisual): { width: number; height: number } {
    return { width: 0, height: 0 };
  }

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
