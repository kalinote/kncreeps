import { UnifiedMemoryCycleStructureMemory } from "./core";
// ========================== 内存类型开始 ==========================

export interface ConstructionManagerMemory extends UnifiedMemoryCycleStructureMemory {
  layouts: {
    [roomName: string]: RoomLayoutMemory;
  };
}

// 房间布局蓝图
export interface RoomLayoutMemory {
  version: number;
  lastUpdated: number;
  status: 'planning' | 'done';
  nextPlannerIndex: number;
  buildings: {
    [plannerName: string]: BuildingPlanMemory[];
  };
}

// 建造建筑规划
export interface BuildingPlanMemory {
  pos: { x: number; y: number; roomName: string };
  structureType: BuildableStructureConstant;
  logisticsRole: LogisticsRole;
  resourceType?: ResourceConstant;
}

// ========================== 内存类型结束 ==========================

// 后勤角色(后续可能进一步扩展)
export type LogisticsRole = 'provider' | 'consumer' | 'non_logistics_management_building';

// 建筑状态枚举
export enum ConstructionStatus {
  PLANNED = 'planned',           // 已规划但未开始建造
  UNDER_CONSTRUCTION = 'under_construction', // 正在建造中
  COMPLETED = 'completed'        // 建造完成
}

// 单个建筑的布局位置
export interface StructurePosition {
  pos: { x: number; y: number; roomName: string };
}

// 道路段信息
export interface RoadSegment {
  id: string;
  from: { x: number; y: number; roomName: string };
  to: { x: number; y: number; roomName: string };
  positions: { x: number; y: number }[];
  status: ConstructionStatus;
  createdAt: number;
  completedAt?: number;
}

// 道路规划信息
export interface RoadPlanInfo {
  roomName: string;
  segments: RoadSegment[];
  totalPositions: number;
  completedPositions: number;
  lastUpdated: number;
}

// 道路建造状态
export interface RoadConstructionStatus {
  roomName: string;
  plannedSegments: number;
  underConstructionSegments: number;
  completedSegments: number;
  totalPositions: number;
  completedPositions: number;
}
