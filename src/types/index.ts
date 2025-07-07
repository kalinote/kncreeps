// 游戏事件类型
export interface GameEvent {
  type: string;
  data: any;
  timestamp: number;
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
    creepStates: { [creepName: string]: CreepState };
    behaviorStats: { [role: string]: BehaviorStats };
    eventBus: EventBusMemory;
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
    state?: string;
    targetId?: string;
    targetSourceId?: string;    // 后续合并到task中
    // Defender专用内存(后续合并到task中)
    target?: string;           // 当前攻击目标ID
    patrolPoint?: { x: number; y: number; roomName: string }; // 巡逻点
    lastEnemySeen?: number;    // 最后发现敌人的时间
    enemyMemory?: { [enemyId: string]: number }; // 敌人记忆，存储最后见到的时间
  }

  interface RoomMemory {
    creepCounts: { [role: string]: number };
    energyCapacity: number;
    constructionSites: number;
    defenseLevel: number;
    lastAnalysis: number;
    needsAttention: boolean;
    lastEnemyActivity?: number; // 最近敌人活动时间
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

  interface BehaviorStats {
    executions: number;
    successes: number;
    failures: number;
    lastExecution: number;
    averageExecutionTime: number;
  }

  interface EventBusMemory {
    eventQueue: GameEvent[];
    processedEvents: GameEvent[];
    lastProcessTime: number;
  }

  namespace NodeJS {
    interface Global {
      log: any;
      gameEngine?: any; // 避免循环引用，使用any类型
    }
  }
}

export {};
