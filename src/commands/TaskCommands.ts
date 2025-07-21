import { BaseCommand, CommandArgs, CommandResult } from "./BaseCommand";

/**
 * 任务状态命令 - 查看任务系统详细状态
 */
export class TaskStatusCommand extends BaseCommand {
  getName(): string {
    return "taskStatus";
  }

  getDescription(): string {
    return "查看任务系统详细状态";
  }

  getUsage(): string {
    return "taskStatus [roomName?]";
  }

  execute(args?: CommandArgs): CommandResult {
    const roomName = args?.roomName as string;

    this.log('=== 任务系统详细状态 ===');

    const rooms = roomName ? [Game.rooms[roomName]] : Object.values(Game.rooms);

    for (const room of rooms) {
      if (!room || !room.controller?.my) continue;

      this.log(`🏢 房间: ${room.name}`);
      this.showDetailedTaskStatus(room);
      this.log('');
    }

    this.log('=== 任务报告结束 ===');

    return {
      success: true,
      message: "任务状态报告已生成"
    };
  }

  private showDetailedTaskStatus(room: Room): void {
    try {
      const taskStateService = this.getService<any>('taskStateService');

      if (!taskStateService) {
        this.log('  ⚠️  无法访问TaskStateService');
        return;
      }

      const roomTasks = taskStateService.getTasksByRoom(room.name);

      this.log(`  📋 详细任务列表 (共 ${roomTasks.length} 个任务):`);

      // 按类型分组显示
      const tasksByType: { [type: string]: any[] } = {};
      roomTasks.forEach((task: any) => {
        if (!tasksByType[task.type]) {
          tasksByType[task.type] = [];
        }
        tasksByType[task.type].push(task);
      });

      for (const [taskType, tasks] of Object.entries(tasksByType)) {
        this.log(`    ${taskType} (${tasks.length} 个):`);

        tasks.forEach((task: any) => {
          const assignedCount = task.assignedCreeps ? task.assignedCreeps.length : 0;
          const maxAssignees = task.maxAssignees || 1;

          this.log(`      - ${task.id} | 状态: ${task.status} | 优先级: ${task.priority}`);
          this.log(`        分配: ${assignedCount}/${maxAssignees} | 类型: ${task.assignmentType || 'EXCLUSIVE'}`);

          if (task.assignedCreeps && task.assignedCreeps.length > 0) {
            this.log(`        已分配creep: ${task.assignedCreeps.join(', ')}`);
          }

          if (task.targetId) {
            this.log(`        目标: ${task.targetId}`);
          }
        });
      }

    } catch (error) {
      this.log(`  ❌ 获取详细任务状态失败: ${error}`);
    }
  }
}
