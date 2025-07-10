import { RoomManager } from '../../managers/RoomManager';
import { VisualLayer } from '../VisualLayer';
import { VisualConfig } from '../../config/VisualConfig';
import { ServiceContainer } from '../../core/ServiceContainer';
import { EventBus } from '../../core/EventBus';
import { VisualManager } from '../../managers/VisualManager';

/**
 * 房间信息图层
 */
export class RoomInfoLayer extends VisualLayer {
  protected name: string = VisualConfig.LAYERS.ROOM_INFO;
  private roomManager: RoomManager;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.roomManager = this.serviceContainer.get<RoomManager>('roomManager');
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
    const visualManager = this.serviceContainer.get<VisualManager>('visualManager');

    const ownedRooms = this.roomManager.getMyRoomNames();
    if (ownedRooms.length === 0) {
      return;
    }

    // 在顶部显示RoomManager的更新周期
    const { nextUpdateIn, updateInterval } = this.roomManager.getUpdateCycleInfo();
    const updateText = `RM Scan: ${nextUpdateIn}/${updateInterval}`;
    Game.map.visual.text(updateText, new RoomPosition(2, 1, ownedRooms[0]), {
      color: VisualConfig.STYLES.ROOM_INFO_STYLE.color,
      fontSize: 0.7
    });

    // 渲染每个房间的信息
    ownedRooms.forEach((roomName: string, index: number) => {
      const room = this.roomManager.getRoom(roomName);
      if (room && room.controller) {
        const text = `[${roomName}] RCL: ${room.controller.level} | Energy: ${room.energyAvailable}/${room.energyCapacityAvailable}`;
        // 使用MapVisual进行绘制，y坐标下移以避免与周期显示重叠
        Game.map.visual.text(text, new RoomPosition(2, 2.2 + index * 1.2, roomName), {
          ...VisualConfig.STYLES.ROOM_INFO_STYLE,
          align: 'left'
        });
      }
    });
  }
}
