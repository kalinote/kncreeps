import { LayerType } from '../../types';
import { BaseLayer } from './BaseLayer';
import { VisualConfig } from '../../config/VisualConfig';

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

  public preRender(room: Room): void {
    const tick = `Tick: ${Game.time}`;
    const cpu = `CPU: ${Game.cpu.getUsed().toFixed(2)} / ${Game.cpu.limit}`;
    const bucket = `Bucket: ${Game.cpu.bucket}`;
    const gcl = `GCL: ${Game.gcl.level} (${((Game.gcl.progress / Game.gcl.progressTotal) * 100).toFixed(2)}%)`;

    this.clearBuffer();
    this.buffer += `${tick}\n`;
    this.buffer += `${cpu}\n`;
    this.buffer += `${bucket}\n`;
    this.buffer += `${gcl}`;
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

    const visual = new RoomVisual(room.name);
    this.drawTextLine(visual, this.buffer, x, y, VisualConfig.STYLES.GLOBAL_INFO_STYLE);
  }
}
