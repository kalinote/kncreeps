import { CommandMetadata } from "../types";

/**
 * 命令注册器 - 负责命令的注册和管理
 */
export class CommandRegistry {
  private commands: Map<string, CommandMetadata> = new Map();
  private namespaces: Set<string> = new Set();

  /**
   * 注册命令
   */
  public register(metadata: CommandMetadata): boolean {
    if (!this.validateCommandPath(metadata.fullPath)) {
      console.log(`[命令注册错误] 命令路径包含非法字符: ${metadata.fullPath}`);
      return false;
    }

    if (this.commands.has(metadata.fullPath)) {
      const existing = this.commands.get(metadata.fullPath)!;
      console.log(`[命令注册警告] 命令 '${metadata.fullPath}' 已存在，跳过注册`);
      console.log(`  已存在: ${existing.target.constructor.name}.${existing.propertyKey}`);
      console.log(`  尝试注册: ${metadata.target.constructor.name}.${metadata.propertyKey}`);
      return false;
    }

    this.registerToGlobal(metadata);

    this.commands.set(metadata.fullPath, metadata);
    this.namespaces.add(metadata.namespace);

    return true;
  }

  /**
   * 注册命令到全局对象
   */
  private registerToGlobal(metadata: CommandMetadata): void {
    const pathParts = metadata.fullPath.split('.');
    let current = global as any;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    const commandName = pathParts[pathParts.length - 1];
    const wrappedMethod = this.wrapCommand(metadata);
    current[commandName] = wrappedMethod;

    this.addHelpMethods(metadata);
  }

  /**
   * 包装命令方法
   */
  private wrapCommand(metadata: CommandMetadata): Function {
    return (...args: any[]) => {
      try {
        const result = metadata.method.apply(metadata.target, args);

        if (result !== undefined) {
          if (typeof result === 'object') {
            console.log(JSON.stringify(result, null, 2));
            return;
          } else {
            console.log(result);
            return result;
          }
        }

        return result;
      } catch (error) {
        console.log(`[命令执行错误] ${metadata.fullPath}: ${error}`);
        console.log(`  参数: ${JSON.stringify(args)}`);
        if (error instanceof Error && error.stack) {
          console.log(`  堆栈: ${error.stack}`);
        }
        return undefined;
      }
    };
  }

  /**
   * 添加帮助方法
   */
  private addHelpMethods(metadata: CommandMetadata): void {
    const pathParts = metadata.fullPath.split('.');

    for (let i = 1; i <= pathParts.length; i++) {
      const currentPath = pathParts.slice(0, i).join('.');
      const obj = this.getGlobalObject(currentPath);

      if (obj && !obj.help) {
        obj.help = () => this.showHelp(currentPath);
      }
    }
  }

  /**
   * 获取全局对象引用
   */
  private getGlobalObject(path: string): any {
    const pathParts = path.split('.');
    let current = global as any;

    for (const part of pathParts) {
      if (!current[part]) return null;
      current = current[part];
    }

    return current;
  }

  /**
   * 显示帮助信息
   */
  public showHelp(path?: string): void {
    if (!path) {
      console.log('=== 可用命令命名空间 ===');
      const namespaceArray = Array.from(this.namespaces);
      if (namespaceArray.length === 0) {
        console.log('暂无可用命名空间');
      } else {
        for (const namespace of namespaceArray) {
          console.log(`${namespace} - 使用 ${namespace}.help() 查看详细命令`);
        }
      }
      return;
    }

    const matchingCommands = Array.from(this.commands.values())
      .filter(cmd => cmd.fullPath === path || cmd.fullPath.startsWith(path + '.'));

    if (matchingCommands.length === 0) {
      console.log(`未找到命令: ${path}`);
      return;
    }

    console.log(`=== ${path} 命令帮助 ===`);
    for (const cmd of matchingCommands) {
      console.log(`${cmd.fullPath} - ${cmd.description}`);
    }
  }

  /**
   * 验证命令路径合法性
   * 只允许字母、数字、点和下划线
   */
  private validateCommandPath(path: string): boolean {
    const validPattern = /^[a-zA-Z_][a-zA-Z0-9_.]*[a-zA-Z0-9_]$/;
    return validPattern.test(path) && !path.includes('..');
  }

  /**
   * 获取所有已注册的命令
   */
  public getAllCommands(): CommandMetadata[] {
    return Array.from(this.commands.values());
  }

  /**
   * 获取指定命名空间的命令
   */
  public getCommandsByNamespace(namespace: string): CommandMetadata[] {
    return Array.from(this.commands.values())
      .filter(cmd => cmd.namespace === namespace);
  }
}
