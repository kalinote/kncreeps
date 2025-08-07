import { RoomService } from 'services/room/RoomService';
import { ConstructPlannerLayoutService } from 'services/construction/ConstructPlannerLayoutService';
import { VisualLayoutService } from '../../services/visual/VisualLayoutService';
import { ChartBuffer, LayerType } from '../../types'; // 从全局类型文件导入

/**
 * 可视化层抽象基类
 */
export abstract class BaseLayer {
  protected abstract name: string;
  protected abstract title: string;
  public abstract layerType: LayerType;
  public priority: number = 99;
  protected service: VisualLayoutService;
  protected buffer: ChartBuffer = [];
  protected textStyle: TextStyle = {};        // TODO 需要优化，默认样式需要根据图层类型进行设置

  constructor(service: VisualLayoutService) {
    this.service = service;
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
        case 'lineChart':
          this.drawLineChart(visual, item.data.xAxis, item.data.datas, item.data.title, item.data.height!, item.data.width!, x + item.offset!.x, y + item.offset!.y, this.textStyle);
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
          let lineWidth = item.data.width + getLineWidth(`${item.data.label}(${item.data.progress}/${item.data.total})`) + 0.5; // 进度条默认宽度为10，暂时写死，label和进度条之间需要有0.5间隔
          width = width > lineWidth ? width : lineWidth;
          height += 1;
          break;
        case 'lineChart':
          item.data.height = item.data.height ?? 5;
          item.data.width = item.data.width ?? 10;
          width = item.data.width > width ? item.data.width : width;
          height += item.data.height + 1;   // 上下间距
          // TODO 计算横轴label、图例、标题的高度
          const fontSize = (item.data.width / item.data.xAxis.length) * 0.6;
          height += fontSize;     // 横轴label高度
          height += 0.8;          // 标题高度
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
  public preRender(room: Room): void {
    // 默认实现，子类可以重写
  }

  /**
   * 获取此图层的名称
   */
  public getName(): string {
    return this.name;
  }

  /**
   * 获取此图层的标题
   */
  public getTitle(): string {
    return this.title;
  }

  /**
   * 获取此图层的渲染优先级
   */
  public getPriority(): number {
    return this.priority;
  }

  /**
   * 绘制文本行，用于数据类图层
   */
  protected drawTextLine(visual: RoomVisual, text: string, x: number, y: number, style: TextStyle): void {
    // 因为screeps的visual.text接口没办法处理\n换行和\t制表符，所以需要自己处理
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      visual.text(line, x, y + i * 1, style);
    }
  }

  /**
   * 绘制进度条，用于数据类图层
   */
  protected drawProgressBar(visual: RoomVisual, progress: number, total: number, label: string, width: number, x: number, y: number, style: TextStyle): void {
    y -= 0.675; // 矩形的坐标点是顶部，所以需要减去高度，这里的高度是试出来的，后续可能需要严格计算
    visual.rect(x, y, width, 0.8);
    visual.rect(x, y, width * (progress / total), 0.8);
    visual.text(`${label}(${progress}/${total})`, x + width + 0.5 /* 进度条和lebel之间的间隔 */, y, style);
  }

  /**
   * 绘制折线图，用于数据类图层
   */
  protected drawLineChart(visual: RoomVisual, xAxis: string[], datas: number[], label: string, height: number, width: number, x: number, y: number, style: TextStyle): void {
    const offsetY = y + 0.8;          // 预留标题

    // 标题
    visual.text(label, x + (width / 2), y + 0.3, {
      color: 'white',
      align: 'center',
      font: 0.6,
      opacity: 0.8
    });

    // 边框
    const fontSize = (width / xAxis.length) * 0.6;
    const baseX = x + fontSize;
    visual.line(baseX, offsetY, baseX, offsetY + height);
    visual.line(baseX, offsetY + height, baseX + width, offsetY + height);

    // 绘制横轴
    for (let i = 0; i < xAxis.length; i++) {
      visual.text(xAxis[i], baseX + (i + 0.5) * width / xAxis.length, offsetY + height + fontSize, {
        // TODO 优化label的样式
        color: 'white',
        align: 'center',
        font: fontSize,
        opacity: 0.4
      });
    }

    // 绘制纵轴
    const maxValue = Math.max(...datas);
    const vFontSize = 0.6;
    for (let i = 0; i < height + 1; i++) {
      visual.text(((maxValue / height) * i).toFixed(1), x, offsetY + height - i + vFontSize / 2, {
        color: 'white',
        align: 'center',
        font: vFontSize,
        opacity: 0.4
      });
    }

    // 绘制折线
    let points: [number, number][] = [];
    const numberHeight = height / Math.max(...datas);
    for (let i = 0; i < xAxis.length; i++) {
      points.push([baseX + (i + 0.5) * width / xAxis.length, offsetY + height - datas[i] * numberHeight]);
    }
    visual.poly(points, {
      fill: 'transparent',
      stroke: 'white',
      strokeWidth: 0.1
    });
  }

