import { GameConfig } from "../config/GameConfig";

/**
 * 状态管理器 - 管理全局游戏状态
 */
export class StateManager {
  private initialized: boolean = false;
  private lastUpdateTick: number = 0;

  /**
   * 初始化状态管理器
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initializeMemoryStructure();
    this.initializeGameState();
    this.initialized = true;

    console.log('状态管理器已初始化');
  }

  /**
   * 更新全局状态
   */
  public update(): void {
    if (!this.initialized) {
      this.initialize();
    }

    // 更新游戏引擎状态
    this.updateGameEngineState();

    // 更新房间状态
    this.updateRoomStates();

    // 清理过期数据
    this.cleanupExpiredData();

    this.lastUpdateTick = Game.time;
  }

  /**
   * 初始化内存结构
   */
  private initializeMemoryStructure(): void {
    // 初始化基本内存结构
    if (!Memory.gameEngine) {
      Memory.gameEngine = {
        initialized: true,
        lastTick: Game.time
      };
    }

    if (!Memory.rooms) {
      Memory.rooms = {};
    }

    if (!Memory.creepProduction) {
      Memory.creepProduction = {
        queue: [],
        lastProduction: Game.time,
        energyBudget: 0
      };
    }

    if (!Memory.intelligence) {
      Memory.intelligence = {
        scoutReports: {},
        threats: [],
        opportunities: [],
        lastUpdate: Game.time
      };
    }

    if (!Memory.creepStates) {
      Memory.creepStates = {};
    }


    // 已移除，使用任务系统替代

    if (!Memory.eventBus) {
      Memory.eventBus = {
        eventQueue: [],
        processedEvents: [],
        lastProcessTime: Game.time
      };
    }

    // 为每个房间初始化内存
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        this.initializeRoomMemory(roomName);
      }
    }
  }

  /**
   * 初始化房间内存
   */
  private initializeRoomMemory(roomName: string): void {
    if (!Memory.rooms[roomName]) {
      Memory.rooms[roomName] = {
        creepCounts: {},
        energyCapacity: 0,
        constructionSites: 0,
        defenseLevel: 0,
        lastAnalysis: Game.time,
        needsAttention: false
      };
    }
  }

  /**
   * 初始化游戏状态
   */
  private initializeGameState(): void {
    // 设置全局引用
    if (!Memory.uuid) {
      Memory.uuid = Math.floor(Math.random() * 1000000);
    }

    // 初始化日志系统
    if (!Memory.log) {
      Memory.log = {};
    }

    // 清理死亡creep的内存
    this.cleanupDeadCreeps();
  }

  /**
   * 更新游戏引擎状态
   */
  private updateGameEngineState(): void {
    if (Memory.gameEngine) {
      Memory.gameEngine.lastTick = Game.time;
    }
  }

  /**
   * 更新房间状态
   */
  private updateRoomStates(): void {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        this.updateRoomState(room);
      }
    }
  }

  /**
   * 更新单个房间状态
   */
  private updateRoomState(room: Room): void {
    const roomName = room.name;

    if (!Memory.rooms[roomName]) {
      this.initializeRoomMemory(roomName);
    }

    const roomMemory = Memory.rooms[roomName];

    // 更新能量容量
    roomMemory.energyCapacity = GameConfig.getRoomEnergyCapacity(room);

    // 更新creep数量统计
    roomMemory.creepCounts = this.getCreepCounts(roomName);

    // 更新建造站点数量
    roomMemory.constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES).length;

    // 检查是否需要注意
    roomMemory.needsAttention = this.checkRoomNeedsAttention(room);

    // 更新最后分析时间
    roomMemory.lastAnalysis = Game.time;
  }

  /**
   * 获取房间内creep数量统计
   */
  private getCreepCounts(roomName: string): { [role: string]: number } {
    const counts: { [role: string]: number } = {};

    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName];
      if (creep.memory.room === roomName || creep.room.name === roomName) {
        const role = creep.memory.role;
        counts[role] = (counts[role] || 0) + 1;
      }
    }

    return counts;
  }

  /**
   * 检查房间是否需要注意
   */
  private checkRoomNeedsAttention(room: Room): boolean {
    // 检查能量紧急情况
    if (room.energyAvailable < GameConfig.THRESHOLDS.EMERGENCY_ENERGY_LEVEL) {
      return true;
    }

    // 检查是否有敌对creep
    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    if (hostileCreeps.length > 0) {
      return true;
    }

    // 检查重要建筑是否受损
    const damagedStructures = room.find(FIND_STRUCTURES, {
      filter: (structure) => structure.hits < structure.hitsMax * 0.5
    });
    if (damagedStructures.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * 清理死亡creep的内存
   */
  private cleanupDeadCreeps(): void {
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }
  }

  /**
   * 清理过期数据
   */
  private cleanupExpiredData(): void {
    if (Game.time % GameConfig.UPDATE_FREQUENCIES.CLEANUP === 0) {
      this.cleanupIntelligenceData();
      this.cleanupProductionQueue();
    }
  }

  /**
   * 清理情报数据
   */
  private cleanupIntelligenceData(): void {
    const maxAge = 1000; // 1000 ticks
    const currentTime = Game.time;

    // 清理过期的侦察报告
    for (const roomName in Memory.intelligence.scoutReports) {
      const report = Memory.intelligence.scoutReports[roomName];
      if (report.timestamp && currentTime - report.timestamp > maxAge) {
        delete Memory.intelligence.scoutReports[roomName];
      }
    }

    // 清理过期的威胁信息
    Memory.intelligence.threats = Memory.intelligence.threats.filter(
      threat => threat.timestamp ? currentTime - threat.timestamp < maxAge : true
    );

    // 清理过期的机会信息
    Memory.intelligence.opportunities = Memory.intelligence.opportunities.filter(
      opportunity => opportunity.timestamp ? currentTime - opportunity.timestamp < maxAge : true
    );
  }

  /**
   * 清理生产队列
   */
  private cleanupProductionQueue(): void {
    const maxAge = 500; // 500 ticks
    const currentTime = Game.time;

    Memory.creepProduction.queue = Memory.creepProduction.queue.filter(
      request => request.timestamp ? currentTime - request.timestamp < maxAge : true
    );
  }

  /**
   * 获取游戏状态统计
   */
  public getGameStats(): any {
    const stats = {
      gameTime: Game.time,
      lastUpdateTick: this.lastUpdateTick,
      totalCreeps: Object.keys(Game.creeps).length,
      totalRooms: Object.keys(Game.rooms).length,
      ownedRooms: Object.values(Game.rooms).filter(room => room.controller?.my).length,
      totalEnergy: Object.values(Game.rooms)
        .filter(room => room.controller?.my)
        .reduce((total, room) => total + room.energyAvailable, 0),
      memoryUsage: JSON.stringify(Memory).length
    };

    return stats;
  }

  /**
   * 检查是否已初始化
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 重置状态管理器
   */
  public reset(): void {
    this.initialized = false;
    this.lastUpdateTick = 0;
    console.log('状态管理器已重置');
  }
}
