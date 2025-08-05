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
  areas: RoomAreasMemory[];
  constructionSites: { [id: string]: ConstructionSiteMemory }; // 建筑工地表
}

export interface ConstructionSiteMemory {
  id: string;
  pos: { x: number, y: number, roomName: string };
  structureType: BuildableStructureConstant;
  progress: number;
  progressTotal: number;
}

export interface RoomAreasMemory extends UnifiedMemoryCycleStructureMemory {
  coord: { x: number, y: number };       // 空间中心点坐标
  openness: number;   // 空间开阔度(距离值)
  area: number;       // 空间估算面积
  centrality: number; // 空间中心性(0-1)
  score: number;      // 空间得分(0-1)
}

// ========================== 内存类型结束 ==========================
