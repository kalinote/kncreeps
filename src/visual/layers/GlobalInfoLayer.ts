import { LayerType } from '../../types';
import { BaseLayer } from './BaseLayer';

/**
 * 全局信息图层
 * 显示游戏Tick、CPU、Bucket和GCL等全局信息。
 */
export class GlobalInfoLayer extends BaseLayer {
  protected name = 'GlobalInfoLayer';
  public layerType: LayerType = LayerType.DATA;

  constructor(eventBus: any, serviceContainer: any) {
    super(eventBus, serviceContainer);
  }

  /**
   * 计算此图层需要的高度
   */
  public calculateDimensions(visual: RoomVisual): { width: number; height: number } {
    const lineHeight = 1;
    const lineCount = 4; // Tick, CPU, Bucket, GCL
    return { width: 15, height: lineCount * lineHeight }; // 宽度给一个大概值
  }

  /**
   * 渲染全局信息
   */
  public render(room: Room, offset?: { x: number; y: number }): void {
    if (!offset) return;

    // 全局信息只绘制一次
    if (room.name !== Object.keys(Game.rooms)[0]) {
      return;
    }

    const { x, y } = offset;
    let line = 0;
    const textStyle: TextStyle = { align: 'left', color: '#FFFFFF', font: 0.8 };

    // 获取全局信息
    const tick = `Tick: ${Game.time}`;
    const cpu = `CPU: ${Game.cpu.getUsed().toFixed(2)} / ${Game.cpu.limit}`;
    const bucket = `Bucket: ${Game.cpu.bucket}`;
    const gcl = `GCL: ${Game.gcl.level} (${((Game.gcl.progress / Game.gcl.progressTotal) * 100).toFixed(2)}%)`;

    // 使用RoomVisual进行绘制
    const visual = new RoomVisual(room.name);
    visual.text(tick, x, y + (line++ * 1.2), textStyle);
    visual.text(cpu, x, y + (line++ * 1.2), textStyle);
    visual.text(bucket, x, y + (line++ * 1.2), textStyle);
    visual.text(gcl, x, y + (line++ * 1.2), textStyle);
  }
}
