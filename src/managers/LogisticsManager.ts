import { BaseManager } from './BaseManager';
import { EventBus } from '../core/EventBus';
import { ServiceContainer } from '../core/ServiceContainer';
import { TransportService } from '../services/TransportService';

/**
 * 后勤管理器
 * 负责协调所有后勤相关的服务，如运输、市场等。
 */
export class LogisticsManager extends BaseManager {
  private transportService: TransportService;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.transportService = serviceContainer.get('transportService') as TransportService;
  }

  public update(): void {
    this.safeExecute(() => {
      // 在当前阶段，后勤管理器只负责驱动运输服务
      this.transportService.update();
    }, 'LogisticsManager.update');
  }
}
