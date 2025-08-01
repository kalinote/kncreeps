
/**
 * 安全装饰器，用于替代原safeExecute方法
 * 实现统一的错误处理
 */
export function Safe(operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      try {
        return originalMethod.apply(this, args);
      } catch (error: any) {
        const name = operationName || `${this.constructor.name}.${propertyKey}` || "未知操作";
        console.log(`${this.constructor.name} - ${name} 执行失败:`, error.stack || error);

        // 如果实例上有 setError 方法
        if (typeof (this as any).setError === "function") {
          (this as any).setError(error);
        }

        return undefined;
      }
    };
  };
}

// TODO 可能需要进一步优化功能
export function SafeMemoryAccess(operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (this: any, ...args: any[]) {
      if (this.memory === undefined) {
        return undefined;
      }

      try {
        return originalMethod.apply(this, args);
      } catch (error: any) {
        const name = operationName || `${this.constructor.name}.${propertyKey}.${this.memoryKey}` || "未知操作";
        console.log(`${this.constructor.name} - ${name} 内存访问失败:`, error.stack || error);

        if (typeof (this as any).setError === "function") {
          (this as any).setError(error);
        }

        return undefined;
      }
    };
  };
}
