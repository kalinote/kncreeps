import { VisualLayoutService } from 'services/visual/VisualLayoutService';
import { EventBus } from '../core/EventBus';
import { ManagerContainer } from '../core/ManagerContainer';
import { BaseLayer } from './layers/BaseLayer';
import { ConstructionPlannerLayer } from './layers/ConstructionPlannerLayer';
import { GlobalInfoLayer } from './layers/GlobalInfoLayer';
import { RoomInfoLayer } from './layers/RoomInfoLayer';
import { TaskAssignmentLayer } from './layers/TaskAssignmentLayer';
import { TaskTrackLayer } from './layers/TaskTrackLayer';
import { TransportNetworkLayer } from './layers/TransportNetworkLayer';

/**
 * 图层注册表
 * 统一管理所有可视化图层的实例化。
 */
export class LayerRegistry {
  private layers: Map<string, BaseLayer> = new Map();

  constructor(service: VisualLayoutService) {
    this.registerLayers(service);
  }

  /**
   * 注册所有的图层实例
   */
  private registerLayers(service: VisualLayoutService): void {
    this.register(new GlobalInfoLayer(service));
    this.register(new RoomInfoLayer(service));
    this.register(new TaskTrackLayer(service));
    this.register(new ConstructionPlannerLayer(service));
    this.register(new TaskAssignmentLayer(service));
    this.register(new TransportNetworkLayer(service));
  }

  /**
   * 注册一个图层
   * @param layer 图层实例
   */
  private register(layer: BaseLayer): void {
    if (this.layers.has(layer.getName())) {
      console.log(`警告: 图层名称冲突，重复注册: ${layer.getName()}`);
      return;
    }
    this.layers.set(layer.getName(), layer);
  }

  /**
   * 获取一个指定名称的图层
   * @param layerName 图层的名称
   * @returns 图层实例或 undefined
   */
  public getLayer(layerName: string): BaseLayer | undefined {
    return this.layers.get(layerName);
  }

  /**
   * 获取所有已注册的图层实例
   */
  public getAllLayers(): BaseLayer[] {
    return Array.from(this.layers.values());
  }
}
