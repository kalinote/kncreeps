// ========================== 内存类型开始 ==========================

export interface UnifiedMemoryCycleStructureMemory {
  initAt: number;       // 初始化时间
  lastUpdate: number;    // 上次更新时间
  lastCleanup: number;   // 上次清理时间
  errorCount: number;    // 错误计数
}

// ========================== 内存类型结束 ==========================

// 游戏事件类型
export interface GameEvent {
  type: string;
  data: any;
  timestamp: number;
}

// 系统内存类型
export interface SystemMemory {
  lastCleanup: number;
  errorCount: number;
  managerStatus: { [managerName: string]: ManagerStatus };
  performance: PerformanceStats;
}

// 管理器状态类型
export interface ManagerStatus {
  hasError: boolean;
  lastError: number;
  errorCount: number;
  lastUpdate?: number;
}

// 性能统计类型
export interface PerformanceStats {
  lastUpdate: number;
  averageTickTime: number;
  totalCreeps?: number;
  totalRooms?: number;
  totalTasks?: number;
}

// 统计内存类型
export interface StatsMemory {
  lastUpdate: number;
  globalStats: GlobalStats;
  roomStats: { [roomName: string]: RoomStats };
  performanceHistory: PerformanceStats[];
}

// 全局统计类型
export interface GlobalStats {
  totalCreeps: number;
  totalRooms: number;
  totalEnergy: number;
  totalEnergyCapacity: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
}

// 房间统计类型
export interface RoomStats {
  roomName: string;
  energyAvailable: number;
  energyCapacity: number;
  creepCount: number;
  constructionSites: number;
  controllerLevel: number;
  lastUpdate: number;
}







// 事件总线内存类型
export interface EventBusMemory {
  eventQueue: GameEvent[];
  processedEvents: GameEvent[];
  lastProcessTime: number;
}

// 扩展 Room.Terrain 类型定义
declare global {
  interface RoomTerrain {
    getRawBuffer(): {number: number};
  }
}
