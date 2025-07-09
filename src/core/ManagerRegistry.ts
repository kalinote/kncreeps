import { BaseManager } from "../managers/BaseManager";
import { EventBus } from "./EventBus";
import { GameConfig } from "../config/GameConfig";

/**
 * 管理器注册表 - 管理Manager间的交互，避免直接依赖
 */
export class ManagerRegistry {
  private managers: Map<string, BaseManager> = new Map();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * 注册管理器
   */
  public register(name: string, manager: BaseManager): void {
    this.managers.set(name, manager);
    console.log(`[ManagerRegistry] 注册管理器: ${name}`);
  }

  /**
   * 获取管理器
   */
  public get<T extends BaseManager>(name: string): T | null {
    return this.managers.get(name) as T || null;
  }

  /**
   * 检查管理器是否存在
   */
  public has(name: string): boolean {
    return this.managers.has(name);
  }

  /**
   * 获取所有管理器名称
   */
  public getManagerNames(): string[] {
    return Array.from(this.managers.keys());
  }

  /**
   * 获取所有管理器
   */
  public getAllManagers(): Map<string, BaseManager> {
    return new Map(this.managers);
  }

  /**
   * 通过事件获取管理器数据
   */
  public requestManagerData(managerName: string, dataType: string, params?: any): any {
    // 通过事件系统请求数据，避免直接调用
    return new Promise((resolve, reject) => {
      const requestId = `req_${Game.time}_${Math.floor(Math.random() * 1000)}`;

      // 设置一次性监听器
      const listener = (data: any) => {
        if (data.requestId === requestId) {
          this.eventBus.off(`${managerName}.data.${dataType}`, listener);
          resolve(data.result);
        }
      };

      this.eventBus.on(`${managerName}.data.${dataType}`, listener);

      // 发送数据请求事件
      this.eventBus.emit(`${managerName}.request.${dataType}`, {
        requestId,
        params,
        timestamp: Game.time
      });

      // 设置超时
      setTimeout(() => {
        this.eventBus.off(`${managerName}.data.${dataType}`, listener);
        reject(new Error(`获取 ${managerName} 的 ${dataType} 数据超时`));
      }, 1000);
    });
  }

  /**
   * 通过事件通知管理器
   */
  public notifyManager(managerName: string, eventType: string, data?: any): void {
    this.eventBus.emit(`${managerName}.${eventType}`, {
      data,
      timestamp: Game.time
    });
  }

  /**
   * 获取管理器状态
   */
  public getManagerStatus(managerName: string): any {
    const manager = this.managers.get(managerName);
    if (!manager) {
      return null;
    }

    return manager.getStatus();
  }

  /**
   * 获取所有管理器状态
   */
  public getAllManagerStatus(): { [name: string]: any } {
    const status: { [name: string]: any } = {};

    for (const [name, manager] of this.managers) {
      status[name] = manager.getStatus();
    }

    return status;
  }

  /**
   * 重置所有管理器
   */
  public resetAllManagers(): void {
    for (const [name, manager] of this.managers) {
      try {
        manager.reset();
        console.log(`[ManagerRegistry] 重置管理器: ${name}`);
      } catch (error) {
        console.log(`[ManagerRegistry] 重置管理器 ${name} 失败:`, error);
      }
    }
  }

  /**
   * 暂停所有管理器
   */
  public pauseAllManagers(): void {
    for (const [name, manager] of this.managers) {
      try {
        manager.pause();
        console.log(`[ManagerRegistry] 暂停管理器: ${name}`);
      } catch (error) {
        console.log(`[ManagerRegistry] 暂停管理器 ${name} 失败:`, error);
      }
    }
  }

  /**
   * 恢复所有管理器
   */
  public resumeAllManagers(): void {
    for (const [name, manager] of this.managers) {
      try {
        manager.resume();
        console.log(`[ManagerRegistry] 恢复管理器: ${name}`);
      } catch (error) {
        console.log(`[ManagerRegistry] 恢复管理器 ${name} 失败:`, error);
      }
    }
  }

  /**
   * 获取管理器统计信息
   */
  public getManagerStats(): any {
    const stats = {
      totalManagers: this.managers.size,
      activeManagers: 0,
      errorManagers: 0,
      managerDetails: {} as { [name: string]: any }
    };

    for (const [name, manager] of this.managers) {
      const status = manager.getStatus();
      stats.managerDetails[name] = status;

      if (status.active) {
        stats.activeManagers++;
      }

      if (status.hasErrors) {
        stats.errorManagers++;
      }
    }

    return stats;
  }

  /**
   * 清理管理器注册表
   */
  public cleanup(): void {
    this.managers.clear();
    console.log('[ManagerRegistry] 清理完成');
  }
}
