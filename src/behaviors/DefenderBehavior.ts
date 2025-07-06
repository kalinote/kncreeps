import { BaseBehavior, BehaviorResult, EnergySourceStrategy, EnergySourceConfig } from "./BaseBehavior";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";

/**
 * 防御者行为状态
 */
enum DefenderState {
  IDLE = "idle",
  PATROLLING = "patrolling",
  ENGAGING = "engaging",
  RETREATING = "retreating",
  HEALING = "healing"
}

export class DefenderBehavior extends BaseBehavior {
  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  public run(creep: Creep): BehaviorResult {
    return this.safeExecute(() => {
      // 初始化defender状态
      if (!creep.memory.state) {
        creep.memory.state = DefenderState.IDLE;
      }

      // 初始化defender内存
      this.initializeDefenderMemory(creep);

      // 更新敌人记忆（清理过期的敌人信息）
      this.updateEnemyMemory(creep);

      // 根据当前状态执行对应行为
      const state = creep.memory.state as DefenderState;

      switch (state) {
        case DefenderState.IDLE:
          return this.decideNextAction(creep);

        case DefenderState.PATROLLING:
          return this.handlePatrolling(creep);

        case DefenderState.ENGAGING:
          return this.handleEngaging(creep);

        case DefenderState.RETREATING:
          return this.handleRetreating(creep);

        case DefenderState.HEALING:
          return this.handleHealing(creep);

        default:
          creep.memory.state = DefenderState.IDLE;
          return this.decideNextAction(creep);
      }
    }, `DefenderBehavior.run(${creep.name})`);
  }

  /**
   * 决定下一步行动
   */
  private decideNextAction(creep: Creep): BehaviorResult {
    // 检查是否需要治疗
    if (this.shouldHeal(creep)) {
      creep.memory.state = DefenderState.HEALING;
      return this.handleHealing(creep);
    }

    // 检查是否发现敌人
    const enemies = this.findEnemies(creep);
    if (enemies.length > 0) {
      const bestTarget = this.selectBestTarget(creep, enemies);
      if (bestTarget) {
        creep.memory.target = bestTarget.id;
        creep.memory.state = DefenderState.ENGAGING;
        creep.memory.lastEnemySeen = Game.time;

        // 记录敌人到内存
        if (creep.memory.enemyMemory) {
          creep.memory.enemyMemory[bestTarget.id] = Game.time;
        }

        // 触发发现敌人事件
        this.eventBus.emit(GameConfig.EVENTS.ENEMY_SPOTTED, {
          defenderName: creep.name,
          enemyName: bestTarget.name,
          roomName: creep.room.name,
          enemyOwner: bestTarget.owner.username
        });

        return {
          success: true,
          message: `发现敌人: ${bestTarget.name}，开始交战`,
          nextState: DefenderState.ENGAGING
        };
      }
    }

    // 默认进入巡逻状态
    creep.memory.state = DefenderState.PATROLLING;
    return this.handlePatrolling(creep);
  }

  /**
   * 初始化防御者内存
   */
  private initializeDefenderMemory(creep: Creep): void {
    if (!creep.memory.enemyMemory) {
      creep.memory.enemyMemory = {};
    }
    if (!creep.memory.patrolPoint) {
      // 设置默认巡逻点为房间中心
      creep.memory.patrolPoint = {
        x: 25,
        y: 25,
        roomName: creep.room.name
      };
    }
  }

  /**
   * 更新敌人记忆，清理过期信息
   */
  private updateEnemyMemory(creep: Creep): void {
    if (!creep.memory.enemyMemory) return;

    const currentTime = Game.time;
    const memoryDuration = GameConfig.THRESHOLDS.ENEMY_MEMORY_DURATION;

    // 清理过期的敌人记忆
    for (const enemyId in creep.memory.enemyMemory) {
      if (currentTime - creep.memory.enemyMemory[enemyId] > memoryDuration) {
        delete creep.memory.enemyMemory[enemyId];
      }
    }
  }

