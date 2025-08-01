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
