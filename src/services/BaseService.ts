import { EventBus } from "../core/EventBus";
import { ServiceContainer } from "../core/ServiceContainer";

/**
 * 基础服务类 - 所有业务服务的基类
 */
export abstract class BaseService {
  protected eventBus: EventBus;
  protected serviceContainer: ServiceContainer;
  protected hasErrors: boolean = false;
  protected errorCount: number = 0;
  protected maxErrorCount: number = 5; // 服务可以容忍更多错误

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    this.eventBus = eventBus;
    this.serviceContainer = serviceContainer;
    this.setupEventListeners();
  }

  /**
   * 初始化服务
   */
  public initialize(): void {
    // 子类可重写
  }

  /**
   * 更新服务
   */
  public update(): void {
    // 子类可重写
  }

  /**
   * 清理服务
   */
  public cleanup(): void {
    // 子类可重写
  }

  /**
   * 设置事件监听器
   */
  protected setupEventListeners(): void {
    // 子类可重写
  }

  /**
   * 发送事件
   */
  protected emit(eventType: string, data?: any): void {
    this.eventBus.emit(eventType, data);
  }

  /**
   * 监听事件
   */
  protected on(eventType: string, callback: Function): void {
    this.eventBus.on(eventType, callback.bind(this));
  }

  /**
   * 设置错误状态
   */
  protected setError(error: any): void {
    this.errorCount++;
    this.hasErrors = this.errorCount >= this.maxErrorCount;

    console.log(`服务 ${this.constructor.name} 发生错误 (${this.errorCount}/${this.maxErrorCount}):`, error);

    if (this.hasErrors) {
      console.log(`服务 ${this.constructor.name} 因重复错误已被标记为不健康`);
    }
  }

  /**
   * 安全执行方法 - 包装可能出错的代码
   */
  protected safeExecute<T>(operation: () => T, operationName?: string): T | undefined {
    try {
      return operation();
    } catch (error: any) {
      const name = operationName || '未知操作';
      console.log(`${this.constructor.name} - ${name} 执行失败:`, error.stack || error);
      this.setError(error);
      return undefined;
    }
  }
}
