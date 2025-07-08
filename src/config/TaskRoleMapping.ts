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
}
