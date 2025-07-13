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
  // 任务驱动相关字段
  taskType?: TaskType;        // 关联的任务类型
  taskCount?: number;         // 该类型任务的数量
  reason?: string;            // 生产原因
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

// 系统内存类型
export interface SystemMemory {
  lastCleanup: number;
  errorCount: number;
  managerStatus: { [managerName: string]: ManagerStatus };
  performance: PerformanceStats;
}

// 管理器状态类型
export interface ManagerStatus {
  hasError: boolean;
  lastError: number;
  errorCount: number;
  lastUpdate?: number;
}

// 性能统计类型
export interface PerformanceStats {
  lastUpdate: number;
  averageTickTime: number;
  totalCreeps?: number;
  totalRooms?: number;
  totalTasks?: number;
}

// 统计内存类型
export interface StatsMemory {
  lastUpdate: number;
  globalStats: GlobalStats;
  roomStats: { [roomName: string]: RoomStats };
  performanceHistory: PerformanceStats[];
}

// 全局统计类型
export interface GlobalStats {
  totalCreeps: number;
  totalRooms: number;
  totalEnergy: number;
  totalEnergyCapacity: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
}

// 房间统计类型
export interface RoomStats {
  roomName: string;
  energyAvailable: number;
  energyCapacity: number;
  creepCount: number;
  constructionSites: number;
  controllerLevel: number;
  lastUpdate: number;
}

// 协调内存类型
export interface CoordinationMemory {
  lastUpdate: number;
  roomPriorities: { [roomName: string]: number };
  resourceAllocation: { [roomName: string]: ResourceAllocation };
  crossRoomTasks: CrossRoomTask[];
}

// 资源分配类型
export interface ResourceAllocation {
  energy: number;
  creeps: { [role: string]: number };
  priority: number;
}

// 跨房间任务类型
export interface CrossRoomTask {
  id: string;
  type: string;
  sourceRoom: string;
  targetRoom: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: number;
}

// 用于存储可视化系统相关数据
export interface VisualsMemory {
  cache: string | null; // 缓存的视觉数据
  lastUpdateTime: number; // 上次更新的 tick
  layerSettings: {
    [layerName: string]: {
      enabled: boolean;
    };
  };
}

// 可视化图层类型
export enum LayerType {
  DATA = 'data', // 在屏幕固定位置显示文本信息
  MAP = 'map'    // 在游戏世界地图上绘制图形
}

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

// ==================== 后勤系统类型定义 ====================

// 提供点类型
export type ProviderType = 'container' | 'storage' | 'terminal' | 'link' | 'droppedResource' | 'tombstone';

// 消耗点类型
export type ConsumerType = 'container' | 'storage' | 'terminal' | 'link' | 'spawn' | 'extension' | 'tower' | 'lab' | 'nuker' | 'powerSpawn';

// 提供点信息接口
export interface ProviderInfo {
  id: string;
  type: ProviderType;
  pos: { x: number; y: number; roomName: string };
  resourceType: ResourceConstant;
  // 动态属性，由TransportService在运行时计算和更新
  amount?: number; // 当前可提供的资源数量
}

// 消耗点信息接口
export interface ConsumerInfo {
  id: string;
  type: ConsumerType;
  pos: { x: number; y: number; roomName: string };
  resourceType: ResourceConstant;
  // 动态属性，由TransportService在运行时计算和更新
  needs?: number; // 当前需要的资源数量
  priority?: number; // 动态计算的优先级
}

// 运输网络内存接口
export interface TransportNetworkMemory {
  providers: { [id: string]: ProviderInfo };
  consumers: { [id: string]: ConsumerInfo };
  lastUpdated: number;
}

// 后勤系统内存接口
export interface LogisticsMemory {
  transportNetwork?: TransportNetworkMemory;
  // 未来可扩展其他后勤子系统
  // market?: MarketMemory;
  // labManagement?: LabManagementMemory;
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

