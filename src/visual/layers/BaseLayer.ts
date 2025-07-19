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
  protected buffer: string = '';

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
  public calculateDimensions(): { width: number; height: number } {
    // 通过this.buffer的行数计算高度，以及长的一行来计算长度
    const lineHeight = 1;
    const lineCount = this.buffer.split('\n').length;
    // TODO 宽度圆角符号及中文字符取0.8，英文取0.5，这个需要优化
    const maxLineLength = Math.max(...this.buffer.split('\n').map(line => line.length));
    // console.log(`[BaseLayer] calculateDimensions: ${maxLineLength} ${lineCount} ${lineHeight}`);
    return { width: maxLineLength * 0.8, height: lineCount * lineHeight };
  }

  /**
   * 清空缓冲区
   */
  public clearBuffer(): void {
    this.buffer = '';
  }

  public getBuffer(): string {
    return this.buffer;
  }

  public setBuffer(buffer: string): void {
    this.buffer = buffer;
  }

  /**
   * 预渲染方法，由子类实现，先生成需要渲染的内容，以进行高度和宽度计算
   */
  public preRender(room: Room): void {}

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

  protected drawTextLine(visual: RoomVisual, text: string, x: number, y: number, style: TextStyle): void {
    // 因为screeps的visual.text接口没办法处理\n换行和\t制表符，所以需要自己处理
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      visual.text(line, x, y + i * 1.2, style);
    }
  }
}
