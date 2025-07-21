import { BaseCommand, CommandArgs, CommandResult } from "./BaseCommand";
import { GameConfig } from "../config/GameConfig";
import { ProductionNeed } from "../types";

/**
 * 生产计划命令 - 查看详细的生产计划
 */
export class ProductionPlanCommand extends BaseCommand {
  getName(): string {
    return "productionPlan";
  }

  getDescription(): string {
    return "查看详细的生产计划";
  }

  getUsage(): string {
    return "productionPlan [roomName?]";
  }

  execute(args?: CommandArgs): CommandResult {
    const roomName = args?.roomName as string;

    this.log('=== CREEP 生产计划详细报告 ===');
    this.log(`当前 Tick: ${Game.time}`);
    this.log('');

    const rooms = roomName ? [Game.rooms[roomName]] : Object.values(Game.rooms);

    for (const room of rooms) {
      if (!room || !room.controller?.my) continue;

      this.log(`🏢 房间: ${room.name} (RCL ${room.controller.level})`);
      this.log(`  能量: ${room.energyAvailable}/${room.energyCapacityAvailable}`);

      // 检查是否处于开局阶段
      const isBootstrap = GameConfig.isBootstrapPhase(room);
      const isBootstrapCompleted = GameConfig.isBootstrapCompleted(room);

      this.log(`  开局状态: ${isBootstrap ? '是' : '否'} | 开局完成: ${isBootstrapCompleted ? '是' : '否'}`);

      // 显示当前creep数量和配置
      this.showCreepStatus(room);

      // 显示任务状态
      this.showTaskStatus(room);

      // 显示生产需求
      this.showProductionNeeds(room);

      // 显示Spawn状态
      this.showSpawnStatus(room);

      this.log('');
    }

    this.log('=== 报告结束 ===');

    return {
      success: true,
      message: "生产计划报告已生成"
    };
  }

  private showCreepStatus(room: Room): void {
    const creeps = Object.values(Game.creeps).filter(c => c.room.name === room.name);
    const roleCount: { [role: string]: number } = {};

    creeps.forEach(creep => {
      const role = creep.memory.role;
      roleCount[role] = (roleCount[role] || 0) + 1;
    });

    this.log(`  👥 Creep统计 (总计: ${creeps.length}):`);

    for (const role of [GameConfig.ROLES.WORKER, GameConfig.ROLES.TRANSPORTER]) {
      const count = roleCount[role] || 0;
      const limits = GameConfig.getRoleLimits(room.controller!.level, role);
      const limitText = limits ? `${limits.min}-${limits.max}` : '未配置';

      this.log(`    ${role}: ${count} (配置: ${limitText})`);
    }
  }

  private showTaskStatus(room: Room): void {
    try {
      const taskStateService = this.getService<any>('taskStateService');

      if (!taskStateService) {
        this.log('  ⚠️  无法访问TaskStateService');
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

      this.log(`  📋 任务统计 (总计: ${roomTasks.length}):`);

      for (const [taskType, statusCounts] of Object.entries(taskStats)) {
        const totalCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);
        this.log(`    ${taskType}: ${totalCount} (${Object.entries(statusCounts).map(([s, c]) => `${s}:${c}`).join(', ')})`);
      }

    } catch (error) {
      this.log(`  ❌ 获取任务状态失败: ${error}`);
    }
  }

  private showProductionNeeds(room: Room): void {
    try {
      const creepProductionService = this.getService<any>('creepProductionService');

      if (!creepProductionService) {
        this.log('  ⚠️  无法访问CreepProductionService');
        return;
      }

      const queue = creepProductionService.getProductionQueue();
      const roomNeeds = queue.filter((need: any) => need.roomName === room.name);

      this.log(`  🏭 生产需求 (${roomNeeds.length} 个):`);

      if (roomNeeds.length === 0) {
        this.log('    ✅ 暂无生产需求');
        return;
      }

      roomNeeds.forEach((need: any, index: number) => {
        this.log(`    ${index + 1}. ${need.role} | 优先级: ${need.priority} | 能量预算: ${need.energyBudget || '未设置'}`);
        this.log(`       原因: ${need.reason || '未提供'}`);
        this.log(`       任务: ${need.taskType || '未指定'} (${need.taskCount || '未指定'}个)`);
      });

    } catch (error) {
      this.log(`  ❌ 获取生产需求失败: ${error}`);
    }
  }

