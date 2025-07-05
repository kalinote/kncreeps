// 游戏事件类型
export interface GameEvent {
  type: string;
  data: any;
  timestamp: number;
}

// 任务类型
export interface Task {
  id: string;
  type: string;
  priority: number;
  roomName: string;
  targetId?: string;
  assignedCreep?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  createdAt: number;
  deadline?: number;
}

// 生产需求类型
export interface ProductionNeed {
  roomName: string;
  role: string;
  priority: number;
  urgency: 'critical' | 'high' | 'normal' | 'low';
  energyBudget?: number;
  timestamp?: number;
}

// Creep状态类型
export interface CreepState {
  name: string;
  phase: 'young' | 'mature' | 'aging';
  ticksToLive: number;
  lifePercent: number;
  needsReplacement: boolean;
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

// 全局类型扩展
declare global {
  interface Memory {
    uuid: number;
    log: any;
    // 系统相关的内存扩展
    rooms: { [roomName: string]: RoomMemory };
    creepProduction: CreepProductionMemory;
    intelligence: IntelligenceMemory;
    gameEngine?: {
      initialized: boolean;
      lastTick: number;
    };
  }

  interface CreepMemory {
    role: string;
    room: string;
    working: boolean;
    // 扩展creep内存
    task?: Task;
    state?: string;
    targetId?: string;
    assignedRoom?: string;
    lastTask?: string;
    efficiency?: number;
  }

  interface RoomMemory {
    creepCounts: { [role: string]: number };
    energyCapacity: number;
    constructionSites: number;
    defenseLevel: number;
    lastAnalysis: number;
    needsAttention: boolean;
  }

  interface CreepProductionMemory {
    queue: ProductionNeed[];
    lastProduction: number;
    energyBudget: number;
  }

  interface IntelligenceMemory {
    scoutReports: { [roomName: string]: any };
    threats: ThreatInfo[];
    opportunities: OpportunityInfo[];
    lastUpdate: number;
  }

  namespace NodeJS {
    interface Global {
      log: any;
      gameEngine?: any; // 避免循环引用，使用any类型
    }
  }
}

export {};
