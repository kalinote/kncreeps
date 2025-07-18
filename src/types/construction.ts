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

// 房间布局蓝图
export interface RoomLayout {
  version: number;
  lastUpdated: number;
  status: 'planning' | 'done';
  nextPlannerIndex: number;
  buildings: {
    [plannerName: string]: StructurePosition[];
  };
}

// 建筑规划模块的内存
export interface ConstructionPlannerMemory {
  layouts: {
    [roomName: string]: RoomLayout;
  };
  lastRun: number;
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
