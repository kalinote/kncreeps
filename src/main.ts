import { ErrorMapper } from "utils/ErrorMapper";
import { GameEngine } from "core/GameEngine";
import { GameConfig } from "config/GameConfig";
import { TaskStatus, TaskType, ProductionNeed } from "./types";

// 导入类型定义
import "./types";

// 游戏引擎实例 - 只在模块加载时创建一次
const gameEngine = new GameEngine();
console.log(`游戏引擎已创建 - Tick: ${Game.time}`);

// 设置全局控制台指令
(global as any).production = {
  // 查看详细的生产计划
  plan: (roomName?: string) => {
    console.log('=== CREEP 生产计划详细报告 ===');
    console.log(`当前 Tick: ${Game.time}`);
    console.log('');

    const rooms = roomName ? [Game.rooms[roomName]] : Object.values(Game.rooms);

    for (const room of rooms) {
      if (!room || !room.controller?.my) continue;

      console.log(`🏢 房间: ${room.name} (RCL ${room.controller.level})`);
      console.log(`  能量: ${room.energyAvailable}/${room.energyCapacityAvailable}`);

      // 检查是否处于开局阶段
      const isBootstrap = GameConfig.isBootstrapPhase(room);
      const isBootstrapCompleted = GameConfig.isBootstrapCompleted(room);

      console.log(`  开局状态: ${isBootstrap ? '是' : '否'} | 开局完成: ${isBootstrapCompleted ? '是' : '否'}`);

      // 显示当前creep数量和配置
      showCreepStatus(room);

      // 显示任务状态
      showTaskStatus(room);

      // 显示生产需求
      showProductionNeeds(room);

      // 显示Spawn状态
      showSpawnStatus(room);

      console.log('');
    }

    console.log('=== 报告结束 ===');
  },

  // 查看任务详情
  tasks: (roomName?: string) => {
    console.log('=== 任务系统详细状态 ===');

    const rooms = roomName ? [Game.rooms[roomName]] : Object.values(Game.rooms);

    for (const room of rooms) {
      if (!room || !room.controller?.my) continue;

      console.log(`🏢 房间: ${room.name}`);
      showDetailedTaskStatus(room);
      console.log('');
    }

    console.log('=== 任务报告结束 ===');
  },

  // 查看生产队列
  queue: () => {
    console.log('=== 生产队列状态 ===');

    try {
      const serviceContainer = (global as any).serviceContainer;
      if (!serviceContainer) {
        console.log('❌ 无法访问服务容器');
        return;
      }

      const creepProductionService = serviceContainer.get('creepProductionService');
      if (!creepProductionService) {
        console.log('❌ 无法访问CreepProductionService');
        return;
      }

      const queue = creepProductionService.getProductionQueue();

      if (queue.length === 0) {
        console.log('✅ 生产队列为空');
        return;
      }

      console.log(`📋 队列中有 ${queue.length} 个生产需求:`);

      queue.forEach((need: ProductionNeed, index: number) => {
        console.log(`  ${index + 1}. ${need.role} (房间: ${need.roomName})`);
        console.log(`     优先级: ${need.priority} | 能量预算: ${need.energyBudget || '未设置'}`);
        console.log(`     任务类型: ${need.taskType || '未指定'} | 任务数量: ${need.taskCount || '未指定'}`);
        console.log(`     原因: ${need.reason || '未提供'}`);
        console.log(`     创建时间: Tick ${need.timestamp || '未设置'}`);
        console.log('');
      });

    } catch (error) {
      console.log('❌ 查询生产队列失败:', error);
    }

    console.log('=== 队列报告结束 ===');
  },

  // 强制重新评估生产需求
  refresh: () => {
    console.log('🔄 强制重新评估生产需求...');

    try {
      const serviceContainer = (global as any).serviceContainer;
      const creepProductionService = serviceContainer.get('creepProductionService');

      if (creepProductionService) {
        creepProductionService.assessProductionNeeds();
        console.log('✅ 生产需求评估完成');
      } else {
        console.log('❌ 无法访问CreepProductionService');
      }
    } catch (error) {
      console.log('❌ 强制评估失败:', error);
    }
  },

  // 诊断transport任务问题
  transport: (roomName?: string) => {
    console.log('=== TRANSPORT 任务诊断报告 ===');
    console.log(`当前 Tick: ${Game.time}`);
    console.log('');

    const rooms = roomName ? [Game.rooms[roomName]] : Object.values(Game.rooms);

    for (const room of rooms) {
      if (!room || !room.controller?.my) continue;

      console.log(`🏢 房间: ${room.name}`);

      // 1. 检查地面资源
      const droppedResources = room.find(FIND_DROPPED_RESOURCES, {
        filter: r => r.amount > 50
      });
      console.log(`  📦 地面资源: ${droppedResources.length} 个`);
      if (droppedResources.length > 0) {
        droppedResources.forEach((resource, index) => {
          console.log(`    ${index + 1}. ${resource.resourceType} x${resource.amount} 位置(${resource.pos.x},${resource.pos.y})`);
        });
      }

      // 1.5 检查存储设施状态（这是新增的关键诊断）
      console.log(`  🏪 存储设施状态:`);

      // 检查storage
      const storages = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_STORAGE
      });
      console.log(`    Storage: ${storages.length} 个`);
      if (storages.length > 0) {
        storages.forEach((storage, index) => {
          const store = (storage as any).store;
          const freeCapacity = store.getFreeCapacity();
          const totalCapacity = store.getCapacity();
          console.log(`      ${index + 1}. 剩余空间: ${freeCapacity}/${totalCapacity}`);
        });
      }

      // 检查container
      const containers = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
      });
      console.log(`    Container: ${containers.length} 个`);
      if (containers.length > 0) {
        containers.forEach((container, index) => {
          const store = (container as any).store;
          const freeCapacity = store.getFreeCapacity();
          const totalCapacity = store.getCapacity();
          console.log(`      ${index + 1}. 剩余空间: ${freeCapacity}/${totalCapacity}`);
        });
      }

      // 检查能量建筑
      const energyStructures = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN
      });
      console.log(`    能量建筑: ${energyStructures.length} 个`);
      if (energyStructures.length > 0) {
        let totalEnergy = 0;
        let totalCapacity = 0;
        energyStructures.forEach((structure) => {
          const store = (structure as any).store;
          totalEnergy += store.getUsedCapacity(RESOURCE_ENERGY);
          totalCapacity += store.getCapacity(RESOURCE_ENERGY);
        });
        console.log(`      总能量: ${totalEnergy}/${totalCapacity}`);
      }

      // 2. 检查transport任务状态
      console.log(`  🚚 Transport任务状态:`);
      const transportCreeps = room.find(FIND_MY_CREEPS, {
        filter: c => c.memory.role === 'transporter'
      });
      console.log(`    Transporter数量: ${transportCreeps.length}`);

      transportCreeps.forEach((creep, index) => {
        const taskId = creep.memory.targetId;
        console.log(`    ${index + 1}. ${creep.name}:`);
        console.log(`      任务: ${taskId || '无'}`);
        console.log(`      携带: ${creep.store.getUsedCapacity()}/${creep.store.getCapacity()}`);

        if (taskId) {
          // 尝试获取任务详情
          const serviceContainer = (global as any).serviceContainer;
          if (serviceContainer) {
            const taskManager = serviceContainer.get('taskManager');
            if (taskManager) {
              const task = taskManager.getTask(taskId);
              if (task) {
                console.log(`      任务类型: ${task.type}`);
                console.log(`      任务状态: ${task.status}`);
                if (task.params) {
                  console.log(`      源ID: ${task.params.sourceId || '无'}`);
                  console.log(`      目标ID: ${task.params.targetId || '无'}`);
                  console.log(`      资源类型: ${task.params.resourceType || '无'}`);
                }
              }
            }
          }
        }
      });

      // 3. 检查运输网络状态
      console.log(`  🌐 运输网络状态:`);
      if (room.memory.logistics?.transportNetwork) {
        const network = room.memory.logistics.transportNetwork;
        console.log(`    提供者: ${Object.keys(network.providers).length} 个`);
        console.log(`    消费者: ${Object.keys(network.consumers).length} 个`);
        console.log(`    最后更新: Tick ${network.lastUpdated}`);

        // 显示具体的提供者和消费者
        for (const [id, provider] of Object.entries(network.providers)) {
          const obj = Game.getObjectById(id as Id<AnyStructure | Resource>);
          if (obj) {
            const amount = obj instanceof Resource ? obj.amount : (obj as any).store?.getUsedCapacity(provider.resourceType) || 0;
            console.log(`      提供者 ${id}: ${provider.type} - ${provider.resourceType} x${amount}`);
          }
        }

        for (const [id, consumer] of Object.entries(network.consumers)) {
          const obj = Game.getObjectById(id as Id<AnyStructure>);
          if (obj) {
            const needs = (obj as any).store?.getFreeCapacity(consumer.resourceType) || 0;
            console.log(`      消费者 ${id}: ${consumer.type} - 需要 ${consumer.resourceType} x${needs}`);
          }
        }
      } else {
        console.log(`    运输网络未初始化`);
      }

      console.log('');
    }

    console.log('=== 诊断报告结束 ===');
  },

  // 诊断生产需求计算过程 - 使用增强版调试
  debug: (roomName?: string) => {
    try {
      const serviceContainer = (global as any).serviceContainer;
      const creepProductionService = serviceContainer.get('creepProductionService');

      if (!creepProductionService) {
        console.log('❌ 无法访问CreepProductionService');
        return;
      }

      // 使用增强版的调试功能，考虑实际的creep分配状态
      if (typeof creepProductionService.debugProductionCalculation === 'function') {
        creepProductionService.debugProductionCalculation(roomName);
      } else {
        console.log('❌ 调试功能不可用');
      }

    } catch (error) {
      console.log('❌ 执行调试失败:', error);
    }
  }
};

