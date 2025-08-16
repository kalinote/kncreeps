import { BaseService } from "../BaseService";
import { CommandRegistry } from "../../command/CommandRegistry";
import { EventBus } from "../../core/EventBus";
import { CommandManager } from "../../managers/CommandManager";
import { setGlobalCommandRegistry } from "../../command/registerCommand";

/**
 * 命令服务 - 负责命令系统的业务逻辑
 */
export class CommandService extends BaseService {
  private _commandRegistry: CommandRegistry;

  public get commandRegistry(): CommandRegistry {
    return this._commandRegistry;
  }

  constructor(eventBus: EventBus, manager: CommandManager, memory: any) {
    super(eventBus, manager, memory);
    this._commandRegistry = new CommandRegistry();

    setGlobalCommandRegistry(this._commandRegistry);
    this.setupGlobalHelp();
  }

  protected onInitialize(): void {}
  protected onUpdate(): void {}
  protected onCleanup(): void {}

  protected onReset(): void {
    // 重置时重新设置全局注册器
    setGlobalCommandRegistry(this._commandRegistry);
    this.setupGlobalHelp();
  }

  /**
   * 设置全局帮助命令
   */
  private setupGlobalHelp(): void {
    (global as any).help = () => {
      this._commandRegistry.showHelp();
    };
  }

  /**
   * 获取命令统计信息
   */
  public getCommandStats(): any {
    const allCommands = this._commandRegistry.getAllCommands();
    const namespaces = new Set(allCommands.map(cmd => cmd.namespace));

    return {
      totalCommands: allCommands.length,
      totalNamespaces: namespaces.size,
      namespaces: Array.from(namespaces)
    };
  }
}