  /**
   * 处理巡逻状态
   */
  private handlePatrolling(creep: Creep): BehaviorResult {
    // 检查是否发现敌人
    const enemies = this.findEnemies(creep);
    if (enemies.length > 0) {
      const bestTarget = this.selectBestTarget(creep, enemies);
      if (bestTarget) {
        creep.memory.target = bestTarget.id;
        creep.memory.state = DefenderState.ENGAGING;
        creep.memory.lastEnemySeen = Game.time;

        // 记录敌人到内存
        if (creep.memory.enemyMemory) {
          creep.memory.enemyMemory[bestTarget.id] = Game.time;
        }

        // 触发发现敌人事件
        this.eventBus.emit(GameConfig.EVENTS.ENEMY_SPOTTED, {
          defenderName: creep.name,
          enemyName: bestTarget.name,
          roomName: creep.room.name,
          enemyOwner: bestTarget.owner.username
        });

        return {
          success: true,
          message: `发现敌人: ${bestTarget.name}，开始交战`,
          nextState: DefenderState.ENGAGING
        };
      }
    }

    // 检查血量，如果受伤且有治疗部件则进入治疗模式
    if (this.shouldHeal(creep)) {
      creep.memory.state = DefenderState.HEALING;
      return this.handleHealing(creep);
    }

    // 继续巡逻
    return this.performPatrol(creep);
  }

  /**
   * 处理交战状态
   */
  private handleEngaging(creep: Creep): BehaviorResult {
    // 检查血量，如果过低则撤退
    if (this.shouldRetreat(creep)) {
      creep.memory.state = DefenderState.RETREATING;
      return this.handleRetreating(creep);
    }

    // 检查目标是否仍然存在
    const target = Game.getObjectById(creep.memory.target as Id<Creep>);
    if (!target || target.room.name !== creep.room.name) {
      // 目标消失，重新寻找敌人
      const enemies = this.findEnemies(creep);
      if (enemies.length > 0) {
        const newTarget = this.selectBestTarget(creep, enemies);
        if (newTarget) {
          creep.memory.target = newTarget.id;
          return this.attackTarget(creep, newTarget);
        }
      }

      // 没有敌人，回到巡逻状态
      creep.memory.state = DefenderState.PATROLLING;
      creep.memory.target = undefined;

      // 触发战斗结束事件
      this.eventBus.emit(GameConfig.EVENTS.COMBAT_ENDED, {
        defenderName: creep.name,
        roomName: creep.room.name,
        result: 'target_lost'
      });

      return {
        success: true,
        message: '目标消失，恢复巡逻',
        nextState: DefenderState.PATROLLING
      };
    }

    // 攻击目标
    return this.attackTarget(creep, target);
  }

  /**
   * 处理撤退状态
   */
  private handleRetreating(creep: Creep): BehaviorResult {
    // 触发撤退事件
    this.eventBus.emit(GameConfig.EVENTS.DEFENDER_RETREATING, {
      defenderName: creep.name,
      roomName: creep.room.name,
      currentHealth: creep.hits,
      maxHealth: creep.hitsMax
    });

    // 移动到安全位置（房间边缘或spawn附近）
    const safePos = this.findSafePosition(creep);
    if (safePos) {
      const moveResult = creep.moveTo(safePos, {
        visualizePathStyle: { stroke: '#ffaa00' }
      });

      if (moveResult === OK) {
        // 到达安全位置，如果有治疗部件则开始治疗
        if (creep.getActiveBodyparts(HEAL) > 0) {
          creep.memory.state = DefenderState.HEALING;
          return {
            success: true,
            message: '到达安全位置，开始治疗',
            nextState: DefenderState.HEALING
          };
        } else {
          // 没有治疗部件，等待自然恢复或等待支援
          creep.memory.state = DefenderState.PATROLLING;
          return {
            success: true,
            message: '撤退到安全位置',
            nextState: DefenderState.PATROLLING
          };
        }
      } else {
        return {
          success: true,
          message: '正在撤退中...'
        };
      }
    }

    return {
      success: false,
      message: '无法找到安全位置'
    };
  }

