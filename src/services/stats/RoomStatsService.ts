import { BaseService } from "../BaseService";
import { RoomStatsServiceMemory } from "../../types";
import { StatsManager } from "../../managers/StatsManager";
import { EventBus } from "../../core/EventBus";

export class RoomStatsService extends BaseService<{ [roomName: string]: RoomStatsServiceMemory }> {
  protected onCleanup(): void {}
  protected onReset(): void {}
  constructor(eventBus: EventBus, manager: StatsManager, memory: any) {
    super(eventBus, manager, memory, 'roomStats');
  }

  protected onInitialize(): void {
    for (const roomName in Game.rooms) {
      if (Game.rooms[roomName].controller?.my && !this.memory[roomName]?.initAt) {
        this.initializeRoom(roomName);
      }
    }
  }

  private initializeRoom(roomName: string): void {
    this.memory[roomName] = {} as RoomStatsServiceMemory;
    this.memory[roomName].initAt = Game.time;
    this.memory[roomName].lastCleanup = Game.time;
    this.memory[roomName].errorCount = 0;
    this.memory[roomName].lastUpdate = Game.time;
    this.memory[roomName].roomName = roomName;
    this.memory[roomName].energyAvailable = 0;
    this.memory[roomName].energyCapacity = 0;
    this.memory[roomName].creepCount = 0;
    this.memory[roomName].constructionSites = 0;
    this.memory[roomName].controllerLevel = 0;
  }

  protected onUpdate(): void {
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
