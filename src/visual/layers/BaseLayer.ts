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
    // 通过this.buffer的行数计算高度，以及最长的一行来计算长度（实际上这样算可能不太准确，字数最多的不一定是占用最宽的）
    const lineHeight = 1;
    const lineCount = this.buffer.split('\n').length;

    // 计算每一行的宽度，英文和常见符号按0.5宽度，其他字符按0.8宽度（暂时这么算，实际上不同字符宽度不一样）
    function getLineWidth(line: string): number {
      let width = 0;
      for (const char of line) {
        // 英文、数字、常见符号
        if (/^[a-zA-Z0-9\s.,:;'"!?()\[\]{}<>@#%^&*_\-+=/\\|~`]$/.test(char)) {
          width += 0.5;
        } else {
          // 其他字符（如中文等）
          width += 0.8;
        }
      }
      return width;
    }

    const maxLineWidth = Math.max(...this.buffer.split('\n').map(getLineWidth));
    const width = maxLineWidth + 1; // 增加1的左右边距
    const height = lineCount * lineHeight;
    return { width, height };
  }

  /**
   * 缓冲区相关方法
   * 地图类图层暂时不需要缓冲区，数据类图层需要缓冲区
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
   * 只有数据类的图层需要预渲染，地图类的图层不需要预渲染，地图类的preRender方法不会被执行
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
      visual.text(line, x, y + i * 1, style);
    }
  }
}
