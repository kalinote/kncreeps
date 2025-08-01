import { LayerType } from '../../types';
import { BaseLayer } from './BaseLayer';
import { VisualConfig } from '../../config/VisualConfig';
import { VisualLayoutService } from '../../services/visual/VisualLayoutService';
import { RoomService } from 'services/room/RoomService';

/**
 * 房间信息图层
 * 在左上角显示当前房间的核心信息。
 */
export class RoomInfoLayer extends BaseLayer {
  protected name = 'RoomInfoLayer';
  protected title: string = "房间信息";
  public layerType: LayerType = LayerType.DATA;

  protected get roomService(): RoomService {
    return this.service.roomService;
  }

  constructor(service: VisualLayoutService) {
    super(service);
    this.textStyle = VisualConfig.STYLES.ROOM_INFO_STYLE;
  }

  public preRender(room: Room): void {
    // 获取房间信息
    const rcl = room.controller ? room.controller.level : 'N/A';
    const myCreeps = this.roomService.getCreepsInRoom(room.name).length;

    // 使用RoomVisual进行绘制
    this.clearBuffer();
    this.buffer.push({
      type: 'text',
      data: {
        text: `房间: ${room.name}`,
      },
    });
    this.buffer.push({
      type: 'text',
      data: {
        text: `RCL: ${rcl}`,
      },
    });
    this.buffer.push({
      type: 'progressBar',
      data: {
        width: 5,
        progress: room.energyAvailable,
        total: room.energyCapacityAvailable,
        label: `能量`,
      },
    });
    this.buffer.push({
      type: 'text',
      data: {
        text: `Creeps: ${myCreeps}`,
      },
    });
  }
}
