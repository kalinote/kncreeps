import { BaseService } from "./BaseService";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { ServiceContainer } from "../core/ServiceContainer";

/**
 * 房间服务 - 提供房间状态分析、威胁检测和信息管理
 */
export class RoomService extends BaseService {
  private rooms: Map<string, Room> = new Map();
  private lastRoomScan: number = 0;
  private threatStates: Map<string, { hasThreat: boolean; lastCheck: number; lastReport: number }> = new Map();

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.initializeRoomsMemory();
  }

  /**
   * 执行所有房间分析任务
   */
  public run(): void {
    this.safeExecute(() => {
      this.scanRooms();
      this.updateRoomStates();
      this.checkRoomThreats();
      this.checkRoomAlerts();
    }, "RoomService.run");
  }

  /**
   * 初始化所有房间内存
   */
  private initializeRoomsMemory(): void {
    if (!Memory.rooms) {
      Memory.rooms = {};
    }

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        this.initializeRoomMemory(roomName);
      }
    }
  }

  /**
   * 扫描并缓存所有己方房间
   */
  private scanRooms(): void {
    if (Game.time - this.lastRoomScan < GameConfig.UPDATE_FREQUENCIES.ROOM_ANALYSIS) {
      return;
    }

    this.rooms.clear();
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        this.rooms.set(roomName, room);
      }
    }
    this.lastRoomScan = Game.time;
  }

  /**
   * 更新所有受管理房间的状态
   */
  private updateRoomStates(): void {
    for (const room of this.rooms.values()) {
      this.updateRoomState(room);
    }
  }

  /**
   * 更新单个房间的状态，并在必要时发出事件
   */
  private updateRoomState(room: Room): void {
    const roomName = room.name;
    this.initializeRoomMemory(roomName);

    const memory = Memory.rooms[roomName];
    const previousEnergy = memory.energyAvailable || 0;
    const currentEnergy = room.energyAvailable;

    if (previousEnergy !== currentEnergy) {
      this.emit(GameConfig.EVENTS.ROOM_ENERGY_CHANGED, {
        roomName,
        previousEnergy,
        currentEnergy,
        energyCapacity: room.energyCapacityAvailable
      });
    }

    this.updateRoomMemory(roomName, room);
  }

  /**
   * 检查所有房间的威胁状态
   */
  private checkRoomThreats(): void {
    const threatCheckInterval = GameConfig.UPDATE_FREQUENCIES.THREAT_CHECK;
    for (const room of this.rooms.values()) {
      const threatState = this.threatStates.get(room.name) || { hasThreat: false, lastCheck: 0, lastReport: 0 };
      if (Game.time - threatState.lastCheck >= threatCheckInterval) {
        this.checkSingleRoomThreat(room, threatState);
        threatState.lastCheck = Game.time;
        this.threatStates.set(room.name, threatState);
      }
    }
  }

  /**
   * 检查单个房间的威胁
   */
  private checkSingleRoomThreat(
    room: Room,
    threatState: { hasThreat: boolean; lastCheck: number; lastReport: number }
  ): void {
    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    const hasThreat = hostileCreeps.length > 0;

    if (hasThreat !== threatState.hasThreat) {
      threatState.hasThreat = hasThreat;
      if (hasThreat) {
        this.handleThreatDetected(room, hostileCreeps);
      } else {
        this.handleThreatCleared(room.name);
      }
    } else if (hasThreat) {
      const reportInterval = GameConfig.TIMEOUTS.THREAT_PERSISTENT_REPORT;
      if (Game.time - threatState.lastReport >= reportInterval) {
        this.handleThreatPersistent(room, hostileCreeps);
        threatState.lastReport = Game.time;
      }
    }

    if (hasThreat) {
      room.memory.lastEnemyActivity = Game.time;
    }
  }

  /**
   * 检查所有房间的警报状态
   */
  private checkRoomAlerts(): void {
    const alertCheckInterval = GameConfig.UPDATE_FREQUENCIES.ROOM_ANALYSIS;
    if (Game.time % alertCheckInterval !== 0) return;

    for (const room of this.rooms.values()) {
      const alerts = this.analyzeRoomConditions(room);
      if (alerts.length > 0) {
        this.emit(GameConfig.EVENTS.ROOM_NEEDS_ATTENTION, {
          roomName: room.name,
          alerts,
          severity: this.calculateAlertSeverity(alerts)
        });
      }
    }
  }

  /**
   * 分析房间状况，返回警报列表
   */
  private analyzeRoomConditions(room: Room): string[] {
    const alerts: string[] = [];
    if (room.energyAvailable < GameConfig.THRESHOLDS.EMERGENCY_ENERGY_LEVEL) {
      alerts.push("能量紧急不足");
    }

    const damagedStructures = room.find(FIND_STRUCTURES, {
      filter: s => s.hits < s.hitsMax * GameConfig.THRESHOLDS.EMERGENCY_REPAIR_THRESHOLD
    });
    if (damagedStructures.length > 0) {
      alerts.push(`${damagedStructures.length} 个建筑严重受损`);
    }

    const creepCount = room.find(FIND_MY_CREEPS).length;
    if (creepCount === 0) {
      alerts.push("房间内无Creep");
    }

    return alerts;
  }

  /**
   * 计算警报严重性
   */
  private calculateAlertSeverity(alerts: string[]): "low" | "medium" | "high" | "critical" {
    if (alerts.includes("房间内无Creep") || alerts.some(a => a.includes("严重受损"))) {
      return "critical";
    }
    if (alerts.includes("能量紧急不足")) {
      return "high";
    }
    return "medium";
  }

  /**
   * 处理检测到威胁的逻辑
   */
  private handleThreatDetected(room: Room, hostileCreeps: Creep[]): void {
    const threatLevel = this.calculateThreatLevel(hostileCreeps);
    this.emit(GameConfig.EVENTS.ROOM_UNDER_ATTACK, {
      roomName: room.name,
      threatLevel,
      hostileIds: hostileCreeps.map(c => c.id)
    });
    room.memory.lastEnemyActivity = Game.time;
  }

  /**
   * 处理威胁解除的逻辑
   */
  private handleThreatCleared(roomName: string): void {
    this.emit(GameConfig.EVENTS.ROOM_THREAT_CLEARED, { roomName });
    const threatState = this.threatStates.get(roomName);
    if (threatState) {
      threatState.hasThreat = false;
    }
  }

  /**
   * 处理威胁持续存在的逻辑
   */
  private handleThreatPersistent(room: Room, hostileCreeps: Creep[]): void {
    this.emit(GameConfig.EVENTS.ROOM_THREAT_PERSISTS, {
      roomName: room.name,
      hostileIds: hostileCreeps.map(c => c.id)
    });
  }

  /**
   * 初始化指定房间的内存
   */
  private initializeRoomMemory(roomName: string): void {
    if (!Memory.rooms[roomName]) {
      const room = Game.rooms[roomName];
      Memory.rooms[roomName] = {
        energyAvailable: room?.energyAvailable || 0,
        energyCapacity: room?.energyCapacityAvailable || 0,
        needsAttention: false,
        creepCounts: {},
        threatLevel: "none",
        lastUpdated: Game.time
      };
    }
  }

  /**
   * 更新指定房间的内存
   */
  private updateRoomMemory(roomName: string, room: Room): void {
    const memory = Memory.rooms[roomName];
    memory.energyAvailable = room.energyAvailable;
    memory.energyCapacity = room.energyCapacityAvailable;
    memory.threatLevel = this.getRoomThreatLevel(roomName);
    memory.creepCounts = this.getCreepCounts(roomName);
    memory.lastUpdated = Game.time;
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

  /**
   * 计算威胁等级
   */
  private calculateThreatLevel(hostiles: Creep[]): "low" | "medium" | "high" | "critical" {
    let attackParts = 0;
    hostiles.forEach(c => {
      attackParts += c.getActiveBodyparts(ATTACK) + c.getActiveBodyparts(RANGED_ATTACK);
    });

    if (attackParts > 20) return "critical";
    if (attackParts > 10) return "high";
    if (attackParts > 0) return "medium";
    return "low";
  }

  // --- Public Accessors ---

  public getRoom(roomName: string): Room | undefined {
    return this.rooms.get(roomName);
  }

  public getMyRoomNames(): string[] {
    return Array.from(this.rooms.keys());
  }

  public hasEnemyThreat(roomName: string): boolean {
    return this.threatStates.get(roomName)?.hasThreat || false;
  }

  public getRoomThreatLevel(roomName: string): "none" | "low" | "medium" | "high" | "critical" {
    const room = this.rooms.get(roomName);
    if (!room || !this.hasEnemyThreat(roomName)) {
      return "none";
    }
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    return this.calculateThreatLevel(hostiles);
  }

  public getRoomThreatDetails(roomName: string): {
    threatLevel: string;
    hostileCount: number;
    lastActivity: number | undefined;
  } | null {
    if (!this.hasEnemyThreat(roomName)) return null;
    const room = this.rooms.get(roomName);
    const hostiles = room?.find(FIND_HOSTILE_CREEPS) || [];
    return {
      threatLevel: this.getRoomThreatLevel(roomName),
      hostileCount: hostiles.length,
      lastActivity: room?.memory.lastEnemyActivity
    };
  }
}
