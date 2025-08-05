import { BaseService } from "../BaseService";
import { EventBus } from "../../core/EventBus";
import { GameConfig } from "../../config/GameConfig";
import { Safe } from "../../utils/Decorators";
import { RoomAnalysisMemory, RoomAreasMemory, RoomManagerMemory } from "../../types";
import { RoomManager } from "../../managers/RoomManager";
import { MapSpatialAnalyzer } from "../../utils/MapSpatialAnalyzer";

/**
 * 房间服务 - 提供房间状态分析、威胁检测和信息管理
 */
export class RoomService extends BaseService<{ [roomName: string]: RoomAnalysisMemory }, RoomManager> {
  protected onCleanup(): void {}
  protected onReset(): void {}

  constructor(eventBus: EventBus, manager: RoomManager, memory: RoomManagerMemory) {
    super(eventBus, manager, memory, 'analysis');
  }

  /**
   * 初始化所有房间内存
   */
  protected onInitialize(): void {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        this.initializeRoom(roomName);
      }
    }
  }

  /**
   * 初始化指定房间的内存
   */
  private initializeRoom(roomName: string): void {
    if (!this.memory[roomName] || !this.memory[roomName].initAt) {
      const room = Game.rooms[roomName];
      this.memory[roomName] = {} as RoomAnalysisMemory;
      this.memory[roomName].initAt = Game.time;
      this.memory[roomName].lastUpdate = Game.time;
      this.memory[roomName].lastCleanup = Game.time;
      this.memory[roomName].errorCount = 0;
      this.memory[roomName].energyAvailable = room?.energyAvailable || 0;
      this.memory[roomName].energyCapacity = room?.energyCapacityAvailable || 0;
      this.memory[roomName].controllerLevel = room?.controller?.level || 0;
      this.memory[roomName].creepCounts = {};
      this.memory[roomName].areas = [];

      this.initializeRoomLogistics(room);
      this.analyzeRoomMapSpatial(room);

      this.emit(GameConfig.EVENTS.ROOM_INITIALIZED, { roomName });
    }
  }

  /**
   * 执行所有房间分析任务
   */
  @Safe()
  protected onUpdate(): void {
    this.scanRooms();
    this.updateRoomStates();
  }

  @Safe()
  private initializeRoomLogistics(room: Room): void {
    if (!room.controller?.my) {
      return;
    }

    console.log(`[RoomService] 为房间 ${room.name} 分析基础物流网络...`);

    let registeredCount = 0;
    const structures = room.find(FIND_MY_STRUCTURES);

    for (const s of structures) {
      switch (s.structureType) {
        case STRUCTURE_SPAWN:
        case STRUCTURE_EXTENSION:
        case STRUCTURE_TOWER:
          this.manager.logisticsManager.transportService.setConsumer(s, room.name, RESOURCE_ENERGY);
          registeredCount++;
          break;

        case STRUCTURE_STORAGE:
        case STRUCTURE_TERMINAL:
          this.manager.logisticsManager.transportService.setConsumer(s, room.name, RESOURCE_ENERGY);
          this.manager.logisticsManager.transportService.setProvider(s, room.name, RESOURCE_ENERGY, 'ready');
          registeredCount += 2;
          break;
      }
    }

    console.log(`[RoomService] 房间 ${room.name} 物流网络初始化完成，注册了 ${registeredCount} 个物流角色。`);
  }

  private analyzeRoomMapSpatial(room: Room): void {
    if (!room.controller?.my) {
      return;
    }

    const { candidates } = MapSpatialAnalyzer.analyze(room.name);
    // console.log(`[RoomService] 房间 ${room.name} 空间分析完成: ${JSON.stringify(candidates)}`);
    for (const candidate of candidates) {
      this.memory[room.name].areas.push({
        coord: candidate.coord,
        openness: candidate.openness,
        area: candidate.area,
        centrality: candidate.centrality,
        score: candidate.score
      } as RoomAreasMemory);
    }
  }

  /**
   * 扫描并缓存所有己方房间
   */
  private scanRooms(): void {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my && !this.memory[roomName]) {
        console.log(`[RoomService] 发现新房间 ${roomName}`);
        this.initializeRoom(roomName);
      }
    }
  }

  /**
   * 更新所有受管理房间的状态
   */
  private updateRoomStates(): void {
    for (const roomName in this.memory) {
      this.updateRoomState(roomName);
    }
  }

  /**
   * 更新单个房间的状态，并在必要时发出事件
   */
  private updateRoomState(roomName: string): void {
    const room = Game.rooms[roomName];

    const previousEnergy = this.memory[roomName].energyAvailable || 0;
    const currentEnergy = room.energyAvailable;

    if (previousEnergy !== currentEnergy) {
      this.emit(GameConfig.EVENTS.ROOM_ENERGY_CHANGED, {
        roomName,
        previousEnergy,
        currentEnergy,
        energyCapacity: room.energyCapacityAvailable
      });
    }

    const previousLevel = this.memory[roomName].controllerLevel || 0;
    const currentLevel = room.controller?.level || 0;
    if (previousLevel !== currentLevel) {
      this.emit(GameConfig.EVENTS.ROOM_CONTROLLER_LEVEL_CHANGED, {
        roomName,
        previousLevel,
        currentLevel
      });
    }

    this.memory[roomName].energyAvailable = room.energyAvailable;
    this.memory[roomName].energyCapacity = room.energyCapacityAvailable;
    this.memory[roomName].creepCounts = this.getCreepCounts(roomName);
    this.memory[roomName].lastUpdate = Game.time;
  }

  /**
   * 获取房间内各类角色的Creep数量
   */
  private getCreepCounts(roomName: string): { [role: string]: number } {
    const counts: { [role: string]: number } = {};
    for (const creep of Object.values(Game.creeps)) {
      if (creep.memory.room === roomName && creep.memory.role) {
        counts[creep.memory.role] = (counts[creep.memory.role] || 0) + 1;
      }
    }
    return counts;
  }

  public getCreepsInRoom(roomName: string): Creep[] {
    return _.filter(Game.creeps, c => c.pos.roomName === roomName);
  }
}
