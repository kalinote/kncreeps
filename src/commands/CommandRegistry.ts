import { ManagerContainer } from "../core/ManagerContainer";
import { BaseCommand } from "./BaseCommand";
import { ProductionPlanCommand, ProductionQueueCommand, RefreshProductionNeedsCommand, ProductionCalculationCommand } from "./ProductionCommands";
import { TaskStatusCommand } from "./TaskCommands";
import { TransportStatusCommand } from "./TransportCommands";
import { VisualCommand } from "./VisualCommands";

/**
 * 命令注册表
 * 统一管理所有调试命令的注册
 */
export class CommandRegistry {
  private commands: Map<string, BaseCommand> = new Map();
  private managerContainer: ManagerContainer;

  constructor(managerContainer: ManagerContainer) {
    this.managerContainer = managerContainer;
    this.registerCommands();
  }

  /**
   * 注册所有命令
   */
  private registerCommands(): void {
    // 注册生产相关命令
    this.register(new ProductionPlanCommand(this.managerContainer));
    this.register(new ProductionQueueCommand(this.managerContainer));
    this.register(new RefreshProductionNeedsCommand(this.managerContainer));
    this.register(new ProductionCalculationCommand(this.managerContainer));

    // 注册任务相关命令
    this.register(new TaskStatusCommand(this.managerContainer));

    // 注册运输相关命令
    this.register(new TransportStatusCommand(this.managerContainer));

    // 注册可视化相关命令
    this.register(new VisualCommand(this.managerContainer));

    console.log(`[CommandRegistry] 已注册 ${this.commands.size} 个命令`);
  }

  /**
   * 注册一个命令
   */
  private register(command: BaseCommand): void {
    if (this.commands.has(command.getName())) {
      console.log(`警告: 命令名称冲突，重复注册: ${command.getName()}`);
      return;
    }
    this.commands.set(command.getName(), command);
  }

  /**
   * 获取一个指定名称的命令
   */
  public getCommand(commandName: string): BaseCommand | undefined {
    return this.commands.get(commandName);
  }

  /**
   * 检查是否存在指定名称的命令
   */
  public hasCommand(commandName: string): boolean {
    return this.commands.has(commandName);
  }

  /**
   * 获取所有已注册的命令名称
   */
  public getRegisteredCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * 获取所有已注册的命令实例
   */
  public getAllCommands(): BaseCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * 获取命令数量
   */
  public getCommandCount(): number {
    return this.commands.size;
  }
}
