import { EventBus } from "../core/EventBus";
import { BaseManager } from "../managers/BaseManager";

/**
 * 基础服务类 - 所有业务服务的基类
 */
export abstract class BaseService<TMemory = any, TManager = BaseManager> {
  protected eventBus: EventBus;
  protected manager: TManager;
  protected readonly memoryKey?: string;
  protected hasErrors: boolean = false;
  protected errorCount: number = 0;
  protected maxErrorCount: number = 5; // 服务可以容忍更多错误

  // 添加getter
  protected get memory(): TMemory {
    if (this.memoryKey === undefined) {
      throw new Error(`服务 ${this.constructor.name} 没有设置memoryKey`);
    }

    // 从manager的memory中获取
    const managerMemory = (this.manager as any).memory;
    if (!managerMemory[this.memoryKey]) {
      managerMemory[this.memoryKey] = {};
    }
    return managerMemory[this.memoryKey] as TMemory;
  }

  constructor(eventBus: EventBus, manager: TManager, memory: any, memoryKey?: string) {
    this.eventBus = eventBus;
    this.manager = manager;
    this.memoryKey = memoryKey;
    this.initializeMemory(memory);
    this.setupEventListeners();
  }

  /**
   * 初始化服务
   */
  public abstract initialize(): void;

  /**
   * 更新服务
   */
  public abstract update(): void;

  /**
   * 清理服务
   */
  public abstract cleanup(): void;

  /**
   * 设置事件监听器
   */
  protected setupEventListeners(): void {
    // 子类可重写
  }

  private initializeMemory(memory: any): void {
    if (this.memoryKey === undefined) {
      // 如果memoryKey为undefined，则不进行初始化，部分服务可能不需要内存
      return;
    }
    if (memory[this.memoryKey] === undefined) {
      memory[this.memoryKey] = {};
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
}
