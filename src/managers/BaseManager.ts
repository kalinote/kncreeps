import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { ServiceContainer } from "../core/ServiceContainer";

/**
 * 基础管理器类 - 所有管理器的基类
 */
export abstract class BaseManager {
  protected eventBus: EventBus;
  protected serviceContainer: ServiceContainer;
  protected isManagerActive: boolean = true;
  protected hasErrors: boolean = false;
  protected lastUpdateTick: number = 0;
  protected errorCount: number = 0;
  protected maxErrorCount: number = 3;
  protected updateInterval: number = 0;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    this.eventBus = eventBus;
    this.serviceContainer = serviceContainer;
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器 - 子类可重写
   */
  protected setupEventListeners(): void {
    // 子类可重写
  }

  /**
   * 抽象方法 - 各管理器必须实现的更新逻辑
   */
  public abstract update(): void;

  /**
   * 检查管理器是否处于活动状态
   */
  public isActive(): boolean {
    return this.isManagerActive && !this.hasErrors;
  }

  /**
   * 检查管理器是否有错误
   */
  public hasError(): boolean {
    return this.hasErrors;
  }

  /**
   * 重置管理器状态
   */
  public reset(): void {
    this.hasErrors = false;
    this.isManagerActive = true;
    this.errorCount = 0;
    this.onReset();
  }

  /**
   * 暂停管理器
   */
  public pause(): void {
    this.isManagerActive = false;
  }

  /**
   * 恢复管理器
   */
  public resume(): void {
    this.isManagerActive = true;
  }

  /**
   * 设置错误状态
   */
  protected setError(error: any): void {
    this.errorCount++;
    this.hasErrors = this.errorCount >= this.maxErrorCount;

    console.log(`管理器 ${this.constructor.name} 发生错误 (${this.errorCount}/${this.maxErrorCount}):`, error);

    if (this.hasErrors) {
      console.log(`管理器 ${this.constructor.name} 因重复错误已被禁用`);
      this.isManagerActive = false;
    }
  }

  /**
   * 检查是否应该更新
   */
  protected shouldUpdate(): boolean {
    // 检查是否处于活动状态
    if (!this.isActive()) {
      return false;
    }

    // 检查是否已经在本tick更新过
    if (Game.time === this.lastUpdateTick) {
      return false;
    }

    // 检查更新频率
    if (this.updateInterval > 0 && Game.time - this.lastUpdateTick < this.updateInterval) {
      return false;
    }

    return true;
  }

  /**
   * 更新完成后调用
   */
  protected updateCompleted(): void {
    this.lastUpdateTick = Game.time;
  }

  /**
   * 获取下一次更新的信息
   */
  public getNextUpdateInfo(): { nextUpdateIn: number; updateInterval: number } {
    if (this.updateInterval <= 0) {
      return { nextUpdateIn: 0, updateInterval: 0 };
    }
    const nextUpdateTick = this.lastUpdateTick + this.updateInterval;
    const nextUpdateIn = Math.max(0, nextUpdateTick - Game.time);
    return { nextUpdateIn, updateInterval: this.updateInterval };
  }

  /**
   * 安全执行方法 - 包装可能出错的代码
   */
  protected safeExecute<T>(operation: () => T, operationName?: string): T | undefined {
    try {
      return operation();
    } catch (error) {
      const name = operationName || '未知操作';
      console.log(`${this.constructor.name} - ${name} 执行失败:`, error);
      this.setError(error);
      return undefined;
    }
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
    this.eventBus.on(eventType, callback);
  }

  /**
   * 获取管理器名称
   */
  public getName(): string {
    return this.constructor.name;
  }

  /**
   * 获取管理器状态
   */
  public getStatus(): {
    name: string;
    active: boolean;
    hasErrors: boolean;
    errorCount: number;
    lastUpdateTick: number;
  } {
    return {
      name: this.getName(),
      active: this.isManagerActive,
      hasErrors: this.hasErrors,
      errorCount: this.errorCount,
      lastUpdateTick: this.lastUpdateTick
    };
  }

  /**
   * 获取性能统计
   */
  public getPerformanceStats(): {
    updateFrequency: number;
    averageUpdateTime: number;
    errorRate: number;
  } {
    // 这里可以添加性能统计逻辑
    return {
      updateFrequency: Game.time - this.lastUpdateTick,
      averageUpdateTime: 0, // 需要实现CPU时间统计
      errorRate: this.errorCount / (Game.time || 1)
    };
  }

  /**
   * 重置时调用的钩子方法
   */
  protected onReset(): void {
    // 子类可以重写此方法来实现特定的重置逻辑
  }

  /**
   * 初始化方法 - 子类可以重写
   */
  protected onInitialize(): void {
    // 子类可以重写此方法来实现特定的初始化逻辑
  }

  /**
   * 清理方法 - 子类可以重写
   */
  protected onCleanup(): void {
    // 子类可以重写此方法来实现特定的清理逻辑
  }
}
