import { EventBus } from "../core/EventBus";
import { ServiceContainer } from "../core/ServiceContainer";
import { BaseService } from "../services/BaseService";
import { ConstructPlannerService } from "services/construction/ConstructPlannerService";

/**
 * 基础管理器类 - 所有管理器的基类
 */
export abstract class BaseManager<TMemory = any> {
  protected eventBus: EventBus;
  protected services: Map<string, BaseService> = new Map();
  protected serviceContainer: ServiceContainer;
  protected readonly memoryKey?: string;
  protected isManagerActive: boolean = true;
  protected hasErrors: boolean = false;
  protected lastUpdateTick: number = 0;
  protected errorCount: number = 0;
  protected maxErrorCount: number = 3;
  protected updateInterval: number = 0;

  protected get memory(): TMemory {
    if (this.memoryKey === undefined) {
      throw new Error(`管理器 ${this.constructor.name} 没有设置memoryKey`);
    }
    if (!Memory[this.memoryKey]) {
      Memory[this.memoryKey] = {};
    }
    return Memory[this.memoryKey] as TMemory;
  }

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer, memoryKey?: string) {
    this.eventBus = eventBus;
    this.serviceContainer = serviceContainer;
    this.memoryKey = memoryKey;

    this.initializeMemory();
    this.initialize();
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器 - 子类可重写
   */
  protected setupEventListeners(): void {
    // 子类可重写
  }

  /**
   * 全局更新
   */
  public update() {
    if (!this.shouldUpdate()) return;
    this.onUpdate();
    for (const service of this.services.values()) {
      service.update();
    }
    this.updateCompleted();
  }

  /**
   * 初始化方法 - 子类可以重写
   */
  public initialize(): void {
    this.onInitialize();
  }

  public cleanup(): void {
    this.onCleanup();
    for (const service of this.services.values()) {
      service.cleanup();
    }
  }

  /**
   * 重置管理器状态
   */
  public reset(): void {
    this.hasErrors = false;
    this.isManagerActive = true;
    this.errorCount = 0;
    this.onReset();
    for (const service of this.services.values()) {
      service.reset();
    }
  }

  protected abstract onUpdate(): void;
  protected abstract onCleanup(): void;
  protected abstract onReset(): void;
  protected abstract onInitialize(): void;

  /**
   * 注册服务
   */
  public registerServices(name: string, service: BaseService) {
    this.services.set(name, service);
    service.initialize();
  }

  private initializeMemory(): void {
    if (this.memoryKey === undefined) {
      // 如果memoryKey为undefined，则不进行初始化，部分管理器可能不需要内存
      return;
    }
    if (Memory[this.memoryKey] === undefined) {
      Memory[this.memoryKey] = {};
    }
  }

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


}
