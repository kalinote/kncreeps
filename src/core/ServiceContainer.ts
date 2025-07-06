import { EventBus } from "./EventBus";
import { StateManager } from "./StateManager";
import { BaseManager } from "./BaseManager";
import { RoomManager } from "../managers/RoomManager";
import { CreepManager } from "../managers/CreepManager";
import { BehaviorManager } from "../managers/BehaviorManager";
import { CreepProductionService } from "../services/CreepProductionService";
import { CreepLifecycleService } from "../services/CreepLifecycleService";
import { EnergyService } from "../services/EnergyService";

/**
 * 服务容器 - 管理所有服务和依赖注入
 */
export class ServiceContainer {
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
    this.registerSingleton('stateManager', () => new StateManager());

    // 注册业务服务
    this.registerSingleton('energyService', () => new EnergyService());
    this.registerSingleton('creepProductionService', () =>
      new CreepProductionService(this.get('eventBus'))
    );
    this.registerSingleton('creepLifecycleService', () =>
      new CreepLifecycleService(this.get('eventBus'), this.get('creepProductionService'))
    );

    // 注册管理器
    this.registerSingleton('roomManager', () => new RoomManager(this.get('eventBus')));
    this.registerSingleton('creepManager', () =>
      new CreepManager(
        this.get('eventBus'),
        this.get('creepProductionService'),
        this.get('creepLifecycleService'),
        this.get('roomManager')
      )
    );
    this.registerSingleton('behaviorManager', () => new BehaviorManager(this.get('eventBus')));
  }

  /**
   * 注册单例服务
   */
  private registerSingleton(name: string, factory: () => any): void {
    this.services.set(name, factory);
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

    // 初始化核心服务
    this.get('eventBus');
    this.get('stateManager');

    console.log('ServiceContainer: 核心服务已初始化');
    this.isInitialized = true;
  }

  /**
   * 初始化所有管理器
   */
  public initializeManagers(): void {
    // 按依赖顺序初始化管理器
    this.get('roomManager');
    this.get('creepManager');
    this.get('behaviorManager');

    console.log('ServiceContainer: 管理器已初始化');
  }

  /**
   * 初始化所有服务
   */
  public initializeServices(): void {
    // 初始化业务服务
    this.get('energyService');
    this.get('creepProductionService');
    this.get('creepLifecycleService');

    console.log('ServiceContainer: 业务服务已初始化');
  }

  /**
   * 获取所有管理器
   */
  public getAllManagers(): Map<string, BaseManager> {
    const managers = new Map<string, BaseManager>();

    const managerNames = ['roomManager', 'creepManager', 'behaviorManager'];
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
    console.log('ServiceContainer: 所有服务已重置');
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