    eventBus: EventBusMemory;
    tasks?: TaskSystemMemory;
    gameEngine?: {
      initialized: boolean;
      lastTick: number;
      version?: string;
      startTime?: number;
    };
    system?: SystemMemory;
    stats?: StatsMemory;
    coordination?: CoordinationMemory;
    visuals?: VisualsMemory;
    constructPlanner?: ConstructionPlannerMemory;
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
    // 任务中断保护标志
    canBeInterrupted?: boolean; // 是否可以被中断，用于防止运输任务中途被打断
    // 采集位置分配
    assignedHarvestPos?: { x: number; y: number; roomName: string }; // 分配给creep的采集位置
  }

  interface RoomMemory {
    energyAvailable: number;
    energyCapacity: number;
    activeConstructionStrategy?: string | null;
    planningAttemptedAt?: number;
    needsAttention: boolean;
    lastEnemyActivity?: number; // 最近敌人活动时间
    // 统一后的新字段
    creepCounts: { [role: string]: number };
    threatLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
    lastUpdated: number;
    logistics?: LogisticsMemory;
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
      production?: { // 生产调试工具
        plan: (roomName?: string) => void;
        tasks: (roomName?: string) => void;
        queue: () => void;
        refresh: () => void;
      };
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
  ATTACK = 'attack'
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

// 任务分配模式枚举
export enum TaskAssignmentType {
  EXCLUSIVE = 'exclusive',  // 独占任务 - 只能分配给一个creep
  SHARED = 'shared'         // 共享任务 - 可以分配给多个creep
}

// 任务生命周期枚举
export enum TaskLifetime {
  ONCE = 'once',           // 一次性任务 - 有明确完成标准
  PERSISTENT = 'persistent' // 持久性任务 - 持续存在直到对象消失
}

// 任务基础接口
export interface BaseTask {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  roomName: string;
  assignmentType: TaskAssignmentType;
  lifetime: TaskLifetime;
  maxAssignees: number;
  assignedCreeps: string[];
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
  harvestPosition?: { x: number; y: number; roomName: string }; // 指定的采集位置
  targetId?: string;  // 存储目标，为空则丢在地上
  targetPos?: { x: number; y: number; roomName: string }; // 目标位置，如果指定了位置，则移动到该位置丢弃
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

// 建造任务参数
export interface BuildTaskParams {
  targetId: string;   // 目标建筑ID
  sourceConstructionIds: string[]; // 从该列表中的建筑拾取资源用于建造，为空则从任意符合条件的建筑中获取
}

// 升级任务参数
export interface UpgradeTaskParams {
  controllerId: string;   // 控制器ID
  sourceConstructionIds: string[]; // 从该列表中的建筑拾取资源用于升级，为空则从任意符合条件的建筑中获取
}

// 攻击任务参数
export interface AttackTaskParams {
  targetId: string;                    // 攻击目标ID
  targetType: 'creep' | 'structure';  // 目标类型
  attackType?: 'ranged' | 'melee' | 'auto'; // 攻击类型，auto为自动选择
  maxRange?: number;                   // 最大攻击距离
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

export interface BuildTask extends BaseTask {
  type: TaskType.BUILD;
  params: BuildTaskParams;
}

export interface UpgradeTask extends BaseTask {
  type: TaskType.UPGRADE;
  params: UpgradeTaskParams;
}

export interface AttackTask extends BaseTask {
  type: TaskType.ATTACK;
  params: AttackTaskParams;
}

// 联合类型
export type Task = HarvestTask | TransportTask | BuildTask | UpgradeTask | AttackTask;

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

// 任务系统内存
export interface TaskSystemMemory {
  taskQueue: Task[];
  creepTasks: { [creepName: string]: string }; // creep -> taskId 映射
  taskAssignments: { [taskId: string]: string[] }; // taskId -> creepNames 映射
  completedTasks: string[]; // 已完成的任务ID列表（用于清理）
  lastCleanup: number;
  stats: {
    tasksCreated: number;
    tasksCompleted: number;
    tasksFailed: number;
    averageExecutionTime: number;
  };
}
