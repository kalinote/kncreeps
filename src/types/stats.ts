// ========================== 内存类型开始 ==========================

import { UnifiedMemoryCycleStructureMemory } from "./core";

// 统计内存类型
export interface StatsManagerMemory extends UnifiedMemoryCycleStructureMemory {
  globalStats?: GlobalStatsServiceMemory;
  roomStats?: { [roomName: string]: RoomStatsServiceMemory };
  performance?: PerformanceStatsServiceMemory;
}

// 全局统计类型
export interface GlobalStatsServiceMemory extends UnifiedMemoryCycleStructureMemory {
  totalCreeps: number;
  totalRooms: number;
  totalEnergy: number;
  totalEnergyCapacity: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
}

// 房间统计类型
export interface RoomStatsServiceMemory extends UnifiedMemoryCycleStructureMemory {
  roomName: string;
  energyAvailable: number;
  energyCapacity: number;
  creepCount: number;
  constructionSites: number;
  controllerLevel: number;
}

// 性能统计类型
export interface PerformanceStatsServiceMemory extends UnifiedMemoryCycleStructureMemory {
  // TODO 增加新的性能指标
  currentTickTime: number;      // 当前tick时间
  averageTickTime: number;      // 平均tick时间
  averageTickTimeCount: number; // 平均tick时间计数
  performanceHistory?: PerformanceStatsServiceMemory[];
}

// ========================== 内存类型结束 ==========================
