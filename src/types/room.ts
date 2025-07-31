// ========================== 内存类型开始 ==========================

import { UnifiedMemoryCycleStructureMemory } from "./core";

export interface RoomManagerMemory extends UnifiedMemoryCycleStructureMemory {
  analysis?: { [roomName: string]: RoomAnalysisMemory };
}

export interface RoomAnalysisMemory extends UnifiedMemoryCycleStructureMemory {
  // TODO 进一步细化功能结构
  energyAvailable: number;    // 房间当前能量
  energyCapacity: number;     // 房间最大能量
  controllerLevel: number;    // 房间控制等级
  creepCounts: { [role: string]: number }; // 房间内各角色数量
}

// ========================== 内存类型结束 ==========================
