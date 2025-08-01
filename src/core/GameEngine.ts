import { EventBus } from "./EventBus";
import { BaseManager } from "../managers/BaseManager";
import { GameConfig } from "../config/GameConfig";
import { ServiceContainer } from "./ServiceContainer";

/**
 * 游戏引擎 - 整个系统的核心控制器
 * 使用ServiceContainer进行依赖注入
 */
export class GameEngine {
  private serviceContainer: ServiceContainer;
  private eventBus!: EventBus;
  private managers: Map<string, BaseManager> = new Map();
  private isInitialized: boolean = false;
  private lastRunTick: number = 0;
  private errorRecoveryAttempts: number = 0;
  private maxErrorRecoveryAttempts: number = GameConfig.SYSTEM.ERROR_RECOVERY_ATTEMPTS;

  constructor() {
    this.serviceContainer = new ServiceContainer();
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
      // 初始化服务容器
      this.serviceContainer.initializeCore();

      // 获取核心服务
      this.eventBus = this.serviceContainer.get('eventBus');

      // 设置全局引用, 必须在初始化管理器之前
      this.setupGlobalReferences();

      // 初始化管理器
      this.serviceContainer.initializeManagers();
      this.managers = this.serviceContainer.getAllManagers();

      // 设置事件监听
      this.setupEventListeners();

      this.isInitialized = true;
      console.log(`游戏引擎初始化完成 - Tick: ${Game.time}`);
    } catch (error) {
      console.log('游戏引擎初始化失败:', error);
      this.handleInitializationError(error);
    }
  }

  /**
   * 设置全局引用
   */
  private setupGlobalReferences(): void {
    // 设置全局引用以便其他模块访问
    global.gameEngine = this;
    (global as any).serviceContainer = this.serviceContainer;
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
    // 死亡creep的内存清理现在由CreepLifecycleService通过事件处理

    // 清理过期的房间内存
    for (const roomName in Memory.rooms) {
      if (!(roomName in Game.rooms)) {
        delete Memory.rooms[roomName];
      }
    }

    // 通知各管理器进行清理
    for (const [name, manager] of this.managers) {
      try {
        if (typeof (manager as any).cleanup === 'function') {
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

    // 死亡creep的内存清理现在由CreepLifecycleService通过事件处理

    // 基本creep控制
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      if (!creep.memory.role) {
        creep.memory.role = GameConfig.ROLES.WORKER;
      }
    }
  }

  /**
   * 通过事件处理creep死亡
   */
  private handleCreepDeath(data: any): void {
    console.log(`💀 [GameEngine] Creep死亡事件: ${data.creepName} (${data.role})`);

    // 触发紧急生产检查
    this.handleEmergencyProduction(data);
  }

  /**
   * 处理紧急生产需求
   */
  private handleEmergencyProduction(data: any): void {
    const { role, roomName } = data;

    // 如果是重要角色，立即请求替换
    if (role === GameConfig.ROLES.WORKER || role === GameConfig.ROLES.TRANSPORTER) {
      const room = Game.rooms[roomName];
      if (room && room.controller?.my) {
        console.log(`🚨 [GameEngine] 紧急生产需求: ${role} in ${roomName}`);
        // 这里可以触发紧急生产逻辑
      }
    }
  }

  private handleRoomUnderAttack(data: any): void {
    console.log(`🚨 [GameEngine] 房间受到攻击: ${data.roomName}`);
    // 处理房间受攻击逻辑
  }

  private handleRoomEnergyChanged(data: any): void {
    // 处理房间能量变化逻辑
  }

  /**
   * 获取服务容器
   */
  public getServiceContainer(): ServiceContainer {
    return this.serviceContainer;
  }

  /**
   * 获取特定服务
   */
  public getService<T>(name: string): T {
    return this.serviceContainer.get<T>(name);
  }

  /**
   * 获取游戏统计信息
   */
  public getGameStats(): any {
    const baseStats = {
      tick: Game.time,
      cpu: {
        used: Game.cpu.getUsed(),
        limit: Game.cpu.limit,
        bucket: Game.cpu.bucket
      },
      memory: {
        used: JSON.stringify(Memory).length,
        limit: 2048000 // 2MB limit
      },
      gcl: {
        level: Game.gcl.level,
        progress: Game.gcl.progress,
        progressTotal: Game.gcl.progressTotal
      }
    };

    // 添加服务容器统计
    const serviceStats = this.serviceContainer.getServiceStats();

    // 添加管理器统计
    const managerStats: any = {};
    for (const [name, manager] of this.managers) {
      if (typeof (manager as any).getStats === 'function') {
        managerStats[name] = (manager as any).getStats();
      }
    }

    return {
      ...baseStats,
      services: serviceStats,
      managers: managerStats
    };
  }

  /**
   * 获取引擎初始化状态
   */
  public isEngineInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 获取引擎状态
   */
  public getEngineStatus(): string {
    if (!this.isInitialized) {
      return 'NOT_INITIALIZED';
    }

    if (this.errorRecoveryAttempts > 0) {
      return 'RECOVERING';
    }

    return 'RUNNING';
  }
}
