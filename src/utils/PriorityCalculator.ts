import { Task, TaskPriority } from '../types';

/**
 * 动态优先级计算配置
 * 这些系数可以根据实际需求进行调整
 */
const DYNAMIC_PRIORITY_CONFIG = {
  /**
   * 时间老化因子(对数老化), k1
   * 值越大，低优先级任务的优先级提升越快。建议范围: 0.2 ~ 0.5
   */
  AGING_FACTOR: 0.3,

  /**
   * 饱和衰减因子(线性衰减), k2
   * 值越大，已分配部分人员的共享任务的优先级衰减越快。建议范围: 0.8 ~ 1.0
   */
  SATURATION_FACTOR: 1
};

/**
 * 动态优先级计算工具
 * 用于根据任务的多个维度（基础优先级、等待时间、已分配资源）计算出一个动态的有效优先级。
 */
export class PriorityCalculator {
  /**
   * 计算任务的有效优先级 (effective priority)
   * P_eff = P_base * (1 + Aging(t)) * Saturation(n)
   * @param task 任务对象
   * @param currentTick 当前 Game.time
   * @returns 任务的有效优先级
   */
  public static calculate(task: Task, currentTick: number): number {
    const baseWeight = this.getBaseWeight(task.basePriority);
    const ageBoost = this.agingLog(currentTick - task.createdAt);
    const saturation = this.saturationLinear(task.assignedCreeps.length, task.maxAssignees);

    // 对于已分配的独占任务或已饱和的共享任务，其饱和度为0，有效优先级直接降为0，不再参与竞争
    if (saturation <= 0) {
      return 0;
    }

    const effectivePriority = baseWeight * (1 + ageBoost) * saturation;
    return effectivePriority;
  }

  /**
   * 获取任务基础优先级的权重映射
   * @param priority 任务的基础优先级枚举
   * @returns 基础权重
   */
  private static getBaseWeight(priority: TaskPriority): number {
    // 将TaskPriority的10-100范围映射到1-10的范围，以便于和其他因子相乘
    switch (priority) {
      case TaskPriority.EMERGENCY: return 10;
      case TaskPriority.CRITICAL: return 8;
      case TaskPriority.HIGH: return 6;
      case TaskPriority.NORMAL: return 4;
      case TaskPriority.LOW: return 2;
      case TaskPriority.BACKGROUND: return 1;
      default: return 4; // 默认为普通优先级
    }
  }

  /**
   * 时间老化函数 - 对数老化
   * 效果：初期增长快，后期放缓，避免等待时间过长导致优先级无限膨胀。
   * @param ticksWaiting 任务等待的 tick 数量
   * @param k1 老化系数
   * @returns 时间老化带来的优先级增益
   */
  private static agingLog(ticksWaiting: number, k1 = DYNAMIC_PRIORITY_CONFIG.AGING_FACTOR): number {
    // 使用 log1p (Math.log(1+x)) 来处理 t=0 的情况，并确保输入为正
    return k1 * Math.log1p(Math.max(0, ticksWaiting));
  }

  /**
   * 人手饱和衰减函数 - 线性衰减
   * 效果：已分配的 creep 越多，新分配的价值越低，从而降低其竞争力。
   * @param nAssigned 已分配的 creep 数量
   * @param nMax 任务最大可分配数量
   * @param k2 衰减系数
   * @returns 饱和度因子 (0到1之间)
   */
  private static saturationLinear(nAssigned: number, nMax: number, k2 = DYNAMIC_PRIORITY_CONFIG.SATURATION_FACTOR): number {
    if (nMax <= 0) return 1; // 对于没有限制的任务（虽然理论上不应该），不进行衰减
    if (nAssigned >= nMax) return 0; // 如果已经达到或超过最大分配数，饱和度为0

    const ratio = nAssigned / nMax;
    // 使用 k2 调节衰减的剧烈程度，并确保结果不为负
    return Math.max(0, 1 - k2 * ratio);
  }
}
