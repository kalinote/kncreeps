import { GameConfig } from "../config/GameConfig";
import { RoleTemplate, ScalingRule } from "../types";

/**
 * 身体构建工具类 - 用于生成最优的creep身体配置
 */
export class BodyBuilder {
  /**
   * 根据角色和可用能量生成最优身体配置
   */
  public static generateOptimalBody(
    role: string,
    availableEnergy: number,
    maxBodySize: number = GameConfig.THRESHOLDS.MAX_CREEP_BODY_SIZE,
    room?: Room
  ): BodyPartConstant[] {
    // 检查是否处于开局阶段
    if (room && GameConfig.isBootstrapPhase(room)) {
      const bootstrapConfig = GameConfig.getBootstrapConfig(role);
      if (bootstrapConfig && availableEnergy >= bootstrapConfig.cost) {
        console.log(`[BodyBuilder] 使用开局最小配置: ${role} = ${JSON.stringify(bootstrapConfig.body)}`);
        return [...bootstrapConfig.body];
      }
    }

    const template = this.getRoleTemplate(role);
    if (!template) {
      console.log(`未找到角色 ${role} 的模板`);
      return [WORK, CARRY, MOVE]; // 默认配置
    }

    // 如果能量不足以生成最小配置，返回最小配置
    const minCost = this.getBodyCost(template.minConfig);
    if (availableEnergy < minCost) {
      return template.minConfig;
    }

    // 从最小配置开始构建
    let body = [...template.minConfig];
    let remainingEnergy = availableEnergy - minCost;

    // 应用扩展规则
    body = this.applyScalingRules(body, remainingEnergy, template.scalingRules, maxBodySize);

    // 验证身体配置
    if (!GameConfig.isValidBody(body)) {
      console.log(`生成的身体配置无效，回退到最小配置`);
      return template.minConfig;
    }

    return body;
  }

  /**
   * 应用扩展规则
   */
  private static applyScalingRules(
    baseBody: BodyPartConstant[],
    remainingEnergy: number,
    scalingRules: ScalingRule[],
    maxBodySize: number
  ): BodyPartConstant[] {
    const body = [...baseBody];
    const partCounts = this.getPartCounts(body);

    // 按优先级排序扩展规则
    const sortedRules = [...scalingRules].sort((a, b) => b.priority - a.priority);

    let energy = remainingEnergy;
    let iterations = 0;
    const maxIterations = 100; // 防止无限循环

    while (energy > 0 && body.length < maxBodySize && iterations < maxIterations) {
      let anyPartAdded = false;
      iterations++;

      for (const rule of sortedRules) {
        const partCost = GameConfig.BODY_PART_COSTS[rule.part];

        // 检查是否有足够能量
        if (energy < partCost) {
          continue;
        }

        // 检查是否达到最大数量限制
        if (rule.maxCount && partCounts[rule.part] >= rule.maxCount) {
          continue;
        }

        // 检查是否符合比例限制
        if (rule.ratio && !this.checkRatioConstraint(body, rule.part, rule.ratio)) {
          continue;
        }

        // 添加部件
        body.push(rule.part);
        partCounts[rule.part] = (partCounts[rule.part] || 0) + 1;
        energy -= partCost;
        anyPartAdded = true;
        break;
      }

      // 如果没有添加任何部件，退出循环
      if (!anyPartAdded) {
        break;
      }
    }

    return body;
  }

  /**
   * 检查比例约束
   */
  private static checkRatioConstraint(
    body: BodyPartConstant[],
    part: BodyPartConstant,
    targetRatio: number
  ): boolean {
    const currentCount = body.filter(p => p === part).length;
    const newCount = currentCount + 1;
    const totalParts = body.length + 1;

    return (newCount / totalParts) <= targetRatio;
  }

  /**
   * 获取部件数量统计
   */
  private static getPartCounts(body: BodyPartConstant[]): { [part: string]: number } {
    const counts: { [part: string]: number } = {};

    for (const part of body) {
      counts[part] = (counts[part] || 0) + 1;
    }

    return counts;
  }

