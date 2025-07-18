// Creep状态类型
export interface CreepState {
  name: string;
  phase: 'young' | 'mature' | 'aging';
  ticksToLive: number;
  lifePercent: number;
  needsReplacement: boolean;
}

// 导入TaskType类型
import { TaskType } from './task';

// 生产需求类型
export interface ProductionNeed {
  roomName: string;
  role: string;
  priority: number;
  urgency: 'critical' | 'high' | 'normal' | 'low';
  energyBudget?: number;
  timestamp?: number;
  // 任务驱动相关字段
  taskType?: TaskType;      // 关联的任务类型
  taskCount?: number;       // 该类型任务的数量
  reason?: string;          // 生产原因
}

// 角色模板类型
export interface RoleTemplate {
  name: string;
  minConfig: BodyPartConstant[];
  standardConfig: BodyPartConstant[];
  maxConfig: BodyPartConstant[];
  scalingRules: ScalingRule[];
}

// 扩展规则类型
export interface ScalingRule {
  priority: number;
  part: BodyPartConstant;
  maxCount?: number;
  ratio?: number;
}

// 威胁信息类型
export interface ThreatInfo {
  roomName: string;
  creepName: string;
  owner: string;
  threatLevel: number;
  timestamp?: number;
}

// 机会信息类型
export interface OpportunityInfo {
  roomName: string;
  type: string;
  description: string;
  priority: number;
  timestamp?: number;
}

// 情报内存类型
export interface IntelligenceMemory {
  scoutReports: { [roomName: string]: any };
  threats: ThreatInfo[];
  opportunities: OpportunityInfo[];
  lastUpdate: number;
}

// Creep生产内存类型
export interface CreepProductionMemory {
  queue: ProductionNeed[];
  lastProduction: number;
  energyBudget: number;
}
