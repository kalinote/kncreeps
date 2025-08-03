import { UnifiedMemoryCycleStructureMemory } from "./core";
// ========================== 内存类型开始 ==========================

export interface ConstructionManagerMemory extends UnifiedMemoryCycleStructureMemory {
  layouts: {
    [roomName: string]: ConstructServiceMemory;
  };
  strategy: ConstructPlannerStrategyServiceMemory;
}

// 房间布局蓝图
export interface ConstructServiceMemory extends UnifiedMemoryCycleStructureMemory {
  version: number;                  // 版本号
  buildings: {
    [structureType in BuildableStructureConstant]?: BuildingPlanMemory[];
  };  // 建筑队列
}

// 建造建筑规划
export interface BuildingPlanMemory {
  pos: { x: number; y: number; roomName: string };
  version: number;
  structureType: BuildableStructureConstant;
  logisticsRole: LogisticsRole;
  resourceType?: ResourceConstant;
}

export interface ConstructPlannerStrategyServiceMemory extends UnifiedMemoryCycleStructureMemory {
  planningQueue: PlanningTaskMemory[];    // 全局规划任务队列
  strategy: {         // 用于房间策略存储状态，暂定方案
    [roomName: string]: any;
  };
}

// 规划任务队列中的一项
export interface PlanningTaskMemory {
  plannerName: string;
  context: PlanningContextMemory;
}

// 规划任务上下文
export interface PlanningContextMemory {
  roomName: string;
  trigger: 'initial' | 'event'; // 触发类型
  event?: {
    type: string; // 如 GameConfig.EVENTS.ROOM_CONTROLLER_LEVEL_CHANGED
    data: any;
  };
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
  lastUpdate: number;
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
