import { EventBus } from "./EventBus";
import { ManagerRegistry } from "./ManagerRegistry";
import { StatsManager } from "../managers/StatsManager";
import { CoordinationManager } from "../managers/CoordinationManager";
import { BaseManager } from "../managers/BaseManager";
import { RoomManager } from "../managers/RoomManager";
import { CreepManager } from "../managers/CreepManager";
import { TaskManager } from "../managers/TaskManager";
import { VisualManager } from "../managers/VisualManager";
import { ConstructionManager } from "../managers/ConstructionManager";
import { LogisticsManager } from "../managers/LogisticsManager";

const ManagerConfig = {
  // 核心服务，需要最先初始化
  coreServices: [
    'eventBus',
    'managerRegistry'
  ],
  // 系统管理器，也需要较早初始化
  systemManagers: ['statsManager', 'coordinationManager'],
  // 业务管理器，将被注册到 ManagerRegistry
  managers: [
    'logisticsManager', // 感知
    'roomManager',
    'creepManager',
    'constructionManager',
    'taskManager', // 决策
    'visualManager',
    'commandManager'
  ]
};

/**
 * 服务容器 - 管理所有服务和依赖注入
 */
export class ManagerContainer {
  private services: Map<string, any> = new Map();
  private singletons: Map<string, any> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    this.registerServices();
  }

  /**
   * 注册所有服务
   */
  private registerServices(): void {
    // 注册核心服务
    this.registerSingleton('eventBus', () => new EventBus());
    this.registerSingleton('managerRegistry', () => new ManagerRegistry(this.get('eventBus')));

    // 注册系统管理器
    this.registerSingleton('statsManager', () => new StatsManager(this.get('eventBus'), this));
    this.registerSingleton('coordinationManager', () => new CoordinationManager(this.get('eventBus'), this));

    // 注册任务系统
    this.registerSingleton('taskManager', () => new TaskManager(this.get('eventBus'), this));

    // 注册管理器
    this.registerSingleton('roomManager', () => new RoomManager(this.get('eventBus'), this));
    this.registerSingleton('creepManager', () =>
      new CreepManager(
        this.get('eventBus'),
        this
      )
    );

    // 注册建筑管理器
    this.registerSingleton('constructionManager', () => new ConstructionManager(this.get('eventBus'), this));

    // 注册后勤系统
    this.registerSingleton('logisticsManager', () => new LogisticsManager(this.get('eventBus'), this));

    // 注册可视化管理器和服务
    this.registerSingleton('visualManager', () => new VisualManager(this.get('eventBus'), this));

  }

  /**
   * 注册单例服务
   */
  private registerSingleton(name: string, factory: () => any): void {
    this.services.set(name, factory);
    // console.log(`[ManagerContainer] 注册单例服务: ${name}`);
  }

  /**
   * 获取服务实例
   */
  public get<T>(name: string): T {
    // 如果已经创建过单例，直接返回
    if (this.singletons.has(name)) {
      return this.singletons.get(name) as T;
    }

    // 获取工厂函数
    const factory = this.services.get(name);
    if (!factory) {
      throw new Error(`服务 '${name}' 未注册`);
    }

    // 创建服务实例
    const instance = factory();
    this.singletons.set(name, instance);

    return instance as T;
  }

  /**
   * 检查服务是否已注册
   */
  public has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * 获取所有已注册的服务名称
   */
  public getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * 获取所有已创建的单例服务名称
   */
  public getCreatedSingletons(): string[] {
    return Array.from(this.singletons.keys());
  }

  /**
   * 初始化所有核心服务
   */
  public initializeCore(): void {
    if (this.isInitialized) {
      return;
    }

    // 初始化核心服务和系统管理器
    const coreInitQueue = [...ManagerConfig.coreServices, ...ManagerConfig.systemManagers];
    for (const serviceName of coreInitQueue) {
      this.get(serviceName);
    }

    // console.log('[ManagerContainer] 核心服务已初始化');
    this.isInitialized = true;
  }

  /**
   * 初始化所有管理器
   */
  public initializeManagers(): void {
    const managerRegistry = this.get<ManagerRegistry>('managerRegistry');

    // 注册所有业务管理器到注册表
    for (const name of ManagerConfig.managers) {
      const manager = this.get<BaseManager>(name);
      managerRegistry.register(name, manager);
    }

    // console.log('[ManagerContainer] 管理器已初始化');
  }

  /**
   * 获取所有管理器
   */
  public getAllManagers(): Map<string, BaseManager> {
    const managers = new Map<string, BaseManager>();

    const managerNames = [
      ...ManagerConfig.systemManagers,
      ...ManagerConfig.managers
    ];

    for (const name of managerNames) {
      if (this.singletons.has(name)) {
        managers.set(name, this.singletons.get(name) as BaseManager);
      }
    }

    return managers;
  }

  /**
   * 重置所有服务（用于测试或重启）
   */
  public reset(): void {
    // 清理所有单例实例
    for (const [name, instance] of this.singletons) {
      if (instance && typeof instance.onReset === 'function') {
        try {
          instance.onReset();
        } catch (error) {
          console.log(`重置服务 ${name} 时出错:`, error);
        }
      }
    }

    this.singletons.clear();
    this.isInitialized = false;
    console.log('[ManagerContainer] 所有服务已重置');
  }

  /**
   * 获取服务状态统计
   */
  public getServiceStats(): any {
    return {
      registeredServices: this.getRegisteredServices().length,
      createdSingletons: this.getCreatedSingletons().length,
      isInitialized: this.isInitialized,
      services: {
        registered: this.getRegisteredServices(),
        created: this.getCreatedSingletons()
      }
    };
  }
}
