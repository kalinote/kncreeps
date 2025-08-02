import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { ServiceContainer } from "../core/ServiceContainer";
import { BaseCommand, CommandArgs, CommandResult } from "../commands/BaseCommand";
import { CommandRegistry } from "../commands/CommandRegistry";
import { GameConfig } from "../config/GameConfig";

/**
 * 命令管理器 - 管理所有调试命令
 */
export class CommandManager extends BaseManager {
  private commandRegistry: CommandRegistry;
  private globalDebugObject: any;
  private globalVisualObject: any;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.updateInterval = GameConfig.MANAGER_CONFIGS.COMMAND_MANAGER?.UPDATE_INTERVAL || 0;
    this.commandRegistry = new CommandRegistry(serviceContainer);
    this.setupGlobalObjects();
  }

  protected onUpdate(): void {}
  protected onInitialize(): void {}
  protected onCleanup(): void {}

  /**
   * 设置全局对象
   */
  private setupGlobalObjects(): void {
    // 设置全局debug对象
    this.globalDebugObject = {
      // 查看详细的生产计划
      productionPlan: (roomName?: string) => {
        const result = this.executeCommand('productionPlan', { roomName });
        if (!result.success) {
          console.log(`❌ 执行失败: ${result.message}`);
        }
      },

      // 查看任务详情
      taskStatus: (roomName?: string) => {
        const result = this.executeCommand('taskStatus', { roomName });
        if (!result.success) {
          console.log(`❌ 执行失败: ${result.message}`);
        }
      },

      // 查看生产队列
      productionQueue: () => {
        const result = this.executeCommand('productionQueue');
        if (!result.success) {
          console.log(`❌ 执行失败: ${result.message}`);
        }
      },

      // 强制重新评估生产需求
      refreshProductionNeeds: () => {
        const result = this.executeCommand('refreshProductionNeeds');
        if (!result.success) {
          console.log(`❌ 执行失败: ${result.message}`);
        }
      },

      // 诊断transport任务问题
      transportStatus: (roomName?: string) => {
        const result = this.executeCommand('transportStatus', { roomName });
        if (!result.success) {
          console.log(`❌ 执行失败: ${result.message}`);
        }
      },

      // 诊断生产需求计算过程
      productionCalculation: (roomName?: string) => {
        const result = this.executeCommand('productionCalculation', { roomName });
        if (!result.success) {
          console.log(`❌ 执行失败: ${result.message}`);
        }
      },

      // 获取帮助信息
      help: (commandName?: string) => {
        if (commandName) {
          console.log(this.getCommandHelp(commandName));
        } else {
          console.log(this.getCommandHelp());
        }
      },

      // 列出所有可用命令
      list: () => {
        const commands = this.getAvailableCommands();
        console.log('可用命令:', commands.join(', '));
      }
    };

    // 设置全局visual对象
    this.globalVisualObject = {
      // 控制任务追踪显示
      showTaskTrack: (show: boolean) => {
        const result = this.executeCommand('visual', {
          subCommand: 'showTaskTrack',
          show
        });
        if (!result.success) {
          console.log(`❌ 执行失败: ${result.message}`);
        }
      }
    };

    // 注册到全局对象
    (global as any).debug = this.globalDebugObject;
    (global as any).visual = this.globalVisualObject;
  }

  /**
   * 注册命令
   */
  public registerCommand(command: BaseCommand): void {
    // 通过CommandRegistry注册命令
    console.log(`[CommandManager] 注册命令: ${command.getName()}`);
  }

    /**
   * 执行命令
   */
  public executeCommand(commandName: string, args?: CommandArgs): CommandResult {
    const command = this.commandRegistry.getCommand(commandName);

    if (!command) {
      return {
        success: false,
        message: `命令 '${commandName}' 不存在。可用命令: ${this.commandRegistry.getRegisteredCommands().join(', ')}`
      };
    }

    try {
      return command.execute(args);
    } catch (error) {
      return {
        success: false,
        message: `执行命令 '${commandName}' 时出错: ${error}`
      };
    }
  }

  /**
   * 获取所有可用命令
   */
  public getAvailableCommands(): string[] {
    return this.commandRegistry.getRegisteredCommands();
  }

    /**
   * 获取命令帮助信息
   */
  public getCommandHelp(commandName?: string): string {
    if (commandName) {
      const command = this.commandRegistry.getCommand(commandName);
      if (!command) {
        return `命令 '${commandName}' 不存在`;
      }

      return `命令: ${command.getName()}\n描述: ${command.getDescription()}\n用法: ${command.getUsage()}`;
    }

    const help = ['可用命令:'];
    for (const command of this.commandRegistry.getAllCommands()) {
      help.push(`  ${command.getName()}: ${command.getDescription()}`);
    }
    return help.join('\n');
  }

  /**
   * 获取服务容器
   */
  public getServiceContainer(): ServiceContainer {
    return this.serviceContainer;
  }

  /**
   * 重置时调用的钩子方法
   */
  protected onReset(): void {
    // 重新创建CommandRegistry
    this.commandRegistry = new CommandRegistry(this.serviceContainer);
    this.setupGlobalObjects();
  }

  /**
   * 获取管理器状态信息
   */
  public getCommandManagerStatus(): {
    registeredCommands: number;
    availableCommands: string[];
  } {
    return {
      registeredCommands: this.commandRegistry.getCommandCount(),
      availableCommands: this.getAvailableCommands()
    };
  }
}
