import { BaseTaskExecutor } from "./BaseTaskExecutor";
import { Task, TaskResult, AttackTask, CapabilityRequirement, TaskType } from "../../types";

/**
 * 攻击任务执行器
 */
export class AttackTaskExecutor extends BaseTaskExecutor {

  public canExecute(creep: Creep, task: Task): boolean {
    if (task.type !== TaskType.ATTACK) {
      return false;
    }

    // 检查creep是否具备攻击能力（至少有一种攻击方式）
    const hasRangedAttack = creep.getActiveBodyparts(RANGED_ATTACK) > 0;
    const hasMeleeAttack = creep.getActiveBodyparts(ATTACK) > 0;
    const hasMove = creep.getActiveBodyparts(MOVE) > 0;

    // 必须有移动能力和至少一种攻击能力
    return hasMove && (hasRangedAttack || hasMeleeAttack);
  }

  public execute(creep: Creep, task: Task): TaskResult {
    if (task.type !== TaskType.ATTACK) {
      return { success: false, completed: false, message: '任务类型不匹配' };
    }

    const attackTask = task as AttackTask;

    return this.safeExecute(() => {
      return this.executeAttack(creep, attackTask);
    }, `AttackTaskExecutor.execute(${creep.name})`);
  }

  public getRequiredCapabilities(): CapabilityRequirement[] {
    return [
      { bodyPart: MOVE, minCount: 1, weight: 5 },            // 移动必需
      { bodyPart: TOUGH, minCount: 0, weight: 3 }            // 防御加分（可选）
    ];
  }

  public getTaskTypeName(): string {
    return 'ATTACK';
  }

  /**
   * 重写能力评分计算，专门处理攻击能力
   */
  public calculateCapabilityScore(creep: Creep): number {
    let score = 0;
    let maxScore = 0;

    // 攻击能力评分 (60%)
    const rangedAttackCount = creep.getActiveBodyparts(RANGED_ATTACK);
    const meleeAttackCount = creep.getActiveBodyparts(ATTACK);

    if (rangedAttackCount > 0) {
      score += Math.min(rangedAttackCount, 3) * 10; // 远程攻击优先，最多3个部件
    }
    if (meleeAttackCount > 0) {
      score += Math.min(meleeAttackCount, 3) * 8;   // 近战攻击次优，最多3个部件
    }
    maxScore += 30; // 最大攻击评分

    // 移动能力评分 (25%)
    const moveCount = creep.getActiveBodyparts(MOVE);
    score += Math.min(moveCount / 2, 2) * 5; // 移动部件，每2个计1分
    maxScore += 10;

    // 防御能力评分 (15%)
    const toughCount = creep.getActiveBodyparts(TOUGH);
    score += Math.min(toughCount, 3) * 3;
    maxScore += 9;

    return maxScore > 0 ? score / maxScore : 0;
  }

  private executeAttack(creep: Creep, task: AttackTask): TaskResult {
    // 检查creep是否即将死亡
    if (this.isCreepDying(creep)) {
      return { success: true, completed: true, message: 'creep即将死亡，任务完成' };
    }

    // 获取攻击目标
    const target = this.getAttackTarget(task);
    if (!target) {
      return { success: true, completed: true, message: '目标不存在或已离开房间，任务完成' };
    }

    // 检查目标是否还在同一房间
    if (target.room.name !== task.roomName) {
      return { success: true, completed: true, message: '目标已离开房间，任务完成' };
    }

    // 执行攻击逻辑
    return this.performAttack(creep, target, task);
  }

  private getAttackTarget(task: AttackTask): Creep | Structure | null {
    if (task.params.targetType === 'creep') {
      return Game.getObjectById<Creep>(task.params.targetId as Id<Creep>);
    } else {
      return Game.getObjectById<Structure>(task.params.targetId as Id<Structure>);
    }
  }

