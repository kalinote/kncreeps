import { TaskType } from "../types";
import { GameConfig } from "./GameConfig";

/**
 * 任务-角色映射配置
 * 定义每种任务类型可以由哪些角色执行，以及优先级
 */
export class TaskRoleMapping {
  // 任务类型到角色的映射（按优先级排序）
  public static readonly TASK_ROLE_MAPPING = {
    [TaskType.HARVEST]: [
      { role: GameConfig.ROLES.WORKER, priority: 1 }
    ],
    [TaskType.TRANSPORT]: [
      { role: GameConfig.ROLES.TRANSPORTER, priority: 1 },
      { role: GameConfig.ROLES.WORKER, priority: 2 }
    ],
    [TaskType.BUILD]: [
      { role: GameConfig.ROLES.WORKER, priority: 1 }
    ],
    [TaskType.REPAIR]: [
      { role: GameConfig.ROLES.WORKER, priority: 1 }
    ],
    [TaskType.UPGRADE]: [
      { role: GameConfig.ROLES.WORKER, priority: 1 }
    ],
    [TaskType.ATTACK]: [
      { role: GameConfig.ROLES.SHOOTER, priority: 1 }
    ]
  } as const;

  // 任务类型的基础优先级
  public static readonly TASK_BASE_PRIORITIES = {
    [TaskType.HARVEST]: GameConfig.PRIORITIES.CRITICAL,    // 采集是最基础的
    [TaskType.TRANSPORT]: GameConfig.PRIORITIES.HIGH,       // 运输很重要
    [TaskType.BUILD]: GameConfig.PRIORITIES.MEDIUM,         // 建造中等优先级
    [TaskType.REPAIR]: GameConfig.PRIORITIES.MEDIUM,        // 修复中等优先级
    [TaskType.UPGRADE]: GameConfig.PRIORITIES.MEDIUM,       // 升级中等优先级
    [TaskType.ATTACK]: GameConfig.PRIORITIES.HIGH           // 攻击高优先级
  } as const;

  // 任务系统清理周期配置
  public static readonly TASK_CLEANUP_FREQUENCIES = {
    MAIN_CLEANUP: 30,                    // 任务系统主要清理周期（ticks）
    DEAD_CREEP_CLEANUP: 50,              // 死亡creep任务分配清理周期
    COMPLETED_TASK_CLEANUP: 20,         // 已完成任务清理周期
    DUPLICATE_TASK_CLEANUP: 30,        // 重复任务检测和清理周期
    EXPIRED_TASK_CLEANUP: 500,           // 过期任务清理周期
    STATS_OUTPUT: 20,                    // 任务统计信息输出频率
    ASSIGNMENT_RETRY: 10,                // 任务分配重试周期
    EXECUTION_TIMEOUT_CHECK: 30          // 任务执行超时检查周期
  } as const;

  // 任务清理相关配置
  public static readonly TASK_CLEANUP_CONFIG = {
    // 保留的已完成任务数量
    COMPLETED_TASKS_TO_KEEP: 50,

    // 任务执行超时时间（ticks）
    TASK_EXECUTION_TIMEOUT: 1000,

    // 任务重试次数
    MAX_TASK_RETRIES: 3,

    // 重复任务检测阈值
    DUPLICATE_DETECTION_THRESHOLD: 5,

    // 任务过期时间（ticks）
    TASK_EXPIRATION_TIME: 2000
  } as const;

  /**
   * 获取任务类型对应的角色列表
   */
  public static getRolesForTask(taskType: TaskType): string[] {
    const mapping = TaskRoleMapping.TASK_ROLE_MAPPING[taskType];
    return mapping ? mapping.map(item => item.role) : [];
  }

  /**
   * 获取任务类型的基础优先级
   */
  public static getTaskBasePriority(taskType: TaskType): number {
    return TaskRoleMapping.TASK_BASE_PRIORITIES[taskType] || GameConfig.PRIORITIES.MEDIUM;
  }

  /**
   * 计算任务的生产优先级
   */
  public static calculateTaskPriority(taskType: TaskType, taskCount: number): number {
    const basePriority = TaskRoleMapping.getTaskBasePriority(taskType);

    // 根据任务数量调整优先级（最多3倍）
    const multiplier = Math.min(taskCount, 3);

    return basePriority * multiplier;
  }

  /**
   * 计算任务的紧急程度
   */
  public static calculateTaskUrgency(taskType: TaskType, taskCount: number): 'critical' | 'high' | 'normal' | 'low' {
    const basePriority = TaskRoleMapping.getTaskBasePriority(taskType);

    if (basePriority >= GameConfig.PRIORITIES.CRITICAL || taskCount >= 3) {
      return 'critical';
    } else if (basePriority >= GameConfig.PRIORITIES.HIGH || taskCount >= 2) {
      return 'high';
    } else if (basePriority >= GameConfig.PRIORITIES.MEDIUM) {
      return 'normal';
    } else {
      return 'low';
    }
  }

  /**
   * 获取清理周期配置
   */
  public static getCleanupFrequency(type: keyof typeof TaskRoleMapping.TASK_CLEANUP_FREQUENCIES): number {
    return TaskRoleMapping.TASK_CLEANUP_FREQUENCIES[type];
  }

  /**
   * 获取清理配置
   */
  public static getCleanupConfig(type: keyof typeof TaskRoleMapping.TASK_CLEANUP_CONFIG): number {
    return TaskRoleMapping.TASK_CLEANUP_CONFIG[type];
  }

  /**
   * 检查是否应该执行清理
   */
  public static shouldPerformCleanup(
    lastCleanupTime: number,
    cleanupType: keyof typeof TaskRoleMapping.TASK_CLEANUP_FREQUENCIES
  ): boolean {
    const frequency = TaskRoleMapping.getCleanupFrequency(cleanupType);
    return Game.time - lastCleanupTime >= frequency;
  }

  /**
   * 检查任务是否过期
   */
  public static isTaskExpired(taskCreatedAt: number): boolean {
    const expirationTime = TaskRoleMapping.getCleanupConfig('TASK_EXPIRATION_TIME');
    return Game.time - taskCreatedAt > expirationTime;
  }

  /**
   * 检查任务执行是否超时
   */
  public static isTaskExecutionTimeout(taskStartedAt: number): boolean {
    const timeout = TaskRoleMapping.getCleanupConfig('TASK_EXECUTION_TIMEOUT');
    return Game.time - taskStartedAt > timeout;
  }
}
