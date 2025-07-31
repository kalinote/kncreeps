import { BaseService } from "../BaseService";
import { RoomStatsServiceMemory } from "../../types";


export class RoomStatsService extends BaseService<{ [roomName: string]: RoomStatsServiceMemory }> {
  protected readonly memoryKey: string = 'roomStats';
  public cleanup(): void {}

  public initialize(): void {
    for (const roomName in Game.rooms) {
      if (Game.rooms[roomName].controller?.my && !this.memory[roomName]?.initAt) {
        this.initializeRoom(roomName);
      }
    }
  }

  private initializeRoom(roomName: string): void {
    this.memory[roomName] = {
      initAt: Game.time,
      lastCleanup: Game.time,
      errorCount: 0,
      lastUpdate: Game.time,
      roomName: roomName,
      energyAvailable: 0,
      energyCapacity: 0,
      creepCount: 0,
      constructionSites: 0,
      controllerLevel: 0
    }
  }

  public update(): void {
    this.scanRooms();
    this.updataRoomsStats();
  }

  private scanRooms(): void {
    for (const roomName in Game.rooms) {
      if (Game.rooms[roomName].controller?.my) {
        if (!this.memory[roomName]) {
          console.log(`[RoomStatsService] 发现新房间 ${roomName}`);
          this.initializeRoom(roomName);
        }
      }
    }
  }

  private updataRoomsStats(): void {
    for (const roomName in Game.rooms) {
      if (Game.rooms[roomName].controller?.my) {
        this.updateRoomStats(roomName);
      }
    }
  }

  private updateRoomStats(roomName: string): void {
    const room = Game.rooms[roomName];
    if (!room) return;

    this.memory[roomName] = {
      ...this.memory[roomName],
      lastUpdate: Game.time,
      energyAvailable: room.energyAvailable,
      energyCapacity: room.energyCapacityAvailable,
      creepCount: room.find(FIND_MY_CREEPS).length,
      constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
      controllerLevel: room.controller?.level || 0
    }
  }
}
