import { ManagerContainer } from "../core/ManagerContainer";

/**
 * 命令执行结果
 */
export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * 命令参数接口
 */
export interface CommandArgs {
  [key: string]: any;
}

/**
 * 基础命令类 - 所有调试命令的基类
 */
export abstract class BaseCommand {
  protected managerContainer: ManagerContainer;

  constructor(managerContainer: ManagerContainer) {
    this.managerContainer = managerContainer;
  }

  /**
   * 获取命令名称
   */
  abstract getName(): string;

  /**
   * 获取命令描述
   */
  abstract getDescription(): string;

  /**
   * 获取命令用法
   */
  abstract getUsage(): string;

  /**
   * 执行命令
   */
  abstract execute(args?: CommandArgs): CommandResult;

  /**
   * 获取服务
   */
  protected getService<T>(name: string): T {
    return this.managerContainer.get<T>(name);
  }

  /**
   * 检查服务是否可用
   */
  protected hasService(name: string): boolean {
    return this.managerContainer.has(name);
  }

  /**
   * 安全执行函数，捕获错误
   */
  protected safeExecute<T>(fn: () => T, context: string): T | null {
    try {
      return fn();
    } catch (error) {
      console.log(`❌ [${this.getName()}] ${context} 执行失败:`, error);
      return null;
    }
  }

  /**
   * 格式化输出
   */
  protected log(message: string): void {
    console.log(`[${this.getName()}] ${message}`);
  }

  /**
   * 格式化错误输出
   */
  protected logError(message: string, error?: any): void {
    console.log(`❌ [${this.getName()}] ${message}`, error || '');
  }
}
