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
    tasks?: TaskSystemMemory;
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
      taskDebug?: any; // 添加任务调试工具
    }
  }
}

// ==================== 任务系统类型定义 ====================

// 任务类型枚举
export enum TaskType {
  HARVEST = 'harvest',
  TRANSPORT = 'transport',
  BUILD = 'build',
  REPAIR = 'repair',
  UPGRADE = 'upgrade',
  DEFEND = 'defend'
}

// 任务状态枚举
export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// 任务优先级枚举
export enum TaskPriority {
  EMERGENCY = 100,
  CRITICAL = 80,
  HIGH = 60,
  NORMAL = 40,
  LOW = 20,
  BACKGROUND = 10
}

// 任务基础接口
export interface BaseTask {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  roomName: string;
  assignedCreep?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
  maxRetries: number;
}

// 采集任务参数
export interface HarvestTaskParams {
  sourceId: string;
  targetId?: string;  // 存储目标，为空则丢在地上
  targetPos?: { x: number; y: number; roomName: string }; // 目标位置
}

// 运输任务参数
export interface TransportTaskParams {
  sourceId?: string;  // 源建筑ID
  sourcePos?: { x: number; y: number; roomName: string }; // 源位置（拾取地面资源）
  targetId?: string;  // 目标建筑ID
  targetPos?: { x: number; y: number; roomName: string }; // 目标位置（丢弃）
  resourceType: ResourceConstant;
  amount?: number;
}

// 具体任务接口
export interface HarvestTask extends BaseTask {
  type: TaskType.HARVEST;
  params: HarvestTaskParams;
}

export interface TransportTask extends BaseTask {
  type: TaskType.TRANSPORT;
  params: TransportTaskParams;
}

// 联合类型
export type Task = HarvestTask | TransportTask;

// 任务执行结果
export interface TaskResult {
  success: boolean;
  completed: boolean;
  message?: string;
  nextState?: string;
}

// 能力要求
export interface CapabilityRequirement {
  bodyPart: BodyPartConstant;
  minCount: number;
  weight: number;
}

// 任务执行器接口
export interface TaskExecutor {
  canExecute(creep: Creep, task: Task): boolean;
  execute(creep: Creep, task: Task): TaskResult;
  getRequiredCapabilities(): CapabilityRequirement[];
}

// 在全局Memory接口中添加任务系统内存
declare global {
  interface Memory {
    // ... 现有属性 ...
    tasks?: TaskSystemMemory;
  }
}

// 任务系统内存
export interface TaskSystemMemory {
  enabled: boolean;
  taskQueue: Task[];
  creepTasks: { [creepName: string]: string }; // creep -> taskId 映射
  completedTasks: string[]; // 已完成的任务ID列表（用于清理）
  lastCleanup: number;
  stats: {
    tasksCreated: number;
    tasksCompleted: number;
    tasksFailed: number;
    averageExecutionTime: number;
  };
}
