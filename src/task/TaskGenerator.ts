import { TaskManager } from "../managers/TaskManager";
import { HarvestTask, TransportTask, TaskPriority, TaskType } from "../types";

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
    // 后续添加其他任务类型
  }

  private generateHarvestTasks(room: Room): void {
    const sources = room.find(FIND_SOURCES);
    const existingHarvestTasks = this.taskManager.getActiveTasks()
      .filter(task => task.type === TaskType.HARVEST && task.roomName === room.name);

    console.log(`[TaskGenerator] 房间 ${room.name}: 找到 ${sources.length} 个源, 现有 ${existingHarvestTasks.length} 个活跃采集任务`);

    // 为每个源创建采集任务（如果还没有）
    for (const source of sources) {
      const hasTask = existingHarvestTasks.some(task =>
        (task as HarvestTask).params.sourceId === source.id
      );

      if (!hasTask) {
        const taskId = this.taskManager.createTask({
          type: TaskType.HARVEST,
          priority: TaskPriority.HIGH,
          roomName: room.name,
          maxRetries: 3,
          params: {
            sourceId: source.id
          }
        });
        console.log(`[TaskGenerator] 为源 ${source.id} 创建采集任务: ${taskId}`);
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
}
