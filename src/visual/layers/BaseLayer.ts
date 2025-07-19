import { EventBus } from '../../core/EventBus';
import { ServiceContainer } from '../../core/ServiceContainer';
import { ChartBuffer, LayerType } from '../../types'; // 从全局类型文件导入

/**
 * 可视化层抽象基类
 */
export abstract class BaseLayer {
  protected abstract name: string;
  public abstract layerType: LayerType;
  public priority: number = 99;
  protected eventBus: EventBus;
  protected serviceContainer: ServiceContainer;
  protected buffer: ChartBuffer = [];
  protected textStyle: TextStyle = {};

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    this.eventBus = eventBus;
    this.serviceContainer = serviceContainer;
  }

  /**
   * 渲染方法，数据图层渲染方案，图形类图层渲染方案由子类继承实现
   */
  public render(room: Room, offset?: { x: number; y: number }): void {
    if (!offset) return;

    const { x, y } = offset;

    const visual = new RoomVisual(room.name);
    // TODO 这里是测试暂时使用，后续可以换成访问者模式
    for (const item of this.buffer) {
      switch (item.type) {
        case 'text':
          this.drawTextLine(visual, item.data.text, x + item.offset!.x, y + item.offset!.y, this.textStyle);
          break;
        case 'progressBar':
          this.drawProgressBar(visual, item.data.progress, item.data.total, item.data.label, item.data.width!, x + item.offset!.x, y + item.offset!.y, this.textStyle);
          break;
      }
    }
  }

  /**
   * 对于数据类图层，计算并返回其所需的显示尺寸
   * @param visual RoomVisual 对象，用于辅助计算
   * @returns 返回包含宽度和高度的对象
   */
  public calculateDimensions(): { width: number; height: number } {
    // 计算每一行的宽度，英文和常见符号按0.4宽度，其他字符按0.8宽度（暂时这么算，实际上不同字符宽度不一样）
    function getLineWidth(line: string): number {
      let width = 0;
      for (const char of line) {
        // 英文、数字、常见符号
        if (/^[a-zA-Z0-9\s.,:;'"!?()\[\]{}<>@#%^&*_\-+=/\\|~`]$/.test(char)) {
          width += 0.4;
        } else {
          // 其他字符（如中文等）
          width += 0.8;
        }
      }
      return width;
    }

    let width = 0;
    let height = 0;

    // console.log(`[BaseLayer] bufferLength: ${this.buffer.length}`);

    for (const item of this.buffer) {
      item.offset = { x: 0, y: height };
      // console.log(`[BaseLayer] item: ${item.type} offset: ${item.offset?.x}, ${item.offset?.y}`);
      switch (item.type) {
        case 'text':
          // 通过行数计算高度，以及最长的一行来计算长度（实际上这样算可能不太准确，字数最多的不一定是占用最宽的）
          const lineHeight = 1;
          const lineCount = item.data.text.split('\n').length;
          const maxLineWidth = Math.max(...item.data.text.split('\n').map(getLineWidth));
          width = maxLineWidth > width ? maxLineWidth : width; // 增加1的左右边距
          // console.log(`[BaseLayer] lineCount: ${lineCount}, lineHeight: ${lineHeight}`);
          height += lineCount * lineHeight;
          break;
        case 'progressBar':
          item.data.width = item.data.width ?? 10;
          const lineWidth = item.data.width + getLineWidth(`${item.data.label}(${item.data.progress}/${item.data.total})`) + 0.5; // 进度条默认宽度为10，暂时写死，label和进度条之间需要有0.5间隔
          width = width > lineWidth ? width : lineWidth;
          height += 1;
          break;
      }
    }

    width += 1; // 增加1的左右边距
    // console.log(`[BaseLayer] name: ${this.name}, 计算宽度: ${width}, 高度: ${height}`);
    return { width, height };
  }

  /**
   * 缓冲区相关方法
   * 地图类图层暂时不需要缓冲区，数据类图层需要缓冲区
   */
  public clearBuffer(): void {
    this.buffer = [];
  }

  public getBuffer(): ChartBuffer {
    return this.buffer;
  }

  public setBuffer(buffer: ChartBuffer): void {
    // FIXME 这个接口可能不太实用，后续考虑更换实现方式
    this.buffer = buffer;
  }

  /**
   * 预渲染方法，由子类实现，先生成需要渲染的内容，以进行高度和宽度计算
   * 只有数据类的图层需要预渲染，地图类的图层不需要预渲染，地图类的preRender方法不会被执行
   */
  public abstract preRender(room: Room): void;

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

  protected drawProgressBar(visual: RoomVisual, progress: number, total: number, label: string, width: number, x: number, y: number, style: TextStyle): void {
    visual.rect(x, y - 0.675 /* 矩形的坐标点是顶部，所以需要减去高度，这里的高度是试出来的，后续可能需要严格计算 */, width, 0.8);
    visual.rect(x, y - 0.675, width * (progress / total), 0.8);
    visual.text(`${label}(${progress}/${total})`, x + width + 0.5 /* 进度条和lebel之间的间隔 */, y, style);
  }
}