  private performAttack(creep: Creep, target: Creep | Structure, task: AttackTask): TaskResult {
    const hasRangedAttack = creep.getActiveBodyparts(RANGED_ATTACK) > 0;
    const hasMeleeAttack = creep.getActiveBodyparts(ATTACK) > 0;

    // 根据攻击类型参数或自动选择攻击方式
    let attackType = task.params.attackType || 'auto';
    if (attackType === 'auto') {
      // 自动选择：优先远程攻击
      if (hasRangedAttack) {
        attackType = 'ranged';
      } else if (hasMeleeAttack) {
        attackType = 'melee';
      } else {
        return { success: false, completed: false, message: '无攻击能力' };
      }
    }

    // 执行对应的攻击
    if (attackType === 'ranged' && hasRangedAttack) {
      return this.executeRangedAttack(creep, target, task);
    } else if (attackType === 'melee' && hasMeleeAttack) {
      return this.executeMeleeAttack(creep, target, task);
    } else {
      return { success: false, completed: false, message: `无法执行${attackType}攻击` };
    }
  }

  private executeRangedAttack(creep: Creep, target: Creep | Structure, task: AttackTask): TaskResult {
    const maxRange = task.params.maxRange || 3;
    const distance = creep.pos.getRangeTo(target);

    // 如果距离过远，移动到攻击范围内
    if (distance > maxRange) {
      this.moveToTarget(creep, target);
      return { success: true, completed: false, message: '移动到攻击范围' };
    }

    // 执行远程攻击
    const attackResult = creep.rangedAttack(target);

    switch (attackResult) {
      case OK:
        // 检查目标是否被摧毁
        if (this.isTargetDestroyed(target)) {
          return { success: true, completed: true, message: '目标已被摧毁，任务完成' };
        }
        return { success: true, completed: false, message: '远程攻击成功' };

      case ERR_NOT_IN_RANGE:
        // 理论上不应该发生，因为已经检查了距离
        this.moveToTarget(creep, target);
        return { success: true, completed: false, message: '调整攻击位置' };

      case ERR_NO_BODYPART:
        return { success: false, completed: false, message: '无远程攻击部件' };

      default:
        return { success: false, completed: false, message: `远程攻击失败: ${attackResult}` };
    }
  }

  private executeMeleeAttack(creep: Creep, target: Creep | Structure, task: AttackTask): TaskResult {
    const distance = creep.pos.getRangeTo(target);

    // 如果距离过远，移动到攻击范围内
    if (distance > 1) {
      this.moveToTarget(creep, target);
      return { success: true, completed: false, message: '移动到近战范围' };
    }

    // 执行近战攻击
    const attackResult = creep.attack(target);

    switch (attackResult) {
      case OK:
        // 检查目标是否被摧毁
        if (this.isTargetDestroyed(target)) {
          return { success: true, completed: true, message: '目标已被摧毁，任务完成' };
        }
        return { success: true, completed: false, message: '近战攻击成功' };

      case ERR_NOT_IN_RANGE:
        // 理论上不应该发生，因为已经检查了距离
        this.moveToTarget(creep, target);
        return { success: true, completed: false, message: '调整攻击位置' };

      case ERR_NO_BODYPART:
        return { success: false, completed: false, message: '无近战攻击部件' };

      default:
        return { success: false, completed: false, message: `近战攻击失败: ${attackResult}` };
    }
  }

  private isTargetDestroyed(target: Creep | Structure): boolean {
    // 对于creep，检查是否还存在
    if (target instanceof Creep) {
      return !Game.getObjectById(target.id);
    }

    // 对于建筑，检查血量是否为0或不存在
    if (target instanceof Structure) {
      const structure = Game.getObjectById(target.id);
      return !structure || structure.hits <= 0;
    }

    return false;
  }

  /**
   * 计算攻击目标的优先级
   */
  public calculateTargetPriority(target: Creep | Structure): number {
    let priority = 0;

    if (target instanceof Creep) {
      // 敌对creep优先级计算
      priority += target.getActiveBodyparts(ATTACK) * 10;
      priority += target.getActiveBodyparts(RANGED_ATTACK) * 8;
      priority += target.getActiveBodyparts(HEAL) * 6;
      priority += target.getActiveBodyparts(WORK) * 4;
      priority += target.getActiveBodyparts(CLAIM) * 12;
    } else {
      // 敌对建筑优先级计算
      switch (target.structureType) {
        case STRUCTURE_SPAWN:
          priority += 100;
          break;
        case STRUCTURE_TOWER:
          priority += 80;
          break;
        case STRUCTURE_EXTENSION:
          priority += 60;
          break;
        case STRUCTURE_STORAGE:
          priority += 40;
          break;
        case STRUCTURE_TERMINAL:
          priority += 40;
          break;
        default:
          priority += 20;
      }
    }

    return priority;
  }
}
