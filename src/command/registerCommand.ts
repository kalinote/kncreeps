import { CommandMetadata } from "../types";

/**
 * 全局命令注册器实例
 */
let globalCommandRegistry: any = null;

/**
 * 设置全局命令注册器
 */
export function setGlobalCommandRegistry(registry: any): void {
  globalCommandRegistry = registry;
}

/**
 * 命令注册装饰器
 */
export function registerCommand(
  namespace?: string,
  name?: string,
  description?: string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // 延迟注册，等待系统初始化完成
    setTimeout(() => {
      if (!globalCommandRegistry) {
        console.log(`[命令注册错误] 命令注册器未初始化: ${propertyKey}`);
        return;
      }

      // 生成默认命名空间和名称
      const defaultNamespace = target.constructor.name.toLowerCase().replace('service', '');
      const finalNamespace = namespace || defaultNamespace;
      const finalName = name || propertyKey;
      const finalDescription = description || `${finalNamespace}.${finalName} 命令`;

      const metadata: CommandMetadata = {
        namespace: finalNamespace,
        name: finalName,
        description: finalDescription,
        fullPath: `${finalNamespace}.${finalName}`,
        method: descriptor.value,
        target: target,
        propertyKey: propertyKey
      };

      globalCommandRegistry.register(metadata);
    }, 0);

    return descriptor;
  };
}
