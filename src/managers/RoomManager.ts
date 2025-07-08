import { BaseManager } from "../managers/BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { clear } from "console";

/**
 * 房间管理器 - 管理所有房间的状态和操作
 */
export class RoomManager extends BaseManager {
  private rooms: Map<string, Room> = new Map();
  private lastRoomScan: number = 0;

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.setupEventListeners();
  }

  /**
   * 更新房间管理器
   */
  public update(): void {
    if (!this.shouldUpdate()) {
      return;
    }

    this.safeExecute(() => {
      this.scanRooms();
      this.updateRoomStates();
      this.checkRoomAlerts();
    }, 'RoomManager.update');

    this.updateCompleted();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.on(GameConfig.EVENTS.ROOM_ENERGY_CHANGED, (data: any) => {
      this.handleRoomEnergyChanged(data);
    });

    this.on(GameConfig.EVENTS.ROOM_UNDER_ATTACK, (data: any) => {
      this.handleRoomUnderAttack(data);
    });
  }

  /**
   * 扫描房间
   */
  private scanRooms(): void {
    // 每10个tick扫描一次房间
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
    console.log(`房间扫描完成: 发现 ${this.rooms.size} 个己方房间`);
  }

  /**
   * 更新房间状态
   */
  private updateRoomStates(): void {
    for (const [roomName, room] of this.rooms) {
      this.updateRoomState(room);
    }
  }

  /**
   * 更新单个房间状态
   */
  private updateRoomState(room: Room): void {
    const roomName = room.name;
    const previousEnergy = Memory.rooms[roomName]?.energyCapacity || 0;
    const currentEnergy = room.energyCapacityAvailable;

    // 检查能量容量变化
    if (previousEnergy !== currentEnergy) {
      this.emit(GameConfig.EVENTS.ROOM_ENERGY_CHANGED, {
        roomName,
        previousEnergy,
        currentEnergy,
        energyAvailable: room.energyAvailable
      });
    }

    // 检查敌对威胁
    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    if (hostileCreeps.length > 0) {
      // 记录敌人活动到房间内存
      if (!room.memory.lastEnemyActivity) {
        room.memory.lastEnemyActivity = Game.time;
      }
      room.memory.lastEnemyActivity = Game.time;

      this.emit(GameConfig.EVENTS.ROOM_UNDER_ATTACK, {
        roomName,
        hostileCount: hostileCreeps.length,
        hostiles: hostileCreeps.map(creep => ({
          name: creep.name,
          owner: creep.owner.username,
          pos: creep.pos,
          body: creep.body
        }))
      });
    }
  }

  /**
   * 检查房间警报
   */
  private checkRoomAlerts(): void {
    for (const [roomName, room] of this.rooms) {
      const alerts = this.analyzeRoomConditions(room);

      // TODO 暂时写死10个tick报告一次
      if (alerts.length > 0 && Game.time % 10 == 0) {
        console.log(`房间 ${roomName} 警报:`, alerts);

        // 发送房间需要注意的事件
        this.emit(GameConfig.EVENTS.ROOM_NEEDS_ATTENTION, {
          roomName,
          alerts,
          severity: this.calculateAlertSeverity(alerts)
        });
      }
    }
  }

  /**
   * 分析房间状况
   */
  private analyzeRoomConditions(room: Room): string[] {
    const alerts: string[] = [];

    // 检查能量不足
    if (room.energyAvailable < GameConfig.THRESHOLDS.EMERGENCY_ENERGY_LEVEL) {
      alerts.push('能量紧急不足');
    }

    // 检查建筑损坏
    const damagedStructures = room.find(FIND_STRUCTURES, {
              filter: (structure) => structure.hits < structure.hitsMax * GameConfig.THRESHOLDS.EMERGENCY_REPAIR_THRESHOLD
    });
    if (damagedStructures.length > 0) {
      alerts.push(`${damagedStructures.length} 个建筑受损`);
    }

    // 检查creep数量
    const creepCount = Object.values(Game.creeps)
      .filter(creep => creep.room.name === room.name).length;
    if (creepCount === 0) {
      alerts.push('房间内无creep');
    }

    return alerts;
  }

  /**
   * 计算警报严重程度
   */
  private calculateAlertSeverity(alerts: string[]): 'low' | 'medium' | 'high' | 'critical' {
    if (alerts.some(alert => alert.includes('紧急'))) {
      return 'critical';
    }
    if (alerts.some(alert => alert.includes('无creep'))) {
      return 'high';
    }
    if (alerts.length >= 2) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * 事件处理方法
   */
  private handleRoomEnergyChanged(data: any): void {
    const { roomName, previousEnergy, currentEnergy } = data;
    console.log(`房间 ${roomName} 能量容量变化: ${previousEnergy} -> ${currentEnergy}`);
  }

  private handleRoomUnderAttack(data: any): void {
    const { roomName, hostileCount } = data;
    console.log(`⚠️ 房间 ${roomName} 受到攻击! 敌对单位数量: ${hostileCount}`);
  }

  /**
   * 获取房间统计信息
   */
  public getRoomStats(): any {
    const stats: any = {
      totalRooms: this.rooms.size,
      roomDetails: []
    };

    for (const [roomName, room] of this.rooms) {
      stats.roomDetails.push({
        name: roomName,
        energyAvailable: room.energyAvailable,
        energyCapacity: room.energyCapacityAvailable,
        controllerLevel: room.controller?.level || 0,
        creepCount: Object.values(Game.creeps)
          .filter(creep => creep.room.name === roomName).length,
        constructionSites: room.find(FIND_MY_CONSTRUCTION_SITES).length
      });
    }

    return stats;
  }

  /**
   * 获取特定房间信息
   */
  public getRoom(roomName: string): Room | undefined {
    return this.rooms.get(roomName);
  }

  /**
   * 获取所有房间名称
   */
  public getRoomNames(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * 检查房间是否有敌人威胁
   */
  public hasEnemyThreat(roomName: string): boolean {
    const room = this.rooms.get(roomName);
    if (!room) {
      return false;
    }

    // 检查是否有敌对creep
    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    if (hostileCreeps.length > 0) {
      return true;
    }

    // 检查是否有敌对建筑
    const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
    if (hostileStructures.length > 0) {
      return true;
    }

    // 检查最近是否有敌人活动的记录
    if (room.memory.lastEnemyActivity &&
        Game.time - room.memory.lastEnemyActivity < GameConfig.THRESHOLDS.ENEMY_MEMORY_DURATION) {
      return true;
    }

    return false;
  }

  /**
   * 获取房间威胁级别
   */
  public getRoomThreatLevel(roomName: string): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    const room = this.rooms.get(roomName);
    if (!room) {
      return 'none';
    }

    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    if (hostileCreeps.length === 0) {
      // 检查最近是否有威胁记录
      if (room.memory.lastEnemyActivity &&
          Game.time - room.memory.lastEnemyActivity < GameConfig.THRESHOLDS.ENEMY_MEMORY_DURATION) {
        return 'low';  // 最近有威胁但现在没有
      }
      return 'none';
    }

    // 计算威胁分数
    let threatScore = 0;
    for (const hostile of hostileCreeps) {
      threatScore += hostile.getActiveBodyparts(ATTACK) * 10;
      threatScore += hostile.getActiveBodyparts(RANGED_ATTACK) * 8;
      threatScore += hostile.getActiveBodyparts(WORK) * 5;
      threatScore += hostile.getActiveBodyparts(HEAL) * 6;
    }

    if (threatScore >= 50) return 'critical';
    if (threatScore >= 30) return 'high';
    if (threatScore >= 10) return 'medium';
    return 'low';
  }

  /**
   * 获取房间详细威胁信息
   */
  public getRoomThreatDetails(roomName: string): any {
    const room = this.rooms.get(roomName);
    if (!room) {
      return null;
    }

    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);

    return {
      roomName,
      threatLevel: this.getRoomThreatLevel(roomName),
      hostileCreepCount: hostileCreeps.length,
      hostileStructureCount: hostileStructures.length,
      lastEnemyActivity: room.memory.lastEnemyActivity,
      hasActiveThreats: hostileCreeps.length > 0 || hostileStructures.length > 0,
      hostileCreeps: hostileCreeps.map(creep => ({
        name: creep.name,
        owner: creep.owner.username,
        pos: creep.pos,
        attackParts: creep.getActiveBodyparts(ATTACK),
        rangedAttackParts: creep.getActiveBodyparts(RANGED_ATTACK),
        healParts: creep.getActiveBodyparts(HEAL)
      }))
    };
  }

  /**
   * 重置时的清理工作
   */
  protected onReset(): void {
    this.rooms.clear();
    this.lastRoomScan = 0;
  }
}
