import { BaseService } from "./BaseService";
import { TaskStateService } from "./TaskStateService";
import { HarvestTask, TransportTask, UpgradeTask, BuildTask, AttackTask, TaskPriority, TaskType } from "../types";
import { SourceAnalyzer } from "../utils/SourceAnalyzer";

/**
 * 任务生成器服务 - 根据房间状态自动创建任务
 */
export class TaskGeneratorService extends BaseService {
  private get taskStateService(): TaskStateService {
    return this.serviceContainer.get('taskStateService');
  }

  /**
   * 为所有己方房间生成任务
   */
  public update(): void {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        this.generateTasksForRoom(room);
      }
    }
  }

  /**
   * 为指定房间生成必要的任务
   */
  public generateTasksForRoom(room: Room): void {
    this.generateHarvestTasks(room);
    this.generateTransportTasks(room);
    this.generateBuildTasks(room);
    this.generateUpgradeTasks(room);
    this.generateAttackTasks(room);
  }

  private generateHarvestTasks(room: Room): void {
    const sources = room.find(FIND_SOURCES);
    const existingHarvestTasks = this.taskStateService.getActiveTasks()
      .filter(task => task.type === TaskType.HARVEST && task.roomName === room.name);

    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
      const source = sources[sourceIndex];

      // 检查是否已经有针对这个source的任务（不考虑具体位置）
      const hasTask = existingHarvestTasks.some(task => {
        const harvestTask = task as HarvestTask;
        return harvestTask.params.sourceId === source.id;
      });

      if (!hasTask) {
        // 修复：所有source使用相同的优先级，确保公平分配
        const priority = TaskPriority.HIGH;

        // 根据source周围的实际可采集位置数量设置maxAssignees
        const maxWorkers = SourceAnalyzer.getHarvestPositionCount(source);

        this.taskStateService.createTask({
          type: TaskType.HARVEST,
          priority: priority,
          roomName: room.name,
          maxRetries: 3,
          maxAssignees: maxWorkers, // 根据实际可采集位置数量设置
          params: {
            sourceId: source.id
            // 不指定具体采集位置，让HarvestTaskExecutor动态分配
          }
        });
      }
    }
  }

  private generateTransportTasks(room: Room): void {
    // 搜索所有掉落资源，数量大于20的
    const droppedResources = room.find(FIND_DROPPED_RESOURCES, {
      filter: r => r.amount > 20
    });

    // 获取所有活跃的transport任务（包括PENDING、ASSIGNED、IN_PROGRESS）
    const existingTransportTasks = this.taskStateService.getActiveTasks()
      .filter(task => task.type === TaskType.TRANSPORT && task.roomName === room.name);

    for (const resource of droppedResources) {
      // 检查是否已经有针对这个具体资源的活跃任务
      const hasActiveTask = existingTransportTasks.some(task => {
        const transportTask = task as TransportTask;
        return transportTask.params.sourcePos &&
          transportTask.params.sourcePos.x === resource.pos.x &&
          transportTask.params.sourcePos.y === resource.pos.y &&
          transportTask.params.resourceType === resource.resourceType;
      });

      if (!hasActiveTask) {
        const storageTarget = this.findStorageTarget(room, resource.resourceType);

        if (storageTarget) {
          this.taskStateService.createTask({
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
        }
      }
    }
  }

  private findStorageTarget(room: Room, resourceType: ResourceConstant): Structure | null {
    // 1. 优先寻找有空间的storage
    const storages = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_STORAGE &&
        'store' in s && s.store && s.store.getFreeCapacity(resourceType) > 0
    });
    if (storages.length > 0) return storages[0];

    // 2. 寻找有空间的container
    const containers = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER &&
        'store' in s && s.store && s.store.getFreeCapacity(resourceType) > 0
    });
    if (containers.length > 0) return containers[0];

    // 3. 如果是能量，寻找有空间的extension或spawn
    if (resourceType === RESOURCE_ENERGY) {
      const energyStructures = room.find(FIND_STRUCTURES, {
        filter: s => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
          'store' in s && s.store && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      });
      if (energyStructures.length > 0) return energyStructures[0];
    }

    // 4. 备用策略：如果没有找到理想的存储目标，寻找任何可能的存储建筑
    // 这样可以确保transport任务能够被创建，即使存储建筑已满

    // 4.1 尝试任何storage（即使满了）
    const anyStorages = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_STORAGE && 'store' in s
    });
    if (anyStorages.length > 0) return anyStorages[0];

    // 4.2 尝试任何container（即使满了）
    const anyContainers = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER && 'store' in s
    });
    if (anyContainers.length > 0) return anyContainers[0];

    // 4.3 如果是能量，尝试任何能量建筑（即使满了）
    if (resourceType === RESOURCE_ENERGY) {
      const anyEnergyStructures = room.find(FIND_STRUCTURES, {
        filter: s => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
          'store' in s
      });
      if (anyEnergyStructures.length > 0) return anyEnergyStructures[0];
    }

    // 5. 最后的备用策略：如果连存储建筑都没有，至少要创建任务让creep清理资源
    // 返回spawn作为默认目标，让TransportTaskExecutor处理具体的放置逻辑
    const spawns = room.find(FIND_MY_SPAWNS);
    if (spawns.length > 0) return spawns[0];

    return null;
  }

  private generateUpgradeTasks(room: Room): void {
    if (!room.controller || !room.controller.my) {
      return;
    }

    const existingUpgradeTasks = this.taskStateService.getActiveTasks()
      .filter(task => task.type === TaskType.UPGRADE && task.roomName === room.name);

    if (existingUpgradeTasks.length === 0) {
      this.taskStateService.createTask({
        type: TaskType.UPGRADE,
        priority: TaskPriority.NORMAL,
        roomName: room.name,
        maxRetries: 3,
        params: {
          controllerId: room.controller.id,
          sourceConstructionIds: []
        }
      });
    }
  }

  private generateBuildTasks(room: Room): void {
    const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);

    const existingBuildTasks = this.taskStateService.getActiveTasks()
      .filter(task => task.type === TaskType.BUILD && task.roomName === room.name) as BuildTask[];

    for (const site of constructionSites) {
      const hasTask = existingBuildTasks.some(task => task.params.targetId === site.id);

      if (!hasTask) {
        this.taskStateService.createTask({
          type: TaskType.BUILD,
          priority: TaskPriority.NORMAL,
          roomName: room.name,
          maxRetries: 3,
          params: {
            targetId: site.id,
            sourceConstructionIds: []
          }
        });
      }
    }
  }

  private generateAttackTasks(room: Room): void {
    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);

    const existingAttackTasks = this.taskStateService.getActiveTasks()
      .filter(task => task.type === TaskType.ATTACK && task.roomName === room.name) as AttackTask[];

    this.createAttackTasksForHostileCreeps(room, hostileCreeps, existingAttackTasks);
    this.createAttackTasksForHostileStructures(room, hostileStructures, existingAttackTasks);
  }

  private createAttackTasksForHostileCreeps(room: Room, hostileCreeps: Creep[], existingTasks: AttackTask[]): void {
    for (const hostile of hostileCreeps) {
      if (this.shouldCreateAttackTask(room, hostile, existingTasks)) {
        this.taskStateService.createTask({
          type: TaskType.ATTACK,
          priority: this.calculateAttackTaskPriority(hostile),
          roomName: room.name,
          maxRetries: 1,
          params: {
            targetId: hostile.id,
            targetType: 'creep'
          }
        });
      }
    }
  }

  private createAttackTasksForHostileStructures(room: Room, hostileStructures: Structure[], existingTasks: AttackTask[]): void {
    for (const structure of hostileStructures) {
      if (this.shouldCreateAttackTask(room, structure, existingTasks)) {
        this.taskStateService.createTask({
          type: TaskType.ATTACK,
          priority: this.calculateAttackTaskPriority(structure),
          roomName: room.name,
          maxRetries: 1,
          params: {
            targetId: structure.id,
            targetType: 'structure'
          }
        });
      }
    }
  }

  private shouldCreateAttackTask(room: Room, target: Creep | Structure, existingTasks: AttackTask[]): boolean {
    return !existingTasks.some(task => task.params.targetId === target.id);
  }

  private calculateAttackTaskPriority(target: Creep | Structure): TaskPriority {
    if (target instanceof Creep) {
      if (target.getActiveBodyparts(ATTACK) > 0 || target.getActiveBodyparts(RANGED_ATTACK) > 0) {
        return TaskPriority.CRITICAL;
      }
      if (target.getActiveBodyparts(HEAL) > 0) {
        return TaskPriority.HIGH;
      }
    }
    return TaskPriority.NORMAL;
  }
}
