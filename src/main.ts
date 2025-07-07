import { ErrorMapper } from "utils/ErrorMapper";
import { GameEngine } from "core/GameEngine";
import { TaskManager } from "managers/TaskManager";
import { TaskPriority } from "types";

// 导入类型定义
import "./types";

// 游戏引擎实例 - 只在模块加载时创建一次
const gameEngine = new GameEngine();
console.log(`游戏引擎已创建 - Tick: ${Game.time}`);

// 添加全局调试工具
global.taskDebug = {
  stats: () => {
    const taskManager = gameEngine.getService('taskManager') as TaskManager;
    const stats = taskManager.getStats();
    console.log('=== 任务系统状态 ===');
    console.log(`系统启用: ${stats.enabled}`);
    console.log(`待处理任务: ${stats.pendingTasks}`);
    console.log(`总任务数: ${stats.totalTasks}`);
    console.log(`已创建: ${stats.tasksCreated}`);
    console.log(`已完成: ${stats.tasksCompleted}`);
    console.log(`已失败: ${stats.tasksFailed}`);

    if (Memory.tasks) {
      console.log(`当前任务队列长度: ${Memory.tasks.taskQueue.length}`);
      console.log(`creep任务分配: ${JSON.stringify(Memory.tasks.creepTasks)}`);
    }
  },

  detailed: () => {
    const taskManager = gameEngine.getService('taskManager') as TaskManager;
    console.log('=== 详细任务信息 ===');

    // 显示所有任务
    if (Memory.tasks && Memory.tasks.taskQueue.length > 0) {
      console.log('所有任务:');
      Memory.tasks.taskQueue.forEach(task => {
        console.log(`  ${task.type}(${task.id}): ${task.status} - ${task.assignedCreep || '未分配'}`);
      });
    }

    // 显示所有creep和他们的任务
    console.log('所有creep状态:');
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      const currentTask = taskManager.getCreepTask(name);
      console.log(`  ${name}(${creep.memory.role}): ${currentTask ? `${currentTask.type}(${currentTask.id})` : '无任务'}`);
    }
  },

  forceCreateTask: () => {
    const taskManager = gameEngine.getService('taskManager') as TaskManager;
    const room = Object.values(Game.rooms)[0];
    const sources = room.find(FIND_SOURCES);

    if (sources.length > 0) {
      const taskId = taskManager.createTask({
        type: 'harvest' as any,
        priority: TaskPriority.HIGH,
        roomName: room.name,
        maxRetries: 3,
        params: {
          sourceId: sources[0].id
        }
      });
      console.log(`强制创建采集任务: ${taskId}`);
      return taskId;
    }
    console.log('没有找到可用的资源源');
    return null;
  },

  createTransportTask: () => {
    const taskManager = gameEngine.getService('taskManager') as TaskManager;
    const room = Object.values(Game.rooms)[0];

    // 寻找地面上的能量
    const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY
    });

    // 寻找可以存储的建筑
    const storageStructures = room.find(FIND_STRUCTURES, {
      filter: s => ('store' in s) && s.store && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });

    if (droppedEnergy.length > 0 && storageStructures.length > 0) {
      const taskId = taskManager.createTask({
        type: 'transport' as any,
        priority: TaskPriority.NORMAL,
        roomName: room.name,
        maxRetries: 3,
        params: {
          sourcePos: { x: droppedEnergy[0].pos.x, y: droppedEnergy[0].pos.y, roomName: room.name },
          targetId: storageStructures[0].id,
          resourceType: RESOURCE_ENERGY
        }
      });
      console.log(`创建运输任务: 从 (${droppedEnergy[0].pos.x}, ${droppedEnergy[0].pos.y}) 到 ${storageStructures[0].structureType}(${storageStructures[0].id})`);
      return taskId;
    } else if (droppedEnergy.length > 0) {
      // 没有存储建筑，创建从地面拾取到spawn附近的任务
      const spawn = room.find(FIND_MY_SPAWNS)[0];
      if (spawn) {
        const taskId = taskManager.createTask({
          type: 'transport' as any,
          priority: TaskPriority.NORMAL,
          roomName: room.name,
          maxRetries: 3,
          params: {
            sourcePos: { x: droppedEnergy[0].pos.x, y: droppedEnergy[0].pos.y, roomName: room.name },
            targetPos: { x: spawn.pos.x + 1, y: spawn.pos.y + 1, roomName: room.name },
            resourceType: RESOURCE_ENERGY
          }
        });
        console.log(`创建运输任务: 从 (${droppedEnergy[0].pos.x}, ${droppedEnergy[0].pos.y}) 到 spawn附近`);
        return taskId;
      }
    }

    console.log('没有找到可运输的资源或存储目标');
    return null;
  },

  forceAssign: () => {
    const taskManager = gameEngine.getService('taskManager') as TaskManager;
    console.log('强制执行任务分配...');

    // 手动调用任务分配
    const tasks = taskManager.getPendingTasks();
    console.log(`找到 ${tasks.length} 个待分配任务`);

    const creeps = Object.values(Game.creeps).filter(creep => !taskManager.getCreepTask(creep.name));
    console.log(`找到 ${creeps.length} 个空闲creep`);

    if (tasks.length > 0 && creeps.length > 0) {
      const task = tasks[0];
      const creep = creeps[0];
      console.log(`尝试分配任务 ${task.type}(${task.id}) 给 ${creep.name}`);

      const executor = taskManager.getTaskExecutor(task.type);
      if (executor) {
        console.log(`找到执行器: ${executor.getTaskTypeName()}`);
        const canExecute = executor.canExecute(creep, task);
        console.log(`creep能否执行: ${canExecute}`);

        if (canExecute) {
          const success = taskManager.assignTask(task.id, creep.name);
          console.log(`分配结果: ${success}`);
        }
      } else {
        console.log('找不到合适的执行器');
      }
    }
  },

  cleanupDuplicates: () => {
    console.log('=== 清理重复任务 ===');

    if (!Memory.tasks) {
      console.log('任务系统未初始化');
      return;
    }

    // 按source分组任务
    const sourceTaskMap = new Map<string, any[]>();
    const harvestTasks = Memory.tasks.taskQueue.filter(task => task.type === 'harvest');

    console.log(`找到 ${harvestTasks.length} 个采集任务`);

    for (const task of harvestTasks) {
      const sourceId = (task as any).params.sourceId;
      if (!sourceTaskMap.has(sourceId)) {
        sourceTaskMap.set(sourceId, []);
      }
      sourceTaskMap.get(sourceId)!.push(task);
    }

    // 识别并清理重复任务
    let cleanedCount = 0;
    for (const [sourceId, tasks] of sourceTaskMap) {
      if (tasks.length > 1) {
        console.log(`源 ${sourceId} 有 ${tasks.length} 个重复任务`);

        // 保留优先级最高的任务，如果优先级相同则保留最早创建的
        const sortedTasks = tasks.sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority; // 优先级高的在前
          }
          return a.createdAt - b.createdAt; // 创建时间早的在前
        });

        const keepTask = sortedTasks[0];
        const removeIds = sortedTasks.slice(1).map(t => t.id);

        console.log(`保留任务 ${keepTask.id}, 移除任务: ${removeIds.join(', ')}`);

        // 从任务队列中移除重复任务
        Memory.tasks.taskQueue = Memory.tasks.taskQueue.filter(task =>
          !removeIds.includes(task.id)
        );

        // 如果重复任务已分配给creep，需要清理分配关系
        for (const taskId of removeIds) {
          for (const creepName in Memory.tasks.creepTasks) {
            if (Memory.tasks.creepTasks[creepName] === taskId) {
              delete Memory.tasks.creepTasks[creepName];
              console.log(`清理creep ${creepName} 的任务分配`);
            }
          }
        }

        cleanedCount += removeIds.length;
      }
    }

    console.log(`清理完成，共移除 ${cleanedCount} 个重复任务`);
  },

  testPathfinding: (targetX?: number, targetY?: number) => {
    const room = Object.values(Game.rooms)[0];
    const creep = Object.values(Game.creeps)[0];

    if (!creep) {
      console.log('没有找到creep');
      return;
    }

    const targetPos = targetX && targetY ?
      new RoomPosition(targetX, targetY, room.name) :
      room.find(FIND_SOURCES)[0].pos;

    console.log(`=== 路径测试 ===`);
    console.log(`Creep位置: (${creep.pos.x}, ${creep.pos.y})`);
    console.log(`目标位置: (${targetPos.x}, ${targetPos.y})`);

    // 测试路径查找
    const result = PathFinder.search(creep.pos, { pos: targetPos, range: 1 });
    console.log(`路径查找结果: ${result.incomplete ? '不完整' : '完整'}, 路径长度: ${result.path.length}`);

    if (result.path.length > 0) {
      console.log(`首个路径点: (${result.path[0].x}, ${result.path[0].y})`);
      console.log(`最后路径点: (${result.path[result.path.length - 1].x}, ${result.path[result.path.length - 1].y})`);
    }

    // 测试地形
    const terrain = room.getTerrain();
    const targetTerrain = terrain.get(targetPos.x, targetPos.y);
    console.log(`目标地形: ${targetTerrain === TERRAIN_MASK_WALL ? '墙壁' : targetTerrain === TERRAIN_MASK_SWAMP ? '沼泽' : '平地'}`);

    // 测试建筑
    const structures = room.lookForAt(LOOK_STRUCTURES, targetPos);
    if (structures.length > 0) {
      console.log(`目标位置建筑: ${structures.map(s => s.structureType).join(', ')}`);
    }
  },

  createTransportToPosition: (targetX: number, targetY: number) => {
    const taskManager = gameEngine.getService('taskManager') as TaskManager;
    const room = Object.values(Game.rooms)[0];

    // 寻找地面上的能量
    const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY
    });

    if (droppedEnergy.length > 0) {
      const taskId = taskManager.createTask({
        type: 'transport' as any,
        priority: TaskPriority.HIGH,
        roomName: room.name,
        maxRetries: 3,
        params: {
          sourcePos: { x: droppedEnergy[0].pos.x, y: droppedEnergy[0].pos.y, roomName: room.name },
          targetPos: { x: targetX, y: targetY, roomName: room.name },
          resourceType: RESOURCE_ENERGY
        }
      });
      console.log(`创建精确位置运输任务: 从 (${droppedEnergy[0].pos.x}, ${droppedEnergy[0].pos.y}) 到 (${targetX}, ${targetY})`);
      return taskId;
    }

    console.log('没有找到可运输的能量');
    return null;
  },

  enable: () => {
    const taskManager = gameEngine.getService('taskManager') as TaskManager;
    taskManager.setEnabled(true);
    console.log('任务系统已启用');
  },

  disable: () => {
    const taskManager = gameEngine.getService('taskManager') as TaskManager;
    taskManager.setEnabled(false);
    console.log('任务系统已禁用');
  }
};

// 当将TS编译为JS并使用rollup打包时，错误消息中的行号和文件名会发生变化
// 此实用工具使用源映射来获取原始TS源代码的行号和文件名
export const loop = ErrorMapper.wrapLoop(() => {
  // 运行游戏引擎
  gameEngine.run();
});
