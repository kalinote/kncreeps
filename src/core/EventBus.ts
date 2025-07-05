import { GameEvent } from "../types";

/**
 * 事件总线 - 系统内部事件通信的核心
 */
export class EventBus {
  private listeners: Map<string, Function[]> = new Map();
  private eventQueue: GameEvent[] = [];
  private processedEvents: GameEvent[] = [];
  private isProcessing: boolean = false;

  /**
   * 注册事件监听器
   */
  public on(eventType: string, callback: Function): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  /**
   * 注销事件监听器
   */
  public off(eventType: string, callback: Function): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 发送事件到队列
   */
  public emit(eventType: string, data?: any): void {
    this.eventQueue.push({
      type: eventType,
      data,
      timestamp: Game.time
    });
  }

  /**
   * 立即发送事件（同步处理）
   */
  public emitSync(eventType: string, data?: any): void {
    const event: GameEvent = {
      type: eventType,
      data,
      timestamp: Game.time
    };
    this.processEvent(event);
  }

  /**
   * 处理事件队列
   */
  public processEvents(): void {
    if (this.isProcessing) {
      console.log('警告: EventBus 正在处于处理事件状态中');
      return;
    }

    this.isProcessing = true;

    try {
      let processedCount = 0;
      const maxEvents = 100; // 防止事件处理过多导致CPU超时

      while (this.eventQueue.length > 0 && processedCount < maxEvents) {
        const event = this.eventQueue.shift()!;
        this.processEvent(event);
        this.processedEvents.push(event);
        processedCount++;
      }

      if (processedCount >= maxEvents) {
        console.log(`警告: EventBus 处理了 ${maxEvents} 个事件, 剩余 ${this.eventQueue.length} 个事件`);
      }

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 处理单个事件
   */
  private processEvent(event: GameEvent): void {
    const listeners = this.listeners.get(event.type) || [];

    for (const listener of listeners) {
      try {
        listener(event.data, event);
      } catch (error) {
        console.log(`事件监听器错误: ${event.type}:`, error);
        // 记录错误但不影响其他监听器
      }
    }
  }

  /**
   * 获取待处理事件数量
   */
  public getPendingEventCount(): number {
    return this.eventQueue.length;
  }

  /**
   * 获取已处理事件数量
   */
  public getProcessedEventCount(): number {
    return this.processedEvents.length;
  }

  /**
   * 清理已处理的事件
   */
  public clearProcessedEvents(): void {
    // 保留最近的事件用于调试
    if (this.processedEvents.length > 100) {
      this.processedEvents = this.processedEvents.slice(-50);
    }
  }

  /**
   * 获取事件统计信息
   */
  public getEventStats(): { [eventType: string]: number } {
    const stats: { [eventType: string]: number } = {};

    for (const event of this.processedEvents) {
      stats[event.type] = (stats[event.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * 检查是否有指定类型的监听器
   */
  public hasListeners(eventType: string): boolean {
    const listeners = this.listeners.get(eventType);
    return listeners !== undefined && listeners.length > 0;
  }

  /**
   * 清理所有监听器
   */
  public clearAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * 获取所有监听器类型
   */
  public getListenerTypes(): string[] {
    return Array.from(this.listeners.keys());
  }
}
