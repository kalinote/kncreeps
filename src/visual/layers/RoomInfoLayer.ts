import { LayerType } from '../../types';
import { RoomService } from '../../services/RoomService';
import { BaseLayer } from './BaseLayer';
import { VisualConfig } from '../../config/VisualConfig';

/**
 * 房间信息图层
 * 在左上角显示当前房间的核心信息。
 */
export class RoomInfoLayer extends BaseLayer {
  protected name = 'RoomInfoLayer';
  public layerType: LayerType = LayerType.DATA;
  private roomService: RoomService;

  constructor(eventBus: any, serviceContainer: any) {
    super(eventBus, serviceContainer);
    this.roomService = serviceContainer.get('roomService');
  }

  /**
   * 根据要显示的内容，计算此图层需要的高度
   */
  public calculateDimensions(visual: RoomVisual): { width: number; height: number } {
    // 假设每行文本高度为1，可以根据字体大小调整
    const lineHeight = 1;
    const lineCount = 4; // 我们将显示4行信息
    return { width: 10, height: lineCount * lineHeight }; // 宽度可以给一个大概值
  }

  /**
   * 渲染房间信息
   */
  public render(room: Room, offset?: { x: number; y: number }): void {
    if (!offset) return;

    const { x, y } = offset;
    let line = 0;

    // 获取房间信息
    const rcl = room.controller ? room.controller.level : 'N/A';
    const energy = `${room.energyAvailable} / ${room.energyCapacityAvailable}`;
    const myCreeps = this.roomService.getCreepsInRoom(room.name).length;

    // 使用RoomVisual进行绘制
    const visual = new RoomVisual(room.name);
    visual.text(`房间: ${room.name}`, x, y + (line++ * 1.2), VisualConfig.STYLES.ROOM_INFO_STYLE);
    visual.text(`RCL: ${rcl}`, x, y + (line++ * 1.2), VisualConfig.STYLES.ROOM_INFO_STYLE);
    visual.text(`能量: ${energy}`, x, y + (line++ * 1.2), VisualConfig.STYLES.ROOM_INFO_STYLE);
    visual.text(`Creeps: ${myCreeps}`, x, y + (line++ * 1.2), VisualConfig.STYLES.ROOM_INFO_STYLE);
  }
}
