import { BaseManager } from './BaseManager';
import { EventBus } from '../core/EventBus';
import { ServiceContainer } from '../core/ServiceContainer';
import { TransportService } from '../services/logistics/TransportService';
import { Safe } from '../utils/Decorators';
import { LogisticsMemory } from '../types';

/**
 * 后勤管理器
 * 负责协调所有后勤相关的服务，如运输、市场等。
 */
export class LogisticsManager extends BaseManager<LogisticsMemory> {
  protected readonly memoryKey: string = 'logisticsManager';

  public initialize(): void {
    if (!this.memory.initAt) {
      this.memory = {
        initAt: Game.time,
        lastUpdate: Game.time,
        lastCleanup: Game.time,
        errorCount: 0
      }
    }
  }

  public cleanup(): void {}

  public get transportService(): TransportService {
    return this.services.get('transportService') as TransportService;
  }

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.registerServices('transportService', new TransportService(this.eventBus, this, this.memory));
  }

  @Safe("LogisticsManager.updateManager")
  public updateManager(): void {
    this.transportService.update();
  }
}
