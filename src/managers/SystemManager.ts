import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";

/**
 * 系统管理器 - 负责游戏引擎核心状态管理
 */
export class SystemManager extends BaseManager {
  private initialized: boolean = false;
  private lastCleanupTick: number = 0;
  private lastStatsTick: number = 0;

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.on(GameConfig.EVENTS.SYSTEM_ERROR, (data: any) => {
      this.handleSystemError(data);
    });

    this.on(GameConfig.EVENTS.MANAGER_ERROR, (data: any) => {
      this.handleManagerError(data);
    });
  }

  /**
   * 更新系统管理器
   */
  public update(): void {
    if (!this.shouldUpdate()) return;

    this.safeExecute(() => {
      // 初始化检查
      if (!this.initialized) {
        this.initialize();
      }

      // 定期清理
      this.performPeriodicCleanup();

      // 更新系统状态
      this.updateSystemState();
    }, 'SystemManager.update');

    this.updateCompleted();
  }

  /**
   * 初始化系统
   */
  private initialize(): void {
    this.initializeSystemMemory();
    this.initialized = true;
    console.log('[SystemManager] 系统已初始化');
  }

  /**
   * 初始化系统内存结构
   */
  private initializeSystemMemory(): void {
    if (!Memory.gameEngine) {
      Memory.gameEngine = {
        initialized: true,
        lastTick: Game.time,
        version: '1.0.0',
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
    const cleanupInterval = GameConfig.UPDATE_FREQUENCIES.SYSTEM_CLEANUP || 100;

    if (Game.time - this.lastCleanupTick >= cleanupInterval) {
      this.safeExecute(() => {
        this.cleanupSystemMemory();
        this.lastCleanupTick = Game.time;
      }, 'SystemManager.cleanup');
    }
  }

  /**
   * 清理系统内存
   */
  private cleanupSystemMemory(): void {
    if (!Memory.system) return;

    // 清理过期的错误记录
    if (Memory.system.errorCount > GameConfig.TIMEOUTS.ERROR_COUNT_RESET) {
      Memory.system.errorCount = 0;
    }

    // 清理过期的性能数据
    if (Memory.system.performance && Game.time - Memory.system.performance.lastUpdate > GameConfig.TIMEOUTS.PERFORMANCE_DATA_EXPIRY) {
      Memory.system.performance.averageTickTime = 0;
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
    console.log(`[SystemManager] 系统错误:`, data);

    if (Memory.system) {
      Memory.system.errorCount++;
    }
  }

  /**
   * 处理管理器错误
   */
  private handleManagerError(data: any): void {
    const { managerName, error } = data;
    console.log(`[SystemManager] 管理器 ${managerName} 错误:`, error);

    // 更新管理器状态
    if (Memory.system && Memory.system.managerStatus) {
      Memory.system.managerStatus[managerName] = {
        hasError: true,
        lastError: Game.time,
        errorCount: (Memory.system.managerStatus[managerName]?.errorCount || 0) + 1
      };
    }
  }

  /**
   * 获取系统状态
   */
  public getSystemStatus(): any {
    return {
      initialized: this.initialized,
      lastCleanup: this.lastCleanupTick,
      systemMemory: Memory.system,
      gameEngineMemory: Memory.gameEngine
    };
  }

  /**
   * 检查系统是否已初始化
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 重置系统状态
   */
  protected onReset(): void {
    this.initialized = false;
    this.lastCleanupTick = 0;
    this.lastStatsTick = 0;
  }
}