  /**
   * 处理治疗状态
   */
  private handleHealing(creep: Creep): BehaviorResult {
    // 检查是否有治疗部件
    if (creep.getActiveBodyparts(HEAL) === 0) {
      creep.memory.state = DefenderState.PATROLLING;
      return {
        success: false,
        message: '没有治疗部件，无法治疗',
        nextState: DefenderState.PATROLLING
      };
    }

    // 如果血量已满，恢复巡逻
    if (creep.hits >= creep.hitsMax) {
      creep.memory.state = DefenderState.PATROLLING;
      return {
        success: true,
        message: '治疗完成，恢复巡逻',
        nextState: DefenderState.PATROLLING
      };
    }

    // 自我治疗
    const healResult = creep.heal(creep);
    if (healResult === OK) {
      return {
        success: true,
        message: `正在治疗，血量: ${creep.hits}/${creep.hitsMax}`
      };
    } else {
      return {
        success: false,
        message: `治疗失败: ${healResult}`
      };
    }
  }

  /**
   * 执行巡逻
   */
  private performPatrol(creep: Creep): BehaviorResult {
    const patrolPoint = creep.memory.patrolPoint;
    if (!patrolPoint) {
      return {
        success: false,
        message: '没有设置巡逻点'
      };
    }

    const targetPos = new RoomPosition(patrolPoint.x, patrolPoint.y, patrolPoint.roomName);

    // 如果距离巡逻点较远，移动过去
    if (creep.pos.getRangeTo(targetPos) > GameConfig.THRESHOLDS.DEFENDER_PATROL_RANGE) {
      const moveResult = creep.moveTo(targetPos, {
        visualizePathStyle: { stroke: '#00ff00' }
      });

      if (moveResult === OK) {
        return {
          success: true,
          message: '正在前往巡逻点'
        };
      } else {
        return {
          success: false,
          message: `移动到巡逻点失败: ${moveResult}`
        };
      }
    } else {
      // 在巡逻区域内随机移动
      const randomX = Math.floor(Math.random() * 5) - 2;
      const randomY = Math.floor(Math.random() * 5) - 2;
      const randomPos = new RoomPosition(
        Math.max(1, Math.min(48, targetPos.x + randomX)),
        Math.max(1, Math.min(48, targetPos.y + randomY)),
        targetPos.roomName
      );

      creep.moveTo(randomPos, {
        visualizePathStyle: { stroke: '#00ff00' }
      });

      return {
        success: true,
        message: '巡逻中...'
      };
    }
  }

  /**
   * 攻击目标
   */
  private attackTarget(creep: Creep, target: Creep): BehaviorResult {
    const range = creep.pos.getRangeTo(target);

    // 远程攻击
    if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
      if (range <= 3) {
        const attackResult = creep.rangedAttack(target);
        if (attackResult === OK) {
          // 触发交战事件
          this.eventBus.emit(GameConfig.EVENTS.DEFENDER_ENGAGED, {
            defenderName: creep.name,
            targetName: target.name,
            roomName: creep.room.name,
            attackType: 'ranged'
          });

          return {
            success: true,
            message: `远程攻击 ${target.name}`
          };
        }
      } else {
        // 移动到攻击范围内
        const moveResult = creep.moveTo(target, {
          visualizePathStyle: { stroke: '#ff0000' }
        });

        return {
          success: moveResult === OK,
          message: moveResult === OK ? '正在接近目标' : `移动失败: ${moveResult}`
        };
      }
    }

    // 近身攻击（作为备选）
    if (creep.getActiveBodyparts(ATTACK) > 0 && range <= 1) {
      const attackResult = creep.attack(target);
      if (attackResult === OK) {
        this.eventBus.emit(GameConfig.EVENTS.DEFENDER_ENGAGED, {
          defenderName: creep.name,
          targetName: target.name,
          roomName: creep.room.name,
          attackType: 'melee'
        });

        return {
          success: true,
          message: `近身攻击 ${target.name}`
        };
      }
    }

