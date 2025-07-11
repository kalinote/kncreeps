import { ErrorMapper } from "utils/ErrorMapper";
import { GameEngine } from "core/GameEngine";
import { GameConfig } from "config/GameConfig";
import { TaskStatus, TaskType, ProductionNeed } from "types";

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

      // 模拟findStorageTarget的行为
      console.log(`  🎯 存储目标分析:`);
      for (const resource of droppedResources) {
        console.log(`    资源 ${resource.resourceType} 的存储目标:`);

        // 模拟findStorageTarget逻辑
        const resourceType = resource.resourceType;
        let targetFound = false;

        // 检查有空间的storage
        const availableStorages = room.find(FIND_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_STORAGE &&
            'store' in s && (s as any).store && (s as any).store.getFreeCapacity(resourceType) > 0
        });
        if (availableStorages.length > 0) {
          console.log(`      ✅ 找到有空间的storage: ${availableStorages[0].id}`);
          targetFound = true;
        }

        // 检查有空间的container
        if (!targetFound) {
          const availableContainers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER &&
              'store' in s && (s as any).store && (s as any).store.getFreeCapacity(resourceType) > 0
          });
          if (availableContainers.length > 0) {
            console.log(`      ✅ 找到有空间的container: ${availableContainers[0].id}`);
            targetFound = true;
          }
        }

        // 检查能量建筑（仅限能量资源）
        if (!targetFound && resourceType === RESOURCE_ENERGY) {
          const availableEnergyStructures = room.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
              'store' in s && (s as any).store && (s as any).store.getFreeCapacity(RESOURCE_ENERGY) > 0
          });
          if (availableEnergyStructures.length > 0) {
            console.log(`      ✅ 找到有空间的能量建筑: ${availableEnergyStructures[0].id}`);
            targetFound = true;
          }
        }

        // 检查备用策略
        if (!targetFound) {
          console.log(`      ⚠️ 没有找到理想存储目标，使用备用策略`);
          if (storages.length > 0) {
            console.log(`      📦 备用目标: Storage (可能已满)`);
          } else if (containers.length > 0) {
            console.log(`      📦 备用目标: Container (可能已满)`);
          } else if (resourceType === RESOURCE_ENERGY && energyStructures.length > 0) {
            console.log(`      📦 备用目标: 能量建筑 (可能已满)`);
          } else {
            const spawns = room.find(FIND_MY_SPAWNS);
            if (spawns.length > 0) {
              console.log(`      📦 最后备用目标: Spawn`);
            } else {
              console.log(`      ❌ 没有找到任何存储目标`);
            }
          }
        }
      }

      // 2. 检查transport任务
      try {
        const serviceContainer = (global as any).serviceContainer;
        const taskStateService = serviceContainer.get('taskStateService');

        if (taskStateService) {
          const roomTasks = taskStateService.getTasksByRoom(room.name);
          const transportTasks = roomTasks.filter((task: any) => task.type === TaskType.TRANSPORT);

          console.log(`  🚚 Transport任务: ${transportTasks.length} 个`);
          if (transportTasks.length > 0) {
            transportTasks.forEach((task: any, index: number) => {
              const creepNames = task.assignedCreeps.join(', ') || '无';
              console.log(`    ${index + 1}. ${task.id} | 状态: ${task.status} | 分配: ${task.assignedCreeps.length}/${task.maxAssignees}`);
              console.log(`       资源: ${task.params.resourceType} | 源位置: (${task.params.sourcePos?.x},${task.params.sourcePos?.y})`);
              console.log(`       目标: ${task.params.targetId} | 分配给: ${creepNames}`);
            });
          }
        }
      } catch (error) {
        console.log('  ❌ 获取transport任务失败:', error);
      }

      // 3. 检查transporter数量
      const transporters = Object.values(Game.creeps).filter(creep =>
        creep.memory.role === GameConfig.ROLES.TRANSPORTER &&
        (creep.memory.room === room.name || creep.room.name === room.name)
      );
      console.log(`  👷 Transporter数量: ${transporters.length} 个`);
      if (transporters.length > 0) {
        transporters.forEach((creep, index) => {
          const taskId = Memory.tasks?.creepTasks?.[creep.name] || '无任务';
          const carryUsed = creep.store.getUsedCapacity();
          const carryCapacity = creep.store.getCapacity();
          console.log(`    ${index + 1}. ${creep.name} | 任务: ${taskId} | 载货: ${carryUsed}/${carryCapacity}`);
          console.log(`       位置: (${creep.pos.x},${creep.pos.y}) | 生命值: ${creep.ticksToLive}/1500`);
        });
      }

      // 4. 检查生产需求
      try {
        const serviceContainer = (global as any).serviceContainer;
        const creepProductionService = serviceContainer.get('creepProductionService');

        if (creepProductionService) {
          const queue = creepProductionService.getProductionQueue();
          const transporterNeeds = queue.filter((need: ProductionNeed) =>
            need.role === GameConfig.ROLES.TRANSPORTER && need.roomName === room.name
          );

          console.log(`  🏭 Transporter生产需求: ${transporterNeeds.length} 个`);
          if (transporterNeeds.length > 0) {
            transporterNeeds.forEach((need: ProductionNeed, index: number) => {
              console.log(`    ${index + 1}. 优先级: ${need.priority} | 原因: ${need.reason}`);
              console.log(`       任务类型: ${need.taskType} | 任务数量: ${need.taskCount}`);
            });
          }
        }
      } catch (error) {
        console.log('  ❌ 获取生产需求失败:', error);
      }

      // 5. 分析问题
      console.log('  🔍 问题分析:');
      if (droppedResources.length > 0) {
        console.log(`    - 地面有 ${droppedResources.length} 个资源需要运输`);
      }

      try {
        const serviceContainer = (global as any).serviceContainer;
        const taskStateService = serviceContainer.get('taskStateService');

        if (taskStateService) {
          const roomTasks = taskStateService.getTasksByRoom(room.name);
          const transportTasks = roomTasks.filter((task: any) => task.type === TaskType.TRANSPORT);
          const pendingTransportTasks = transportTasks.filter((task: any) => task.status === TaskStatus.PENDING);
          const activeTransportTasks = transportTasks.filter((task: any) =>
            task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.ASSIGNED
          );

          if (droppedResources.length > transportTasks.length) {
            console.log(`    - 资源比任务多 ${droppedResources.length - transportTasks.length} 个，可能需要创建更多transport任务`);
          }

          if (pendingTransportTasks.length > 0) {
            console.log(`    - 有 ${pendingTransportTasks.length} 个未分配的transport任务`);
          }

          if (activeTransportTasks.length > transporters.length) {
            console.log(`    - 活跃任务(${activeTransportTasks.length})多于transporter数量(${transporters.length})，可能需要更多transporter`);
          }

          if (transportTasks.length === 0 && droppedResources.length > 0) {
            console.log(`    - ⚠️ 地面有资源但没有transport任务，可能存在任务生成问题`);
            console.log(`    - 💡 修复建议：检查findStorageTarget是否返回了有效目标`);
          }

          // 新增：检查存储设施是否都满了
          if (storages.length === 0 && containers.length === 0) {
            console.log(`    - ⚠️ 房间没有storage或container，依赖能量建筑存储`);
          }

          const totalEnergyCapacity = energyStructures.reduce((total, structure) =>
            total + (structure as any).store.getCapacity(RESOURCE_ENERGY), 0
          );
          const totalEnergyUsed = energyStructures.reduce((total, structure) =>
            total + (structure as any).store.getUsedCapacity(RESOURCE_ENERGY), 0
          );

          if (totalEnergyCapacity > 0 && totalEnergyUsed >= totalEnergyCapacity) {
            console.log(`    - ⚠️ 所有能量建筑都已满(${totalEnergyUsed}/${totalEnergyCapacity})，可能影响transport任务创建`);
            console.log(`    - 💡 修复：新的备用策略应该能解决这个问题`);
          }
        }
      } catch (error) {
        console.log('    - ❌ 分析过程中出错:', error);
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
