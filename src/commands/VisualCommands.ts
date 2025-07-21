import { BaseCommand, CommandArgs, CommandResult } from "./BaseCommand";

/**
 * 可视化命令 - 控制可视化显示
 */
export class VisualCommand extends BaseCommand {
  getName(): string {
    return "visual";
  }

  getDescription(): string {
    return "控制可视化显示";
  }

  getUsage(): string {
    return "visual showTaskTrack [true|false]";
  }

  execute(args?: CommandArgs): CommandResult {
    const subCommand = args?.subCommand as string;
    const show = args?.show as boolean;

    if (subCommand === 'showTaskTrack') {
      return this.showTaskTrack(show);
    }

    return {
      success: false,
      message: `未知的子命令: ${subCommand}。可用命令: showTaskTrack`
    };
  }

    private showTaskTrack(show: boolean): CommandResult {
    if (!Memory.visuals) {
      Memory.visuals = {
        cache: null,
        lastUpdateTime: Game.time,
        layerSettings: {}
      };
    }

    if (!Memory.visuals.layerSettings) {
      Memory.visuals.layerSettings = {};
    }

    Memory.visuals.layerSettings['TaskTrackLayer'] = {
      enabled: show
    };

    this.log(`任务追踪显示已${show ? '开启' : '关闭'}`);

    return {
      success: true,
      message: `任务追踪显示已${show ? '开启' : '关闭'}`
    };
  }
}
