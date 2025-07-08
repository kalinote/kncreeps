import { TaskManager } from "../managers/TaskManager";
import { HarvestTask, TransportTask, UpgradeTask, BuildTask, TaskPriority, TaskType } from "../types";

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
    // 后续添加其他任务类型
  }

  private generateHarvestTasks(room: Room): void {
    const sources = room.find(FIND_SOURCES);
    const existingHarvestTasks = this.taskManager.getActiveTasks()
      .filter(task => task.type === TaskType.HARVEST && task.roomName === room.name);

    console.log(`[TaskGenerator] 房间 ${room.name}: 找到 ${sources.length} 个源, 现有 ${existingHarvestTasks.length} 个活跃采集任务`);

    // 为每个源创建采集任务（如果还没有）
    // 前两个source保持高优先级，超过两个的source设置为低优先级
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const hasTask = existingHarvestTasks.some(task =>
        (task as HarvestTask).params.sourceId === source.id
      );

      if (!hasTask) {
        // 前两个source使用高优先级，其余使用低优先级
        const priority = i < 2 ? TaskPriority.HIGH : TaskPriority.LOW;
        const taskId = this.taskManager.createTask({
          type: TaskType.HARVEST,
          priority: priority,
          roomName: room.name,
          maxRetries: 3,
          params: {
            sourceId: source.id
          }
        });
        console.log(`[TaskGenerator] 为源 ${source.id} 创建采集任务: ${taskId} (优先级: ${priority})`);
      } else {
        console.log(`[TaskGenerator] 源 ${source.id} 已有活跃任务，跳过创建`);
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
}