  /**
   * 绘制指示器，用于地图类图层
   * // TODO 需要进一步优化视觉效果
   */
  protected drawIndicator(visual: RoomVisual, x: number, y: number, color: string, radius: number): void {
    // 定义不同形态的数组，包含旋转角度（弧度）和缩放比例
    const sharps = [
      { rotation: 0, scale: 1.0 },
      { rotation: Math.PI / 8, scale: 1.1 },
      { rotation: Math.PI / 4, scale: 1.2 },
      { rotation: 3 * Math.PI / 8, scale: 1.1 },
      { rotation: Math.PI / 2, scale: 1.0 },
      { rotation: 5 * Math.PI / 8, scale: 0.9 },
      { rotation: 3 * Math.PI / 4, scale: 0.8 },
      { rotation: 7 * Math.PI / 8, scale: 0.9 },
      { rotation: Math.PI, scale: 1.0 },
      { rotation: 9 * Math.PI / 8, scale: 1.1 },
      { rotation: 5 * Math.PI / 4, scale: 1.2 },
      { rotation: 11 * Math.PI / 8, scale: 1.1 },
      { rotation: 3 * Math.PI / 2, scale: 1.0 },
      { rotation: 13 * Math.PI / 8, scale: 0.9 },
      { rotation: 7 * Math.PI / 4, scale: 0.8 },
      { rotation: 15 * Math.PI / 8, scale: 0.9 }
    ];

    // 使用Game.time控制动画，每4个tick切换一次形态
    const currentSharpIndex = Game.time % sharps.length;
    const currentSharp = sharps[currentSharpIndex];

    // 应用缩放
    const scaledRadius = radius * currentSharp.scale;

    // 定义菱形的四个顶点（相对于中心点）
    const basePoints = [
      { x: 0, y: -scaledRadius },      // 上顶点
      { x: scaledRadius, y: 0 },       // 右顶点
      { x: 0, y: scaledRadius },       // 下顶点
      { x: -scaledRadius, y: 0 },       // 左顶点
      { x: 0, y: -scaledRadius },      // 闭合
    ];

    // 应用旋转变换并转换为绝对坐标
    const rotatedPoints = basePoints.map(point => {
      const cos = Math.cos(currentSharp.rotation);
      const sin = Math.sin(currentSharp.rotation);

      return [
        x + (point.x * cos - point.y * sin),
        y + (point.x * sin + point.y * cos)
      ] as [number, number];
    });

    // 绘制菱形
    visual.poly(rotatedPoints, {
      fill: color,
      opacity: 0.6,
      stroke: color,
      strokeWidth: 0.1
    });

    // 可选：绘制内部小菱形增加水晶效果
    const innerRadius = scaledRadius * 0.4;
    const innerPoints = [
      { x: 0, y: -innerRadius },
      { x: innerRadius, y: 0 },
      { x: 0, y: innerRadius },
      { x: -innerRadius, y: 0 },
      { x: 0, y: -innerRadius }
    ];

    const rotatedInnerPoints = innerPoints.map(point => {
      const cos = Math.cos(currentSharp.rotation + Math.PI / 4); // 内部菱形旋转45度
      const sin = Math.sin(currentSharp.rotation + Math.PI / 4);

      return [
        x + (point.x * cos - point.y * sin),
        y + (point.x * sin + point.y * cos)
      ] as [number, number];
    });

    visual.poly(rotatedInnerPoints, {
      fill: 'transparent',
      stroke: color,
      strokeWidth: 0.05,
      opacity: 0.8
    });
  }
}
