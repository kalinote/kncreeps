import { LayerType } from '../../types';
import { BaseLayer } from './BaseLayer';
import { VisualConfig } from '../../config/VisualConfig';
import { VisualLayoutService } from 'services/visual/VisualLayoutService';

/**
 * 全局信息图层
 * 显示游戏Tick、CPU、Bucket和GCL等全局信息。
 */
export class GlobalInfoLayer extends BaseLayer {
  protected name = 'GlobalInfoLayer';
  protected title: string = "全局信息";
  public layerType: LayerType = LayerType.DATA;

  constructor(service: VisualLayoutService) {
    super(service);
    this.textStyle = VisualConfig.STYLES.GLOBAL_INFO_STYLE;
  }

  public preRender(room: Room): void {
    const tick = `Tick: ${Game.time}`;
    const cpu = `CPU: ${Game.cpu.getUsed().toFixed(2)} / ${Game.cpu.limit}`;
    const bucket = `Bucket: ${Game.cpu.bucket}`;
    const gcl = `GCL: ${Game.gcl.level} (${((Game.gcl.progress / Game.gcl.progressTotal) * 100).toFixed(2)}%)`;

    this.clearBuffer();
    this.buffer.push({
      type: 'text',
      data: {
        text: `${tick}\n${cpu}\n${bucket}\n${gcl}`,
      },
    });
  }
}