  private showSpawnStatus(room: Room): void {
    const spawns = room.find(FIND_MY_SPAWNS);

    this.log(`  🏭 Spawn状态 (${spawns.length} 个):`);

    spawns.forEach((spawn, index) => {
      if (spawn.spawning) {
        const spawningCreep = Game.creeps[spawn.spawning.name];
        const role = spawningCreep?.memory.role || '未知';
        const progress = Math.round((spawn.spawning.needTime - spawn.spawning.remainingTime) / spawn.spawning.needTime * 100);

        this.log(`    ${index + 1}. ${spawn.name}: 正在生产 ${role} (${spawn.spawning.name}) - ${progress}%`);
      } else {
        this.log(`    ${index + 1}. ${spawn.name}: 空闲`);
      }
    });
  }
}

/**
 * 生产队列命令 - 查看生产队列状态
 */
export class ProductionQueueCommand extends BaseCommand {
  getName(): string {
    return "productionQueue";
  }

  getDescription(): string {
    return "查看生产队列状态";
  }

  getUsage(): string {
    return "productionQueue";
  }

  execute(args?: CommandArgs): CommandResult {
    this.log('=== 生产队列状态 ===');

    try {
      const creepProductionService = this.getService<any>('creepProductionService');
      if (!creepProductionService) {
        this.log('❌ 无法访问CreepProductionService');
        return {
          success: false,
          message: "无法访问CreepProductionService"
        };
      }

      const queue = creepProductionService.getProductionQueue();

      if (queue.length === 0) {
        this.log('✅ 生产队列为空');
        return {
          success: true,
          message: "生产队列为空"
        };
      }

      this.log(`📋 队列中有 ${queue.length} 个生产需求:`);

      queue.forEach((need: ProductionNeed, index: number) => {
        this.log(`  ${index + 1}. ${need.role} (房间: ${need.roomName})`);
        this.log(`     优先级: ${need.priority} | 能量预算: ${need.energyBudget || '未设置'}`);
        this.log(`     任务类型: ${need.taskType || '未指定'} | 任务数量: ${need.taskCount || '未指定'}`);
        this.log(`     原因: ${need.reason || '未提供'}`);
        this.log(`     创建时间: Tick ${need.timestamp || '未设置'}`);
        this.log('');
      });

    } catch (error) {
      this.log(`❌ 查询生产队列失败: ${error}`);
      return {
        success: false,
        message: `查询生产队列失败: ${error}`
      };
    }

    this.log('=== 队列报告结束 ===');
    return {
      success: true,
      message: "生产队列报告已生成"
    };
  }
}

/**
 * 刷新生产需求命令 - 强制重新评估生产需求
 */
export class RefreshProductionNeedsCommand extends BaseCommand {
  getName(): string {
    return "refreshProductionNeeds";
  }

  getDescription(): string {
    return "强制重新评估生产需求";
  }

  getUsage(): string {
    return "refreshProductionNeeds";
  }

  execute(args?: CommandArgs): CommandResult {
    this.log('🔄 强制重新评估生产需求...');

    try {
      const creepProductionService = this.getService<any>('creepProductionService');

      if (creepProductionService) {
        creepProductionService.assessProductionNeeds();
        this.log('✅ 生产需求评估完成');
        return {
          success: true,
          message: "生产需求评估完成"
        };
      } else {
        this.log('❌ 无法访问CreepProductionService');
        return {
          success: false,
          message: "无法访问CreepProductionService"
        };
      }
    } catch (error) {
      this.log(`❌ 强制评估失败: ${error}`);
      return {
        success: false,
        message: `强制评估失败: ${error}`
      };
    }
  }
}

/**
 * 生产计算命令 - 诊断生产需求计算过程
 */
export class ProductionCalculationCommand extends BaseCommand {
  getName(): string {
    return "productionCalculation";
  }

  getDescription(): string {
    return "诊断生产需求计算过程";
  }

  getUsage(): string {
    return "productionCalculation [roomName?]";
  }

  execute(args?: CommandArgs): CommandResult {
    const roomName = args?.roomName as string;

    try {
      const creepProductionService = this.getService<any>('creepProductionService');

      if (!creepProductionService) {
        this.log('❌ 无法访问CreepProductionService');
        return {
          success: false,
          message: "无法访问CreepProductionService"
        };
      }

      // 使用增强版的调试功能，考虑实际的creep分配状态
      if (typeof creepProductionService.debugProductionCalculation === 'function') {
        creepProductionService.debugProductionCalculation(roomName);
        return {
          success: true,
          message: "生产计算诊断完成"
        };
      } else {
        this.log('❌ 调试功能不可用');
        return {
          success: false,
          message: "调试功能不可用"
        };
      }

    } catch (error) {
      this.log(`❌ 执行调试失败: ${error}`);
      return {
        success: false,
        message: `执行调试失败: ${error}`
      };
    }
  }
}
