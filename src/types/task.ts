import { UnifiedMemoryCycleStructureMemory } from "./core";
// ========================== 内存类型开始 ==========================

// 任务系统内存类型
export interface TaskManagerMemory extends UnifiedMemoryCycleStructureMemory {
  // taskQueue: Task[];
  // creepTasks: { [creepName: string]: string }; // creep -> taskId 映射
  // taskAssignments: { [taskId: string]: string[] }; // taskId -> creepNames 映射
  // completedTasks: string[]; // 已完成的任务ID列表（用于清理）
  // stats: {
  //   tasksCreated: number;
  //   tasksCompleted: number;
  //   tasksFailed: number;
  //   averageExecutionTime: number;
  // };
  execution?: TaskExecutionServiceMemory;
  generator?: TaskGeneratorServiceMemory;
  group?: TaskGroupServiceMemory;
  scheduler?: TaskSchedulerServiceMemory;
  state?: TaskStateServiceMemory;
}

// 任务执行服务内存类型
export interface TaskExecutionServiceMemory extends UnifiedMemoryCycleStructureMemory {

}

// 任务生成服务内存类型
export interface TaskGeneratorServiceMemory extends UnifiedMemoryCycleStructureMemory {

}

// 任务组服务内存类型
export interface TaskGroupServiceMemory extends UnifiedMemoryCycleStructureMemory {

}

// 任务调度服务内存类型
export interface TaskSchedulerServiceMemory extends UnifiedMemoryCycleStructureMemory {

}


// 任务状态服务内存类型
export interface TaskStateServiceMemory extends UnifiedMemoryCycleStructureMemory {

}

// 基础任务接口
export interface BaseTask {
  id: string;
  type: TaskType;
  basePriority: TaskPriority;   // 基础优先级
  effectivePriority?: number;   // 动态有效优先级，由PriorityCalculator计算
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
  fsm?: TaskFSMMemory;
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
  sourceIds: string[]; // 从该列表中的建筑拾取资源用于建造，为空则从任意符合条件的建筑中获取
}

// 升级任务参数
export interface UpgradeTaskParams {
  controllerId: string;   // 控制器ID
  sourceIds: string[]; // 从该列表中的建筑拾取资源用于升级，为空则从任意符合条件的建筑中获取
}

// 攻击任务参数
export interface AttackTaskParams {
  targetId: string;                    // 攻击目标ID
  targetType: 'creep' | 'structure';  // 目标类型
  attackType?: 'ranged' | 'melee' | 'auto'; // 攻击类型，auto为自动选择
  maxRange?: number;                   // 最大攻击距离
}

// 具体任务类型
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

// 任务联合类型
export type Task = HarvestTask | TransportTask | BuildTask | UpgradeTask | AttackTask;

// ========================== 内存类型结束 ==========================

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

// 任务分配类型枚举
export enum TaskAssignmentType {
  EXCLUSIVE = 'exclusive',  // 独占任务 - 只能分配给一个creep
  SHARED = 'shared'         // 共享任务 - 可以分配给多个creep
}

// 任务生命周期枚举
export enum TaskLifetime {
  ONCE = 'once',           // 一次性任务 - 有明确完成标准
  PERSISTENT = 'persistent' // 持久性任务 - 持续存在直到对象消失
}

// 任务种类枚举
export enum TaskKind {
  HARVEST = 'HARVEST',
  TRANSPORT = 'TRANSPORT',
  BUILD = 'BUILD',
  UPGRADE = 'UPGRADE',
  ATTACK = 'ATTACK'
}


// 任务结果类型
export interface TaskResult {
  success: boolean;
  completed: boolean;
  message?: string;
  nextState?: string;
}

// 能力需求类型
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



// FSM相关类型
export interface TaskFSMMemory<TState extends string = string> {
  kind: TaskKind;                    // 任务大类
  taskState: TState;                 // 任务状态
  groupId?: string;                  // 协同组ID
  creepStates: { [creepName: string]: CreepFSMState<TState> }; // creep -> state 映射
}

export interface CreepFSMState<TState extends string = string> {
  interruptible: boolean;            // 可中断标记
  currentState: TState;              // 该creep的当前执行状态
  record?: Record<string, any>;       // 记录该creep的状态转换记录
}

export type StateHandler<TState extends string> = (creep: Creep) => TState | void;
export type StateHandlers<TState extends string> = Record<TState, StateHandler<TState>>;

// 状态枚举
export enum HarvestState {
  INIT = 'INIT',
  MOVING = 'MOVING',
  HARVESTING = 'HARVESTING',
  DUMPING = 'DUMPING',
  FINISHED = 'FINISHED'
}

export enum TransportState {
  INIT = 'INIT',
  PICKUP = 'PICKUP',
  DELIVER = 'DELIVER',
  DROPPING = 'DROPPING',
  FINISHED = 'FINISHED'
}

export enum BuildState {
  INIT = 'INIT',
  GET_ENERGY = 'GET_ENERGY',
  BUILDING = 'BUILDING',
  FINISHED = 'FINISHED'
}

export enum UpgradeState {
  INIT = 'INIT',
  GET_ENERGY = 'GET_ENERGY',
  UPGRADING = 'UPGRADING',
  FINISHED = 'FINISHED'
}

export enum AttackState {
  INIT = 'INIT',
  MOVE = 'MOVE',
  MELEE = 'MELEE',
  RANGED = 'RANGED',
  FINISHED = 'FINISHED'
}

export enum UpgradeTaskState {
  INITIALIZING = 'initializing',                    // 初始化
  GETTING_ENERGY = 'getting_energy',                // 获取能量
  MOVING_TO_CONTROLLER = 'moving_to_controller',    // 移动到控制器
  UPGRADING = 'upgrading'                           // 升级控制器
}