// 辅助函数：显示creep状态
function showCreepStatus(room: Room): void {
  const creeps = Object.values(Game.creeps).filter(c => c.room.name === room.name);
  const roleCount: { [role: string]: number } = {};

  creeps.forEach(creep => {
    const role = creep.memory.role;
    roleCount[role] = (roleCount[role] || 0) + 1;
  });

  console.log(`  👥 Creep统计 (总计: ${creeps.length}):`);

  for (const role of [GameConfig.ROLES.WORKER, GameConfig.ROLES.TRANSPORTER]) {
    const count = roleCount[role] || 0;
    const limits = GameConfig.getRoleLimits(room.controller!.level, role);
    const limitText = limits ? `${limits.min}-${limits.max}` : '未配置';

    console.log(`    ${role}: ${count} (配置: ${limitText})`);
  }
}

// 辅助函数：显示任务状态
function showTaskStatus(room: Room): void {
  try {
    const serviceContainer = (global as any).serviceContainer;
    const taskStateService = serviceContainer.get('taskStateService');

    if (!taskStateService) {
      console.log('  ⚠️  无法访问TaskStateService');
      return;
    }

    const roomTasks = taskStateService.getTasksByRoom(room.name);
    const taskStats: { [key: string]: { [status: string]: number } } = {};

    roomTasks.forEach((task: any) => {
      const type = task.type;
      const status = task.status;

      if (!taskStats[type]) {
        taskStats[type] = {};
      }

      taskStats[type][status] = (taskStats[type][status] || 0) + 1;
    });

    console.log(`  📋 任务统计 (总计: ${roomTasks.length}):`);

    for (const [taskType, statusCounts] of Object.entries(taskStats)) {
      const totalCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);
      console.log(`    ${taskType}: ${totalCount} (${Object.entries(statusCounts).map(([s, c]) => `${s}:${c}`).join(', ')})`);
    }

  } catch (error) {
    console.log('  ❌ 获取任务状态失败:', error);
  }
}

