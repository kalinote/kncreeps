import { EventBus } from "./EventBus";
import { StateManager } from "./StateManager";
import { BaseManager } from "./BaseManager";
import { GameConfig } from "../config/GameConfig";
import { RoomManager } from "../managers/RoomManager";
import { CreepManager } from "managers/CreepManager";
import { BehaviorManager } from "../managers/BehaviorManager";

/**
 * 游戏引擎 - 整个系统的核心控制器
 */
export class GameEngine {
  private eventBus: EventBus;
  private stateManager: StateManager;
  private managers: Map<string, BaseManager> = new Map();
  private isInitialized: boolean = false;
  private lastRunTick: number = 0;
  private errorRecoveryAttempts: number = 0;
  private maxErrorRecoveryAttempts: number = GameConfig.SYSTEM.ERROR_RECOVERY_ATTEMPTS;

  constructor() {
    this.eventBus = new EventBus();
    this.stateManager = new StateManager();

    this.initialize();
  }

  /**
   * 初始化游戏引擎
   */
  private initialize(): void {
    if (this.isInitialized) {
      return;
    }

    try {
      // 初始化状态管理器
      this.stateManager.initialize();

      // 初始化管理器
      this.initializeManagers();

      // 设置全局引用
      this.setupGlobalReferences();

      // 设置事件监听
      this.setupEventListeners();

      this.isInitialized = true;
      console.log(`游戏引擎已初始化 - Tick: ${Game.time}`);

    } catch (error) {
      console.log('游戏引擎初始化失败:', error);
      this.handleInitializationError(error);
    }
  }

  /**
  * 初始化管理器
  */
  private initializeManagers(): void {
    // 按依赖顺序初始化管理器
    const roomManager = new RoomManager(this.eventBus);
    this.registerManager('room', roomManager);

    // 其他管理器将在后续创建
    // this.registerManager('resource', new ResourceManager(this.eventBus));
    const creepManager = new CreepManager(this.eventBus, roomManager);
    this.registerManager('creep', creepManager);

    const behaviorManager = new BehaviorManager(this.eventBus);
    this.registerManager('behavior', behaviorManager);
    // this.registerManager('construction', new ConstructionManager(this.eventBus));
    // this.registerManager('military', new MilitaryManager(this.eventBus));
    // this.registerManager('expansion', new ExpansionManager(this.eventBus));

    console.log('游戏引擎: 管理器已初始化');
  }

  /**
   * 注册管理器
   */
  private registerManager(name: string, manager: BaseManager): void {
    this.managers.set(name, manager);
    console.log(`管理器已注册: ${name}`);
  }

  /**
   * 设置全局引用
   */
  private setupGlobalReferences(): void {
    // 设置全局引用以便其他模块访问
    global.gameEngine = this;
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    // 监听系统级事件
    this.eventBus.on(GameConfig.EVENTS.CREEP_DIED, (data: any) => {
      this.handleCreepDeath(data);
    });

    this.eventBus.on(GameConfig.EVENTS.ROOM_UNDER_ATTACK, (data: any) => {
      this.handleRoomUnderAttack(data);
    });

    this.eventBus.on(GameConfig.EVENTS.ROOM_ENERGY_CHANGED, (data: any) => {
      this.handleRoomEnergyChanged(data);
    });
  }

  /**
   * 主运行循环
   */
  public run(): void {
    try {
      // 检查是否已初始化
      if (!this.isInitialized) {
        this.initialize();
      }

      // 防止重复运行
      if (Game.time === this.lastRunTick) {
        return;
      }

      // 1. 更新全局状态
      this.stateManager.update();

      // 2. 处理事件队列
      this.eventBus.processEvents();

      // 3. 更新所有管理器
      this.updateManagers();

      // 4. 清理工作
      this.cleanup();

      // 5. 记录运行状态
      this.lastRunTick = Game.time;
      this.errorRecoveryAttempts = 0; // 重置错误恢复计数

    } catch (error) {
      console.log('游戏引擎运行时错误:', error);
      this.handleRuntimeError(error);
    }
  }

  /**
   * 更新所有管理器
   */
  private updateManagers(): void {
    for (const [name, manager] of this.managers) {
      try {
        if (manager.isActive()) {
          manager.update();
        }
      } catch (error) {
        console.log(`管理器 ${name} 更新失败:`, error);
        this.handleManagerError(name, manager, error);
      }
    }
  }

  /**
   * 清理工作
   */
  private cleanup(): void {
    // 清理事件总线
    this.eventBus.clearProcessedEvents();

    // 定期清理内存
    if (Game.time % GameConfig.UPDATE_FREQUENCIES.CLEANUP === 0) {
      this.performDeepCleanup();
    }
  }

  /**
   * 深度清理
   */
  private performDeepCleanup(): void {
    // 清理死亡creep的内存
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }

    // 清理过期的房间内存
    for (const roomName in Memory.rooms) {
      if (!(roomName in Game.rooms)) {
        delete Memory.rooms[roomName];
      }
    }

    // 通知各管理器进行清理
    for (const [name, manager] of this.managers) {
      try {
        if (manager.isActive() && typeof (manager as any).cleanup === 'function') {
          (manager as any).cleanup();
        }
      } catch (error) {
        console.log(`管理器 ${name} 清理失败:`, error);
      }
    }
  }

  /**
   * 处理初始化错误
   */
  private handleInitializationError(error: any): void {
    console.log('游戏引擎初始化错误，尝试恢复:', error);

    // 重置状态
    this.isInitialized = false;
    this.managers.clear();

    // 如果错误恢复次数未超限，则重试
    if (this.errorRecoveryAttempts < this.maxErrorRecoveryAttempts) {
      this.errorRecoveryAttempts++;
      setTimeout(() => this.initialize(), 1000);
    } else {
      console.log('游戏引擎初始化失败，已达到最大重试次数');
    }
  }

  /**
   * 处理运行时错误
   */
  private handleRuntimeError(error: any): void {
    console.log('游戏引擎运行时错误，尝试恢复:', error);

    this.errorRecoveryAttempts++;

    if (this.errorRecoveryAttempts <= this.maxErrorRecoveryAttempts) {
      // 重置有问题的管理器
      this.resetErrorManagers();

      // 清理状态
      this.eventBus.clearProcessedEvents();

      console.log(`错误恢复尝试 ${this.errorRecoveryAttempts}/${this.maxErrorRecoveryAttempts}`);
    } else {
      console.log('游戏引擎错误恢复失败，进入安全模式');
      this.enterSafeMode();
    }
  }

  /**
   * 处理管理器错误
   */
  private handleManagerError(name: string, manager: BaseManager, error: any): void {
    console.log(`管理器 ${name} 发生错误:`, error);

    // 尝试重置管理器
    if (!manager.hasError()) {
      manager.reset();
    }

    // 如果管理器持续出错，则移除它
    if (manager.hasError()) {
      console.log(`管理器 ${name} 已被禁用`);
      this.managers.delete(name);
    }
  }

  /**
   * 重置错误管理器
   */
  private resetErrorManagers(): void {
    for (const [name, manager] of this.managers) {
      if (manager.hasError()) {
        console.log(`重置管理器: ${name}`);
        manager.reset();
      }
    }
  }

  /**
   * 进入安全模式
   */
  private enterSafeMode(): void {
    console.log('游戏引擎进入安全模式');

    // 暂停所有管理器
    for (const [name, manager] of this.managers) {
      manager.pause();
    }

    // 只执行基本功能
    this.executeSafeMode();
  }

  /**
   * 执行安全模式
   */
  private executeSafeMode(): void {
    // 只保留最基本的功能

    // 清理死亡creep内存
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }

    // 基本creep控制
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      if (!creep.memory.role) {
        creep.memory.role = GameConfig.ROLES.HARVESTER;
      }
    }
  }

  /**
   * 事件处理方法
   */
  private handleCreepDeath(data: any): void {
    console.log('Creep死亡:', data);
    // 处理creep死亡逻辑
  }

  private handleRoomUnderAttack(data: any): void {
    console.log('房间受到攻击:', data);
    // 处理房间受攻击逻辑
  }

  private handleRoomEnergyChanged(data: any): void {
    // 处理房间能量变化逻辑
  }

  /**
   * 公共接口
   */
  public getEventBus(): EventBus {
    return this.eventBus;
  }

  public getStateManager(): StateManager {
    return this.stateManager;
  }

  public getManager<T extends BaseManager>(name: string): T | undefined {
    return this.managers.get(name) as T;
  }

  public getGameStats(): any {
    return {
      initialized: this.isInitialized,
      lastRunTick: this.lastRunTick,
      errorRecoveryAttempts: this.errorRecoveryAttempts,
      managersCount: this.managers.size,
      activeManagers: Array.from(this.managers.entries())
        .filter(([_, manager]) => manager.isActive())
        .map(([name, _]) => name),
      eventBusStats: {
        pendingEvents: this.eventBus.getPendingEventCount(),
        processedEvents: this.eventBus.getProcessedEventCount()
      },
      stateManagerStats: this.stateManager.getGameStats()
    };
  }

  public isEngineInitialized(): boolean {
    return this.isInitialized;
  }

  public getEngineStatus(): string {
    if (!this.isInitialized) {
      return 'initializing';
    }

    if (this.errorRecoveryAttempts > 0) {
      return 'recovering';
    }

    const errorManagers = Array.from(this.managers.values())
      .filter(manager => manager.hasError());

    if (errorManagers.length > 0) {
      return 'degraded';
    }

    return 'normal';
  }
}
