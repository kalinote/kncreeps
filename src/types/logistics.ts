import { UnifiedMemoryCycleStructureMemory } from "./core";
// ========================== 内存类型开始 ==========================

// 后勤内存类型
export interface LogisticsMemory extends UnifiedMemoryCycleStructureMemory {
  // 运输网络
  transportNetworkService?: { [roomName: string]: TransportNetworkServiceMemory };
}

// 运输网络内存
export interface TransportNetworkServiceMemory {
  providers: { [id: string]: ProviderInfo };
  consumers: { [id: string]: ConsumerInfo };
  lastUpdated: number;
}

// 资源协调管理内存
export interface CoordinationManagerMemory extends UnifiedMemoryCycleStructureMemory {
  roomPriorities: { [roomName: string]: number };
  resourceAllocation: { [roomName: string]: ResourceAllocationMemory };
  crossRoomTasks: CrossRoomTaskMemory[];
}

// 跨房间任务类型
export interface CrossRoomTaskMemory {
  id: string;
  type: string;
  sourceRoom: string;
  targetRoom: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: number;
}

// 资源分配类型
export interface ResourceAllocationMemory {
  energy: number;
  creeps: { [role: string]: number };
  priority: number;
}

// ========================== 内存类型结束 ==========================

/**
 * 能量源类型
 */
export interface EnergySource {
  type: 'storage' | 'container' | 'spawn' | 'extension' | 'dropped' | 'source';
  object: Structure | Resource | Source;
  energy: number;
  distance: number;
}

/**
 * 能量获取策略
 */
export enum EnergySourceStrategy {
  STORAGE_ONLY = "storage_only",           // 只从存储建筑获取（升级工、建筑工）
  INCLUDE_GROUND = "include_ground",       // 包括地面资源（搬运工）
  HARVEST_DIRECT = "harvest_direct",       // 直接采集（采集工）
  BALANCED = "balanced"                    // 平衡策略（工程师等）
}

/**
 * 能量获取配置
 */
export interface EnergySourceConfig {
  strategy: EnergySourceStrategy;
  allowSpawn: boolean;                     // 是否允许从spawn获取
  allowExtensions: boolean;                // 是否允许从extension获取
  allowContainers: boolean;                // 是否允许从container获取
  allowStorage: boolean;                   // 是否允许从storage获取
  allowDroppedResources: boolean;          // 是否允许捡拾地面资源
  allowDirectHarvest: boolean;             // 是否允许直接采集
  minEnergyThreshold: number;              // 最小能量阈值
}

// 提供者类型
export type ProviderType = 'container' | 'storage' | 'terminal' | 'link' | 'droppedResource' | 'tombstone' | 'creep';
export type ProviderStatus = 'underConstruction' | 'ready' | 'disabled';
export type Providers = Structure | Resource | Tombstone | Creep | ConstructionSite;

// 消费者类型
export type ConsumerType = 'container' | 'storage' | 'terminal' | 'link' | 'spawn' | 'extension' | 'tower' | 'lab' | 'nuker' | 'powerSpawn' | 'creep';
export type Consumers = Structure | Creep | ConstructionSite;

// 提供者信息
export interface ProviderInfo {
  id: string;
  type: ProviderType;
  pos: { x: number; y: number; roomName: string };
  resourceType: ResourceConstant;
  // 动态属性，由TransportService在运行时计算和更新
  amount?: number; // 当前可提供的资源数量
  status?: ProviderStatus; // 当前建筑状态
}

// 消费者信息
export interface ConsumerInfo {
  id: string;
  type: ConsumerType;
  pos: { x: number; y: number; roomName: string };
  resourceType: ResourceConstant;
  // 动态属性，由TransportService在运行时计算和更新
  needs?: number; // 当前需要的资源数量
  priority?: number; // 动态计算的优先级
}