// 辅助函数：显示详细任务状态
function showDetailedTaskStatus(room: Room): void {
  try {
    const serviceContainer = (global as any).serviceContainer;
    const taskStateService = serviceContainer.get('taskStateService');

    if (!taskStateService) {
      console.log('  ⚠️  无法访问TaskStateService');
      return;
    }

    const roomTasks = taskStateService.getTasksByRoom(room.name);

    console.log(`  📋 详细任务列表 (共 ${roomTasks.length} 个任务):`);

    // 按类型分组显示
    const tasksByType: { [type: string]: any[] } = {};
    roomTasks.forEach((task: any) => {
      if (!tasksByType[task.type]) {
        tasksByType[task.type] = [];
      }
      tasksByType[task.type].push(task);
    });

    for (const [taskType, tasks] of Object.entries(tasksByType)) {
      console.log(`    ${taskType} (${tasks.length} 个):`);

      tasks.forEach((task: any) => {
        const assignedCount = task.assignedCreeps ? task.assignedCreeps.length : 0;
        const maxAssignees = task.maxAssignees || 1;

        console.log(`      - ${task.id} | 状态: ${task.status} | 优先级: ${task.priority}`);
        console.log(`        分配: ${assignedCount}/${maxAssignees} | 类型: ${task.assignmentType || 'EXCLUSIVE'}`);

        if (task.assignedCreeps && task.assignedCreeps.length > 0) {
          console.log(`        已分配creep: ${task.assignedCreeps.join(', ')}`);
        }

        if (task.targetId) {
          console.log(`        目标: ${task.targetId}`);
        }
      });
    }

  } catch (error) {
    console.log('  ❌ 获取详细任务状态失败:', error);
  }
}

