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

    const sourceStats = SourceAnalyzer.getRoomSourceStats(sources);

    for (let sourceIndex = 0; sourceIndex < sourceStats.sourceDetails.length; sourceIndex++) {
      const sourceDetail = sourceStats.sourceDetails[sourceIndex];
      const source = sources[sourceIndex];

      for (let posIndex = 0; posIndex < sourceDetail.positions.length; posIndex++) {
        const harvestPosition = sourceDetail.positions[posIndex];

        const hasTask = existingHarvestTasks.some(task => {
          const harvestTask = task as HarvestTask;
          if (harvestTask.params.sourceId !== source.id) return false;

          if (!harvestTask.params.harvestPosition) return true;

          return harvestTask.params.harvestPosition.x === harvestPosition.x &&
            harvestTask.params.harvestPosition.y === harvestPosition.y &&
            harvestTask.params.harvestPosition.roomName === harvestPosition.roomName;
        });

        if (!hasTask) {
          const priority = sourceIndex < 2 ? TaskPriority.HIGH : TaskPriority.LOW;
          this.taskStateService.createTask({
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
        }
      }
    }
  }

  private generateTransportTasks(room: Room): void {
    const droppedResources = room.find(FIND_DROPPED_RESOURCES, {
      filter: r => r.amount > 50
    });

    const existingTransportTasks = this.taskStateService.getActiveTasks()
      .filter(task => task.type === TaskType.TRANSPORT && task.roomName === room.name);

    for (const resource of droppedResources) {
      const hasTask = existingTransportTasks.some(task => {
        const transportTask = task as TransportTask;
        return transportTask.params.sourcePos &&
          transportTask.params.sourcePos.x === resource.pos.x &&
          transportTask.params.sourcePos.y === resource.pos.y &&
          transportTask.params.resourceType === resource.resourceType;
      });

      if (!hasTask) {
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
    // ... (logic from TaskGenerator)
    const storages = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_STORAGE &&
          'store' in s && s.store && s.store.getFreeCapacity(resourceType) > 0
      });
      if (storages.length > 0) return storages[0];

      const containers = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER &&
          'store' in s && s.store && s.store.getFreeCapacity(resourceType) > 0
      });
      if (containers.length > 0) return containers[0];

      if (resourceType === RESOURCE_ENERGY) {
        const energyStructures = room.find(FIND_STRUCTURES, {
          filter: s => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
            'store' in s && s.store && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (energyStructures.length > 0) return energyStructures[0];
      }

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
        // ... (logic from TaskGenerator)
        return !existingTasks.some(task => task.params.targetId === target.id);
    }

    private calculateAttackTaskPriority(target: Creep | Structure): TaskPriority {
        // ... (logic from TaskGenerator)
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
