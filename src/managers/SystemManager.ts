import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { ServiceContainer } from "../core/ServiceContainer";
import { SystemService } from "../services/SystemService";

/**
 * 系统管理器 - 协调系统级服务的执行
 */
export class SystemManager extends BaseManager {
  private systemService: SystemService;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.systemService = this.serviceContainer.get<SystemService>('systemService');
    this.updateInterval = GameConfig.MANAGER_CONFIGS.SYSTEM_MANAGER.UPDATE_INTERVAL;
  }

  /**
   * SystemManager 本身不再需要监听错误事件，相关逻辑已移至 SystemService。
   */
  protected setupEventListeners(): void {}

  /**
   * 更新系统管理器，驱动系统服务
   */
  public update(): void {
    if (!this.shouldUpdate()) return;

    // 服务在首次获取时已自动初始化，这里直接运行其更新逻辑
    this.safeExecute(() => {
      this.systemService.run();
    }, 'SystemManager.update');

    this.updateCompleted();
  }

  /**
   * 获取系统状态
   */
  public getSystemStatus(): object {
    return this.systemService.getSystemStatus();
  }

  /**
   * 重置系统状态
   */
  protected onReset(): void {
    // 可以在这里添加特定的重置逻辑，如果需要的话
    // 例如：this.systemService.resetState();
  }
}
