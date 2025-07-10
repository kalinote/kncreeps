import { BaseService } from './BaseService';
import { EventBus } from '../core/EventBus';
import { ServiceContainer } from '../core/ServiceContainer';
import { GameConfig } from '../config/GameConfig';

/**
 * 系统服务 - 负责游戏核心状态管理、内存初始化和周期性清理
 */
export class SystemService extends BaseService {
  private lastCleanupTick: number = 0;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.initializeSystemMemory();
    if (Memory.system) {
      this.lastCleanupTick = Memory.system.lastCleanup || 0;
    }
  }

  /**
   * 设置事件监听器
   */
  protected setupEventListeners(): void {
    this.on(GameConfig.EVENTS.SYSTEM_ERROR, this.handleSystemError.bind(this));
    this.on(GameConfig.EVENTS.MANAGER_ERROR, this.handleManagerError.bind(this));
  }

  /**
   * 执行所有系统维护任务
   */
  public run(): void {
    this.safeExecute(() => {
      this.performPeriodicCleanup();
      this.updateSystemState();
    }, 'SystemService.run');
  }

  /**
   * 初始化系统内存结构
   */
  private initializeSystemMemory(): void {
    if (!Memory.gameEngine) {
      Memory.gameEngine = {
        initialized: true,
        lastTick: Game.time,
        version: '1.0.0', // 可从package.json读取
        startTime: Game.time
      };
    }

    if (!Memory.system) {
      Memory.system = {
        lastCleanup: Game.time,
        errorCount: 0,
        managerStatus: {},
        performance: {
          lastUpdate: Game.time,
          averageTickTime: 0
        }
      };
    }
  }

  /**
   * 定期清理
   */
  private performPeriodicCleanup(): void {
    const cleanupInterval = GameConfig.UPDATE_FREQUENCIES.SYSTEM_CLEANUP;
    if (Game.time - this.lastCleanupTick >= cleanupInterval) {
      this.cleanupMemory();
      this.lastCleanupTick = Game.time;
    }
  }

  /**
   * 清理内存中的过时数据
   */
  private cleanupMemory(): void {
    if (!Memory.system) return;

    // 清理过期的错误记录
    if (Memory.system.errorCount > GameConfig.TIMEOUTS.ERROR_COUNT_RESET) {
      Memory.system.errorCount = 0;
    }

    // 清理死亡的creep内存
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }
  }

  /**
   * 更新系统状态
   */
  private updateSystemState(): void {
    if (Memory.gameEngine) {
      Memory.gameEngine.lastTick = Game.time;
    }

    if (Memory.system) {
      Memory.system.lastCleanup = this.lastCleanupTick;
    }
  }

  /**
   * 处理系统错误
   */
  private handleSystemError(data: any): void {
    console.log(`[SystemService] 系统错误:`, data.error || data);
    if (Memory.system) {
      Memory.system.errorCount++;
    }
  }

  /**
   * 处理管理器错误
   */
  private handleManagerError(data: { managerName: string; error: any }): void {
    const { managerName, error } = data;
    console.log(`[SystemService] 管理器 ${managerName} 错误:`, error);

    if (Memory.system?.managerStatus) {
      const status = Memory.system.managerStatus[managerName] || { errorCount: 0 };
      status.hasError = true;
      status.lastError = Game.time;
      status.errorCount++;
      Memory.system.managerStatus[managerName] = status;
    }
  }

  /**
   * 获取系统状态的快照
   */
  public getSystemStatus(): object {
    return {
      lastCleanup: this.lastCleanupTick,
      systemMemory: Memory.system,
      gameEngineMemory: Memory.gameEngine
    };
  }
}