    return {
      success: false,
      message: '无法攻击目标'
    };
  }

  /**
   * 寻找房间内的敌人
   */
  private findEnemies(creep: Creep): Creep[] {
    return creep.room.find(FIND_HOSTILE_CREEPS);
  }

  /**
   * 选择最佳攻击目标
   */
  private selectBestTarget(creep: Creep, enemies: Creep[]): Creep | null {
    if (enemies.length === 0) return null;

    // 按威胁等级排序
    const sortedEnemies = enemies.sort((a, b) => {
      const threatA = this.calculateThreatLevel(creep, a);
      const threatB = this.calculateThreatLevel(creep, b);
      return threatB - threatA;
    });

    return sortedEnemies[0];
  }

  /**
   * 计算敌人威胁等级
   */
  private calculateThreatLevel(creep: Creep, enemy: Creep): number {
    let threat = 0;

    // 基础威胁值
    threat += enemy.getActiveBodyparts(ATTACK) * 30;
    threat += enemy.getActiveBodyparts(RANGED_ATTACK) * 25;
    threat += enemy.getActiveBodyparts(WORK) * 5; // 可能破坏建筑

    // 距离因子（距离越近威胁越高）
    const distance = creep.pos.getRangeTo(enemy);
    threat += Math.max(0, 20 - distance);

    // 血量因子（血量低的优先击杀）
    const healthPercent = enemy.hits / enemy.hitsMax;
    threat += (1 - healthPercent) * 10;

    return threat;
  }

  /**
   * 检查是否应该撤退
   */
  private shouldRetreat(creep: Creep): boolean {
    const healthPercent = creep.hits / creep.hitsMax;
    return healthPercent < GameConfig.THRESHOLDS.DEFENDER_RETREAT_HEALTH;
  }

  /**
   * 检查是否应该治疗
   */
  private shouldHeal(creep: Creep): boolean {
    return creep.hits < creep.hitsMax &&
      creep.getActiveBodyparts(HEAL) > 0 &&
      creep.memory.state !== DefenderState.ENGAGING;
  }

  /**
   * 寻找安全位置
   */
  private findSafePosition(creep: Creep): RoomPosition | null {
    // 优先寻找spawn附近的位置
    const spawns = creep.room.find(FIND_MY_SPAWNS);
    if (spawns.length > 0) {
      const spawn = spawns[0];
      const positions = [
        new RoomPosition(spawn.pos.x - 1, spawn.pos.y, spawn.pos.roomName),
        new RoomPosition(spawn.pos.x + 1, spawn.pos.y, spawn.pos.roomName),
        new RoomPosition(spawn.pos.x, spawn.pos.y - 1, spawn.pos.roomName),
        new RoomPosition(spawn.pos.x, spawn.pos.y + 1, spawn.pos.roomName)
      ];

      for (const pos of positions) {
        if (pos.x >= 0 && pos.x <= 49 && pos.y >= 0 && pos.y <= 49 &&
          creep.room.lookAt(pos).filter(obj => obj.type === 'creep').length === 0) {
          return pos;
        }
      }
    }

    // 如果spawn附近没有安全位置，移动到房间边缘
    return new RoomPosition(2, 2, creep.room.name);
  }

  public canExecute(creep: Creep): boolean {
    return creep.memory.role === GameConfig.ROLES.DEFENDER;
  }

  public getPriority(): number {
    return GameConfig.PRIORITIES.HIGH; // 防御有较高优先级
  }

  public getName(): string {
    return 'DefenderBehavior';
  }

  /**
   * 获取角色名称
   */
  protected getRoleName(): string {
    return GameConfig.ROLES.DEFENDER;
  }

  /**
   * 获取能量源配置 - 防御者通常不需要获取能量
   */
  protected getEnergySourceConfig(): EnergySourceConfig {
    return {
      strategy: EnergySourceStrategy.STORAGE_ONLY,
      allowStorage: false,
      allowContainers: false,
      allowSpawn: false,
      allowExtensions: false,
      allowDroppedResources: false,
      allowDirectHarvest: false,
      minEnergyThreshold: 0
    };
  }
}
