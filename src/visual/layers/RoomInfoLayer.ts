import { RoomManager } from './../../managers/RoomManager';
import { VisualLayer } from '../VisualLayer';
import { VisualConfig } from '../../config/VisualConfig';
import { ServiceContainer } from '../../core/ServiceContainer';
import { EventBus } from '../../core/EventBus';

/**
 * 房间信息图层
 */
export class RoomInfoLayer extends VisualLayer {
  private roomManager: RoomManager;

  constructor(eventBus: EventBus) {
    const serviceContainer = (global as any).serviceContainer as ServiceContainer;
    super(VisualConfig.LAYERS.ROOM_INFO, eventBus);
    this.roomManager = serviceContainer.get<RoomManager>('roomManager');
    this.priority = VisualConfig.LAYER_DEFAULTS.RoomInfoLayer.priority;
  }

  /**
   * 渲染房间信息
   */
  public render(): void {
    if (!this.roomManager) {
      console.log('RoomInfoLayer: RoomManager not found');
      return;
    }

    const ownedRooms = this.roomManager.getRoomNames();
    ownedRooms.forEach((roomName, index) => {
      const room = this.roomManager.getRoom(roomName);
      if (room && room.controller) {
        const text = `[${roomName}] RCL: ${room.controller.level} | Energy: ${room.energyAvailable}/${room.energyCapacityAvailable}`;
        // 使用MapVisual进行绘制
        Game.map.visual.text(text, new RoomPosition(2, 2 + index * 1.2, roomName), {
          ...VisualConfig.STYLES.ROOM_INFO_STYLE,
          align: 'left'
        });
      }
    });
  }
}
