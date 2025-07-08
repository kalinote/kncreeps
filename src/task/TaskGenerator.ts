import { TaskManager } from "../managers/TaskManager";
import { HarvestTask, TransportTask, UpgradeTask, BuildTask, AttackTask, TaskPriority, TaskType } from "../types";
import { SourceAnalyzer } from "../utils/SourceAnalyzer";

/**
 * 任务生成器 - 根据房间状态自动创建任务
 */
export class TaskGenerator {
  private taskManager: TaskManager;

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager;
  }

  /**
   * 为房间生成必要的任务
   */
  public generateTasksForRoom(room: Room): void {
    if (!this.taskManager.isSystemEnabled()) return;

    this.generateHarvestTasks(room);
    this.generateTransportTasks(room);
    this.generateBuildTasks(room);
    this.generateUpgradeTasks(room);
    this.generateAttackTasks(room);
    // 后续添加其他任务类型
  }

  private generateHarvestTasks(room: Room): void {
    const sources = room.find(FIND_SOURCES);
    const existingHarvestTasks = this.taskManager.getActiveTasks()
      .filter(task => task.type === TaskType.HARVEST && task.roomName === room.name);

    // 获取房间的source统计信息
    const sourceStats = SourceAnalyzer.getRoomSourceStats(room);

    console.log(`[TaskGenerator] 房间 ${room.name}: 找到 ${sourceStats.totalSources} 个源, 总共 ${sourceStats.totalHarvestPositions} 个可采集位置, 现有 ${existingHarvestTasks.length} 个活跃采集任务`);

    // 为每个source的每个可采集位置创建任务
    for (let sourceIndex = 0; sourceIndex < sourceStats.sourceDetails.length; sourceIndex++) {
      const sourceDetail = sourceStats.sourceDetails[sourceIndex];
      const source = sources[sourceIndex];

      // 为每个可采集位置创建任务
      for (let posIndex = 0; posIndex < sourceDetail.positions.length; posIndex++) {
        const harvestPosition = sourceDetail.positions[posIndex];

        // 检查是否已有针对此source和位置的任务
        const hasTask = existingHarvestTasks.some(task => {
          const harvestTask = task as HarvestTask;
          if (harvestTask.params.sourceId !== source.id) return false;

          // 如果没有指定harvestPosition，说明是旧版本的任务，需要检查
          if (!harvestTask.params.harvestPosition) return true;

          // 检查位置是否匹配
          return harvestTask.params.harvestPosition.x === harvestPosition.x &&
                 harvestTask.params.harvestPosition.y === harvestPosition.y &&
                 harvestTask.params.harvestPosition.roomName === harvestPosition.roomName;
        });

        if (!hasTask) {
          // 前两个source使用高优先级，其余使用低优先级
          const priority = sourceIndex < 2 ? TaskPriority.HIGH : TaskPriority.LOW;
          const taskId = this.taskManager.createTask({
            type: TaskType.HARVEST,
            priority: priority,
            roomName: room.name,
            maxRetries: 3,
            params: {
              sourceId: source.id,
              harvestPosition: {
                x: harvestPosition.x,
                y: harvestPosition.y,
                roomName: harvestPosition.roomName
              }
            }
          });
          console.log(`[TaskGenerator] 为源 ${source.id} 位置 (${harvestPosition.x}, ${harvestPosition.y}) 创建采集任务: ${taskId} (优先级: ${priority})`);
        } else {
          console.log(`[TaskGenerator] 源 ${source.id} 位置 (${harvestPosition.x}, ${harvestPosition.y}) 已有活跃任务，跳过创建`);
        }
      }
    }
  }

  private generateTransportTasks(room: Room): void {
    // 寻找地面上的掉落资源
    const droppedResources = room.find(FIND_DROPPED_RESOURCES, {
      filter: r => r.amount > 50 // 只处理数量较大的资源
    });

    const existingTransportTasks = this.taskManager.getActiveTasks()
      .filter(task => task.type === TaskType.TRANSPORT && task.roomName === room.name);

    console.log(`[TaskGenerator] 房间 ${room.name}: 找到 ${droppedResources.length} 个掉落资源, 现有 ${existingTransportTasks.length} 个活跃搬运任务`);

    for (const resource of droppedResources) {
      // 检查是否已有针对此位置的搬运任务
      const hasTask = existingTransportTasks.some(task => {
        const transportTask = task as TransportTask;
        return transportTask.params.sourcePos &&
               transportTask.params.sourcePos.x === resource.pos.x &&
               transportTask.params.sourcePos.y === resource.pos.y &&
               transportTask.params.resourceType === resource.resourceType;
      });

      if (!hasTask) {
        // 寻找合适的存储目标
        const storageTarget = this.findStorageTarget(room, resource.resourceType);

        if (storageTarget) {
          const taskId = this.taskManager.createTask({
            type: TaskType.TRANSPORT,
            priority: TaskPriority.NORMAL,
            roomName: room.name,
            maxRetries: 3,
            params: {
              sourcePos: { x: resource.pos.x, y: resource.pos.y, roomName: room.name },
              targetId: storageTarget.id,
              resourceType: resource.resourceType,
              amount: resource.amount
            }
          });
          console.log(`[TaskGenerator] 为掉落资源 ${resource.resourceType}(${resource.amount}) 创建搬运任务: ${taskId}`);
        } else {
          console.log(`[TaskGenerator] 找不到合适的存储目标，跳过资源 ${resource.resourceType}(${resource.amount})`);
        }
      } else {
        console.log(`[TaskGenerator] 位置 (${resource.pos.x}, ${resource.pos.y}) 的 ${resource.resourceType} 已有搬运任务，跳过创建`);
      }
    }
  }

  /**
   * 寻找合适的存储目标
   */
  private findStorageTarget(room: Room, resourceType: ResourceConstant): Structure | null {
    // 优先级1: Storage
    const storages = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_STORAGE &&
                   'store' in s && s.store && s.store.getFreeCapacity(resourceType) > 0
    });
    if (storages.length > 0) return storages[0];

    // 优先级2: Container
    const containers = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER &&
                   'store' in s && s.store && s.store.getFreeCapacity(resourceType) > 0
    });
    if (containers.length > 0) return containers[0];

    // 优先级3: 对于能量，可以存储到Extension或Spawn
    if (resourceType === RESOURCE_ENERGY) {
      const energyStructures = room.find(FIND_STRUCTURES, {
        filter: s => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
                     'store' in s && s.store && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      });
      if (energyStructures.length > 0) return energyStructures[0];
    }

    return null;
  }

  /**
   * 生成升级任务
   */
  private generateUpgradeTasks(room: Room): void {
    // 检查是否有控制器且属于我们
    if (!room.controller || !room.controller.my) {
      return;
    }

    const existingUpgradeTasks = this.taskManager.getActiveTasks()
      .filter(task => task.type === TaskType.UPGRADE && task.roomName === room.name);

    console.log(`[TaskGenerator] 房间 ${room.name}: 控制器等级 ${room.controller.level}, 现有 ${existingUpgradeTasks.length} 个活跃升级任务`);

    // 如果还没有升级任务，创建一个
    if (existingUpgradeTasks.length === 0) {
      const taskId = this.taskManager.createTask({
        type: TaskType.UPGRADE,
        priority: TaskPriority.NORMAL,
        roomName: room.name,
        maxRetries: 3,
        params: {
          controllerId: room.controller.id,
          sourceConstructionIds: [] // 从任意建筑获取能量
        }
      });
      console.log(`[TaskGenerator] 为控制器 ${room.controller.id} 创建升级任务: ${taskId}`);
    } else {
      console.log(`[TaskGenerator] 控制器 ${room.controller.id} 已有活跃任务，跳过创建`);
    }
  }

  /**
   * 生成建造任务
   */
  private generateBuildTasks(room: Room): void {
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
    const existingBuildTasks = this.taskManager.getActiveTasks()
      .filter(task => task.type === TaskType.BUILD && task.roomName === room.name);

    console.log(`[TaskGenerator] 房间 ${room.name}: 找到 ${constructionSites.length} 个建筑工地, 现有 ${existingBuildTasks.length} 个活跃建造任务`);

    // 为每个建筑工地创建建造任务（如果还没有）
    for (const site of constructionSites) {
      const hasTask = existingBuildTasks.some(task =>
        (task as BuildTask).params.targetId === site.id
      );

      if (!hasTask) {
        const taskId = this.taskManager.createTask({
          type: TaskType.BUILD,
          priority: TaskPriority.NORMAL,
          roomName: room.name,
          maxRetries: 3,
          params: {
            targetId: site.id,
            sourceConstructionIds: [] // 从任意建筑获取能量
          }
        });
        console.log(`[TaskGenerator] 为建筑工地 ${site.id} (${site.structureType}) 创建建造任务: ${taskId}`);
      } else {
        console.log(`[TaskGenerator] 建筑工地 ${site.id} 已有活跃任务，跳过创建`);
      }
    }
  }

  /**
   * 生成攻击任务
   */
  private generateAttackTasks(room: Room): void {
    // 查找敌对单位
    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);

    if (hostileCreeps.length === 0 && hostileStructures.length === 0) {
      return; // 没有敌对目标
    }

    const existingAttackTasks = this.taskManager.getActiveTasks()
      .filter(task => task.type === TaskType.ATTACK && task.roomName === room.name) as AttackTask[];

    console.log(`[TaskGenerator] 房间 ${room.name}: 发现 ${hostileCreeps.length} 个敌对creep, ${hostileStructures.length} 个敌对建筑, 现有 ${existingAttackTasks.length} 个活跃攻击任务`);

    // 为敌对creep创建攻击任务
    this.createAttackTasksForHostileCreeps(room, hostileCreeps, existingAttackTasks);

    // 为敌对建筑创建攻击任务
    this.createAttackTasksForHostileStructures(room, hostileStructures, existingAttackTasks);
  }

  /**
   * 为敌对creep创建攻击任务
   */
  private createAttackTasksForHostileCreeps(room: Room, hostileCreeps: Creep[], existingTasks: AttackTask[]): void {
    for (const hostile of hostileCreeps) {
      // 检查是否已有针对此目标的任务
      const hasExistingTask = existingTasks.some(task =>
        task.params.targetId === hostile.id
      );

      if (!hasExistingTask) {
        // 检查是否应该创建新的攻击任务
        if (this.shouldCreateAttackTask(room, hostile, existingTasks)) {
          const priority = this.calculateAttackTaskPriority(hostile);
          const taskId = this.taskManager.createTask({
            type: TaskType.ATTACK,
            priority: priority,
            roomName: room.name,
            maxRetries: 3,
            params: {
              targetId: hostile.id,
              targetType: 'creep',
              attackType: 'auto',
              maxRange: 3
            }
          });
          console.log(`[TaskGenerator] 为敌对creep ${hostile.name}(${hostile.owner.username}) 创建攻击任务: ${taskId} (优先级: ${priority})`);
        } else {
          console.log(`[TaskGenerator] 跳过为敌对creep ${hostile.name} 创建攻击任务 - 已有足够的攻击单位`);
        }
      } else {
        console.log(`[TaskGenerator] 敌对creep ${hostile.name} 已有攻击任务，跳过创建`);
      }
    }
  }

  /**
   * 为敌对建筑创建攻击任务
   */
  private createAttackTasksForHostileStructures(room: Room, hostileStructures: Structure[], existingTasks: AttackTask[]): void {
    for (const hostile of hostileStructures) {
      // 检查是否已有针对此目标的任务
      const hasExistingTask = existingTasks.some(task =>
        task.params.targetId === hostile.id
      );

      if (!hasExistingTask) {
        // 检查是否应该创建新的攻击任务
        if (this.shouldCreateAttackTask(room, hostile, existingTasks)) {
          const priority = this.calculateAttackTaskPriority(hostile);
          const taskId = this.taskManager.createTask({
            type: TaskType.ATTACK,
            priority: priority,
            roomName: room.name,
            maxRetries: 3,
            params: {
              targetId: hostile.id,
              targetType: 'structure',
              attackType: 'auto',
              maxRange: 3
            }
          });
          console.log(`[TaskGenerator] 为敌对建筑 ${hostile.structureType}(${hostile.id}) 创建攻击任务: ${taskId} (优先级: ${priority})`);
        } else {
          console.log(`[TaskGenerator] 跳过为敌对建筑 ${hostile.structureType} 创建攻击任务 - 已有足够的攻击单位`);
        }
      } else {
        console.log(`[TaskGenerator] 敌对建筑 ${hostile.structureType} 已有攻击任务，跳过创建`);
      }
    }
  }

  /**
   * 判断是否应该创建攻击任务
   */
  private shouldCreateAttackTask(room: Room, target: Creep | Structure, existingTasks: AttackTask[]): boolean {
    // 获取房间内我方的战斗单位数量
    const myFighters = this.getMyFightersInRoom(room);

    // 获取房间内敌对单位总数
    const totalHostiles = room.find(FIND_HOSTILE_CREEPS).length + room.find(FIND_HOSTILE_STRUCTURES).length;

    // 计算当前攻击任务数量
    const currentAttackTasks = existingTasks.length;

    // 防止创建过多攻击任务的策略：
    // 1. 如果攻击任务数量已经超过敌对单位数量，不创建新任务
    if (currentAttackTasks >= totalHostiles) {
      return false;
    }

    // 2. 如果我方战斗单位数量已经足够（至少1:1.5的比例），不创建新任务
    const maxFighters = Math.min(totalHostiles * 1.5, 5); // 最多5个战斗单位
    if (myFighters.length >= maxFighters) {
      return false;
    }

    // 3. 如果当前攻击任务数量已经超过我方战斗单位数量的2倍，不创建新任务
    if (currentAttackTasks >= myFighters.length * 2) {
      return false;
    }

    return true;
  }

  /**
   * 获取房间内我方的战斗单位
   */
  private getMyFightersInRoom(room: Room): Creep[] {
    return room.find(FIND_MY_CREEPS, {
      filter: creep => {
        const hasAttack = creep.getActiveBodyparts(ATTACK) > 0;
        const hasRangedAttack = creep.getActiveBodyparts(RANGED_ATTACK) > 0;
        return hasAttack || hasRangedAttack;
      }
    });
  }

  /**
   * 计算攻击任务的优先级
   */
  private calculateAttackTaskPriority(target: Creep | Structure): TaskPriority {
    let priority = TaskPriority.NORMAL;

    if (target instanceof Creep) {
      // 敌对creep优先级计算
      const attackParts = target.getActiveBodyparts(ATTACK);
      const rangedAttackParts = target.getActiveBodyparts(RANGED_ATTACK);
      const healParts = target.getActiveBodyparts(HEAL);
      const workParts = target.getActiveBodyparts(WORK);
      const claimParts = target.getActiveBodyparts(CLAIM);

      // 威胁评分
      const threatScore = attackParts * 10 + rangedAttackParts * 8 + healParts * 6 + workParts * 4 + claimParts * 12;

      if (threatScore >= 50) {
        priority = TaskPriority.CRITICAL;
      } else if (threatScore >= 30) {
        priority = TaskPriority.HIGH;
      } else if (threatScore >= 10) {
        priority = TaskPriority.NORMAL;
      } else {
        priority = TaskPriority.LOW;
      }
    } else {
      // 敌对建筑优先级计算
      switch (target.structureType) {
        case STRUCTURE_SPAWN:
          priority = TaskPriority.EMERGENCY;
          break;
        case STRUCTURE_TOWER:
          priority = TaskPriority.CRITICAL;
          break;
        case STRUCTURE_EXTENSION:
        case STRUCTURE_STORAGE:
        case STRUCTURE_TERMINAL:
          priority = TaskPriority.HIGH;
          break;
        default:
          priority = TaskPriority.NORMAL;
      }
    }

    return priority;
  }
}

