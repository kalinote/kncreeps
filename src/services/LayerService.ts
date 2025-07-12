import { BaseService } from './BaseService';
import { EventBus } from '../core/EventBus';
import { ServiceContainer } from '../core/ServiceContainer';
import { VisualLayer } from '../visual/VisualLayer';
import { RoomInfoLayer } from '../visual/layers/RoomInfoLayer';
import { TaskTrackLayer } from '../visual/layers/TaskTrackLayer';
import { VisualConfig } from '../config/VisualConfig';
import { EventConfig } from '../config/EventConfig';
import { RoadPlanLayer } from '../visual/layers/RoadPlanLayer';

/**
 * 图层服务 - 负责管理所有可视化图层的生命周期和状态
 */
export class LayerService extends BaseService {
  private layers: Map<string, VisualLayer> = new Map();

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.initializeMemory();
    this.initializeLayers();
  }

  /**
   * 初始化内存
   */
  private initializeMemory(): void {
    if (!Memory.visuals) {
      Memory.visuals = {
        cache: null,
        lastUpdateTime: 0,
        layerSettings: {}
      };
    }

    if (!Memory.visuals.layerSettings) {
      Memory.visuals.layerSettings = {};
    }

    for (const layerName in VisualConfig.LAYER_DEFAULTS) {
      if (!Memory.visuals.layerSettings[layerName]) {
        Memory.visuals.layerSettings[layerName] =
          VisualConfig.LAYER_DEFAULTS[layerName as keyof typeof VisualConfig.LAYER_DEFAULTS];
      }
    }
  }

  /**
   * 初始化并注册所有图层
   */
  private initializeLayers(): void {
    this.registerLayer(new RoomInfoLayer(this.eventBus, this.serviceContainer));
    this.registerLayer(new TaskTrackLayer(this.eventBus, this.serviceContainer));
    this.registerLayer(new RoadPlanLayer(this.eventBus, this.serviceContainer));
  }

  /**
   * 注册一个图层
   */
  private registerLayer(layer: VisualLayer): void {
    this.layers.set(layer.getName(), layer);
  }

  /**
   * 设置事件监听
   */
  protected setupEventListeners(): void {
    this.on(EventConfig.EVENTS.VISUALS_DRAW_REQUEST, () => {
      this.renderAllActiveLayers();
    });
  }

  /**
   * 渲染所有当前已启用的图层
   */
  private renderAllActiveLayers(): void {
    const sortedLayers = Array.from(this.layers.values())
      .filter(layer => this.isLayerEnabled(layer.getName()))
      .sort((a, b) => a.getPriority() - b.getPriority());

    for (const layer of sortedLayers) {
      try {
        layer.render();
      } catch (error: any) {
        console.log(`[LayerService] 图层渲染失败: ${layer.getName()}: ${error.stack || error}`);
      }
    }
  }

  /**
   * 检查某个图层是否已启用
   */
  public isLayerEnabled(layerName: string): boolean {
    return Memory.visuals?.layerSettings[layerName]?.enabled ?? false;
  }

  /**
   * 切换图层的启用/禁用状态
   */
  public toggleLayer(layerName: string): boolean | undefined {
    if (Memory.visuals?.layerSettings[layerName]) {
      const currentStatus = Memory.visuals.layerSettings[layerName].enabled;
      Memory.visuals.layerSettings[layerName].enabled = !currentStatus;
      this.emit(EventConfig.EVENTS.LAYER_TOGGLED, {
        layerName,
        enabled: !currentStatus
      });
      return !currentStatus;
    }
    return undefined;
  }
}
