import { VisualLayer } from "../VisualLayer";
import { EventBus } from "../../core/EventBus";
import { GameConfig } from "../../config/GameConfig";

/**
 * 房间信息可视化层
 */
export class RoomInfoLayer extends VisualLayer {
  constructor(eventBus: EventBus) {
    super(eventBus, {
      enabled: true,
      updateFrequency: 5,
      priority: 1,
      style: { color: '#ffffff', fontSize: 12 }
    });
  }

  public getName(): string {
    return 'RoomInfoLayer';
  }

  public render(): void {
    if (!this.shouldUpdate()) {
      return;
    }

    // 为每个己方房间显示基本信息
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        this.renderRoomInfo(room);
      }
    }

    this.updateCompleted();
  }

  private renderRoomInfo(room: Room): void {
    const visual = Game.map.visual;
    const roomName = room.name;

    // 显示房间名称
    visual.text(roomName, new RoomPosition(25, 25, roomName), {
      color: this.style.color,
      fontSize: this.style.fontSize
    });

    // 显示能量信息
    const energyText = `E: ${room.energyAvailable}/${room.energyCapacityAvailable}`;
    visual.text(energyText, new RoomPosition(25, 35, roomName), {
      color: '#ffff00',
      fontSize: 10
    });

    // 显示RCL等级
    const rclText = `RCL: ${room.controller?.level || 0}`;
    visual.text(rclText, new RoomPosition(25, 45, roomName), {
      color: '#00ffff',
      fontSize: 10
    });
  }
}
