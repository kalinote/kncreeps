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

  public preRender(room: Room): void {
    // 获取房间信息
    const rcl = room.controller ? room.controller.level : 'N/A';
    const energy = `${room.energyAvailable} / ${room.energyCapacityAvailable}`;
    const myCreeps = this.roomService.getCreepsInRoom(room.name).length;

    // 使用RoomVisual进行绘制
    this.clearBuffer();
    this.buffer += `房间: ${room.name}\n`;
    this.buffer += `RCL: ${rcl}\n`;
    this.buffer += `能量: ${energy}\n`;
    this.buffer += `Creeps: ${myCreeps}`;
  }

  /**
   * 渲染房间信息
   */
  public render(room: Room, offset?: { x: number; y: number }): void {
    console.log(`[RoomInfoLayer] render room: ${room.name} offset: x:${offset!.x} y:${offset!.y}`);
    if (!offset) return;

    const { x, y } = offset;

    const visual = new RoomVisual(room.name);
    this.drawTextLine(visual, this.buffer, x, y, VisualConfig.STYLES.ROOM_INFO_STYLE);
  }
}
