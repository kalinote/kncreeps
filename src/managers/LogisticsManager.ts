import { BaseManager } from './BaseManager';
import { EventBus } from '../core/EventBus';
import { ServiceContainer } from '../core/ServiceContainer';
import { TransportService } from '../services/logistics/TransportService';
import { LogisticsMemory } from '../types';
import { EnergyService } from '../services/logistics/EnergyService';

/**
 * 后勤管理器
 * 负责协调所有后勤相关的服务，如运输、市场等。
 */
export class LogisticsManager extends BaseManager<LogisticsMemory> {
  protected onCleanup(): void {}
  protected onReset(): void {}

  public get transportService(): TransportService {
    return this.services.get('transportService') as TransportService;
  }

  public get energyService(): EnergyService {
    return this.services.get('energyService') as EnergyService;
  }

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer, 'logisticsManager');
    this.registerServices('transportService', new TransportService(this.eventBus, this, this.memory));
    this.registerServices('energyService', new EnergyService(this.eventBus, this, this.memory));
  }

  protected onInitialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastUpdate = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
    }
  }

  protected onUpdate(): void {}
}