  /**
   * 获取角色模板
   */
  private static getRoleTemplate(role: string): RoleTemplate | undefined {
    const templates: { [role: string]: RoleTemplate } = {
      [GameConfig.ROLES.WORKER]: {
        name: GameConfig.ROLES.WORKER,
        minConfig: [WORK, CARRY, MOVE],
        standardConfig: [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
        maxConfig: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
        scalingRules: [
          { priority: 1, part: WORK, maxCount: 5 },
          { priority: 2, part: CARRY, maxCount: 3 },
          { priority: 3, part: MOVE, ratio: 0.5 }
        ]
      },
      [GameConfig.ROLES.TRANSPORTER]: {
        name: GameConfig.ROLES.TRANSPORTER,
        minConfig: [CARRY, MOVE],
        standardConfig: [CARRY, CARRY, MOVE, MOVE],
        maxConfig: [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
        scalingRules: [
          { priority: 1, part: CARRY, maxCount: 8 },
          { priority: 2, part: MOVE, ratio: 0.5 }
        ]
      },
      [GameConfig.ROLES.SHOOTER]: {
        name: GameConfig.ROLES.SHOOTER,
        minConfig: [MOVE, TOUGH, RANGED_ATTACK],
        standardConfig: [MOVE, MOVE, TOUGH, TOUGH, RANGED_ATTACK, RANGED_ATTACK],
        maxConfig: [MOVE, MOVE, MOVE, MOVE, TOUGH, TOUGH, TOUGH, TOUGH, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, HEAL],
        scalingRules: [
          { priority: 1, part: RANGED_ATTACK, maxCount: 5 },
          { priority: 2, part: TOUGH, maxCount: 8 },
          { priority: 3, part: MOVE, ratio: 0.5 },
          { priority: 4, part: HEAL, maxCount: 2 }
        ]
      }
    };

    return templates[role];
  }

  /**
   * 计算身体配置成本
   */
  public static getBodyCost(body: BodyPartConstant[]): number {
    return body.reduce((cost, part) => cost + GameConfig.BODY_PART_COSTS[part], 0);
  }

  /**
   * 验证身体配置是否有效
   */
  public static isValidBody(body: BodyPartConstant[]): boolean {
    if (body.length === 0 || body.length > GameConfig.THRESHOLDS.MAX_CREEP_BODY_SIZE) {
      return false;
    }

    // 检查是否有移动部件
    if (!body.includes(MOVE)) {
      return false;
    }

    return true;
  }

  /**
   * 获取身体配置的效率评分
   */
  public static getBodyEfficiency(body: BodyPartConstant[], role: string): number {
    const cost = this.getBodyCost(body);
    const lifespan = GameConfig.SYSTEM.CREEP_LIFETIME;

    switch (role) {
      case GameConfig.ROLES.WORKER:
        const workParts = body.filter(p => p === WORK).length;
        const carryParts = body.filter(p => p === CARRY).length;
        const moveParts = body.filter(p => p === MOVE).length;

        // 工作者可以执行多种任务，综合评估效率
        const workRate = workParts * 2; // 每tick每个WORK部件产出2能量
        const buildRate = workParts * 5; // 每tick每个WORK部件建造5点
        const capacity = carryParts * 50;
        const mobility = moveParts / body.length;

        // 综合效率：工作能力 + 建造能力 + 运输能力 + 机动性
        const workerEfficiency = (workRate + buildRate + capacity * mobility) * lifespan;
        return workerEfficiency / cost;

      case GameConfig.ROLES.TRANSPORTER:
        const transporterCarryParts = body.filter(p => p === CARRY).length;
        const transporterMoveParts = body.filter(p => p === MOVE).length;
        const transporterCapacity = transporterCarryParts * 50;
        const transporterMobility = transporterMoveParts / body.length;
        return (transporterCapacity * transporterMobility * lifespan) / cost;

      case GameConfig.ROLES.SHOOTER:
        const attackParts = body.filter(p => p === RANGED_ATTACK).length;
        const toughParts = body.filter(p => p === TOUGH).length;
        const healParts = body.filter(p => p === HEAL).length;
        const shooterMoveParts = body.filter(p => p === MOVE).length;

        const attackPower = attackParts * 10; // 每个RANGED_ATTACK部件10攻击力
        const durability = toughParts * 100; // 每个TOUGH部件100血量
        const healPower = healParts * 12; // 每个HEAL部件12治疗力
        const shooterMobility = shooterMoveParts / body.length;

        // 综合战斗效率：攻击力 + 耐久性 + 治疗力 + 机动性
        const combatEfficiency = (attackPower + durability * 0.1 + healPower + shooterMobility * 100) * lifespan;
        return combatEfficiency / cost;

      default:
        return 1;
    }
  }

  /**
   * 比较两个身体配置的效率
   */
  public static compareBodyEfficiency(
    body1: BodyPartConstant[],
    body2: BodyPartConstant[],
    role: string
  ): number {
    const efficiency1 = this.getBodyEfficiency(body1, role);
    const efficiency2 = this.getBodyEfficiency(body2, role);

    return efficiency1 - efficiency2;
  }

  /**
   * 获取推荐的身体配置
   */
  public static getRecommendedBody(
    role: string,
    availableEnergy: number,
    roomEnergyCapacity: number
  ): BodyPartConstant[] {
    // 根据房间能量容量调整目标预算
    const targetBudget = Math.min(availableEnergy, roomEnergyCapacity * GameConfig.THRESHOLDS.BODY_BUDGET_RATIO);

    return this.generateOptimalBody(role, targetBudget);
  }
}
