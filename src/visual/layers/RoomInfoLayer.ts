import { LayerType } from '../../types';
import { RoomService } from '../../services/RoomService';
import { BaseLayer } from './BaseLayer';
import { VisualConfig } from '../../config/VisualConfig';
import { ServiceContainer } from '../../core/ServiceContainer';

/**
 * 房间信息图层
 * 在左上角显示当前房间的核心信息。
 */
export class RoomInfoLayer extends BaseLayer {
  protected name = 'RoomInfoLayer';
  public layerType: LayerType = LayerType.DATA;
  private roomService: RoomService;

  constructor(eventBus: any, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.roomService = serviceContainer.get('roomService');
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
