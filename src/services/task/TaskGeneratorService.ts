import { BaseService } from "../BaseService";
import { HarvestTask, TransportTask, UpgradeTask, BuildTask, AttackTask, TaskPriority, TaskType, TaskGeneratorServiceMemory, TaskManagerMemory } from "../../types";
import { EventBus } from "../../core/EventBus";
import { TaskManager } from "../../managers/TaskManager";
import { SourceAnalyzer } from "../../utils/SourceAnalyzer";

/**
 * 任务生成器服务 - 根据房间状态自动创建任务
 */
export class TaskGeneratorService extends BaseService<TaskGeneratorServiceMemory, TaskManager> {
  protected onCleanup(): void {}
  protected onReset(): void {}

  constructor(eventBus: EventBus, manager: TaskManager, memory: TaskManagerMemory) {
    super(eventBus, manager, memory, 'generator');
  }

  protected onInitialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastUpdate = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
    }
  }

  /**
   * 为所有己方房间生成任务
   */
  protected onUpdate(): void {
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
    // TODO 增加矿物和超能的采集任务
    const sources = room.find(FIND_SOURCES);
    const existingHarvestTasks = this.manager.taskStateService.getActiveTasks()
      .filter(task => task.type === TaskType.HARVEST && task.roomName === room.name);

    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
      const source = sources[sourceIndex];

      // 检查是否已经有针对这个source的任务（不考虑具体位置）
      const hasTask = existingHarvestTasks.some(task => {
        const harvestTask = task as HarvestTask;
        return harvestTask.params.sourceId === source.id;
      });

      if (!hasTask) {
        // 根据source周围的实际可采集位置数量设置maxAssignees
        const maxWorkers = SourceAnalyzer.getHarvestPositionCount(source);

        this.manager.taskStateService.createTask({
          type: TaskType.HARVEST,
          basePriority: TaskPriority.HIGH,
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
    // 从TransportService获取经过智能匹配的运输任务“请求”
    const transportTaskRequests = this.manager.logisticsManager.transportService.generateTransportTasks(room);

    // console.log(`[TaskGeneratorService] 生成运输任务请求: ${JSON.stringify(transportTaskRequests)}`);

    if (transportTaskRequests.length === 0) {
      return;
    }

    // 获取当前已存在的运输任务，用于防止重复创建
    const existingTransportTasks = this.manager.taskStateService.getActiveTasks()
      .filter(task => task.type === TaskType.TRANSPORT && task.roomName === room.name) as TransportTask[];

    for (const taskRequest of transportTaskRequests) {
      // 检查是否已经有针对这个特定供需对的任务
      const hasExistingTask = existingTransportTasks.some(existing =>
        existing.params.sourceId === taskRequest.params.sourceId &&
        existing.params.targetId === taskRequest.params.targetId &&
        existing.params.resourceType === taskRequest.params.resourceType
      );

      if (!hasExistingTask) {
        // 使用从TransportService生成的信息来创建任务
        this.manager.taskStateService.createTask(taskRequest);
        // console.log(`[TaskGenerator] 创建运输任务: 从 ${taskRequest.params.sourceId || taskRequest.params.sourcePos} 到 ${taskRequest.params.targetId}，运输 ${taskRequest.params.amount} ${taskRequest.params.resourceType}`);
      }
    }
  }

  private generateUpgradeTasks(room: Room): void {
    if (!room.controller || !room.controller.my) {
      return;
    }

    const existingUpgradeTasks = this.manager.taskStateService.getActiveTasks()
      .filter(task => task.type === TaskType.UPGRADE && task.roomName === room.name);

    if (existingUpgradeTasks.length === 0) {
      this.manager.taskStateService.createTask({
        type: TaskType.UPGRADE,
        basePriority: TaskPriority.NORMAL,
        roomName: room.name,
        maxRetries: 3,
        params: {
          controllerId: room.controller.id,
          sourceIds: []
        }
      });
    }
  }

  private generateBuildTasks(room: Room): void {
    const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);

    const existingBuildTasks = this.manager.taskStateService.getActiveTasks()
      .filter(task => task.type === TaskType.BUILD && task.roomName === room.name) as BuildTask[];

    for (const site of constructionSites) {
      const hasTask = existingBuildTasks.some(task => task.params.targetId === site.id);

      if (!hasTask) {
        this.manager.taskStateService.createTask({
          type: TaskType.BUILD,
          basePriority: TaskPriority.NORMAL,
          roomName: room.name,
          maxRetries: 3,
          params: {
            targetId: site.id,
            sourceIds: []
          }
        });
      }
    }
  }

  private generateAttackTasks(room: Room): void {
    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);

    const existingAttackTasks = this.manager.taskStateService.getActiveTasks()
      .filter(task => task.type === TaskType.ATTACK && task.roomName === room.name) as AttackTask[];

    this.createAttackTasksForHostileCreeps(room, hostileCreeps, existingAttackTasks);
    this.createAttackTasksForHostileStructures(room, hostileStructures, existingAttackTasks);
  }

  private createAttackTasksForHostileCreeps(room: Room, hostileCreeps: Creep[], existingTasks: AttackTask[]): void {
    for (const hostile of hostileCreeps) {
      if (this.shouldCreateAttackTask(room, hostile, existingTasks)) {
        this.manager.taskStateService.createTask({
          type: TaskType.ATTACK,
          basePriority: this.calculateAttackTaskPriority(hostile),
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
        this.manager.taskStateService.createTask({
          type: TaskType.ATTACK,
          basePriority: this.calculateAttackTaskPriority(structure),
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