// 辅助函数：显示生产需求
function showProductionNeeds(room: Room): void {
  try {
    const serviceContainer = (global as any).serviceContainer;
    const creepProductionService = serviceContainer.get('creepProductionService');

    if (!creepProductionService) {
      console.log('  ⚠️  无法访问CreepProductionService');
      return;
    }

    const queue = creepProductionService.getProductionQueue();
    const roomNeeds = queue.filter((need: any) => need.roomName === room.name);

    console.log(`  🏭 生产需求 (${roomNeeds.length} 个):`);

    if (roomNeeds.length === 0) {
      console.log('    ✅ 暂无生产需求');
      return;
    }

    roomNeeds.forEach((need: any, index: number) => {
      console.log(`    ${index + 1}. ${need.role} | 优先级: ${need.priority} | 能量预算: ${need.energyBudget || '未设置'}`);
      console.log(`       原因: ${need.reason || '未提供'}`);
      console.log(`       任务: ${need.taskType || '未指定'} (${need.taskCount || '未指定'}个)`);
    });

  } catch (error) {
    console.log('  ❌ 获取生产需求失败:', error);
  }
}

// 辅助函数：显示Spawn状态
function showSpawnStatus(room: Room): void {
  const spawns = room.find(FIND_MY_SPAWNS);

  console.log(`  🏭 Spawn状态 (${spawns.length} 个):`);

  spawns.forEach((spawn, index) => {
    if (spawn.spawning) {
      const spawningCreep = Game.creeps[spawn.spawning.name];
      const role = spawningCreep?.memory.role || '未知';
      const progress = Math.round((spawn.spawning.needTime - spawn.spawning.remainingTime) / spawn.spawning.needTime * 100);

      console.log(`    ${index + 1}. ${spawn.name}: 正在生产 ${role} (${spawn.spawning.name}) - ${progress}%`);
    } else {
      console.log(`    ${index + 1}. ${spawn.name}: 空闲`);
    }
  });
}

(global as any).visual = {
  // 关闭任务追踪显示
  showTaskTrack: (show: boolean) => {
    if (!Memory.visuals) {
      return;
    }
    Memory.visuals.layerSettings['TaskTrackLayer'] = {
      enabled: show
    };
  }
}


// 当将TS编译为JS并使用rollup打包时，错误消息中的行号和文件名会发生变化
// 此实用工具使用源映射来获取原始TS源代码的行号和文件名
export const loop = ErrorMapper.wrapLoop(() => {
  // 运行游戏引擎
  gameEngine.run();
});
