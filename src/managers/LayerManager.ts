import { RoomInfoLayer } from './../visual/layers/RoomInfoLayer';
import { VisualLayer } from './../visual/VisualLayer';
import { BaseManager } from './BaseManager';
import { EventBus } from '../core/EventBus';
import { EventConfig } from '../config/EventConfig';
import { VisualConfig } from '../config/VisualConfig';
import { TaskTrackLayer } from '../visual/layers/TaskTrackLayer';

/**
 * 图层管理器 - 负责管理所有可视化图层的生命周期和状态
 */
export class LayerManager extends BaseManager {
  private layers: Map<string, VisualLayer> = new Map();

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.initializeMemory();
    this.initializeLayers();
    this.setupEventListeners();
  }

  /**
   * 初始化内存
   * 如果内存中没有图层设置，则使用配置文件中的默认值进行初始化
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

    // 检查并设置默认值
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
    // 这里我们先只注册 RoomInfoLayer 作为示例
    this.registerLayer(new RoomInfoLayer(this.eventBus));
    this.registerLayer(new TaskTrackLayer(this.eventBus));

    // TODO: 未来在这里注册更多图层
    // this.registerLayer(new PathLayer(this.eventBus));
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
  private setupEventListeners(): void {
    // 监听来自 VisualManager 的同步绘制请求
    this.eventBus.on(EventConfig.EVENTS.VISUALS_DRAW_REQUEST, () => {
      this.renderAllActiveLayers();
    });
  }

  /**
   * 管理器的主更新循环
   * 对于LayerManager，主要渲染逻辑由事件驱动，这里可以留空或用于未来的维护任务
   */
  public update(): void {
    if (!this.shouldUpdate()) {
      return;
    }

    // 当前无每tick都需要执行的任务

    this.updateCompleted();
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
      } catch (error) {
        console.log(`Error rendering layer ${layer.getName()}: ${error}`);
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
   * 切换图层的启用/禁用状态（为未来控制台命令预留）
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
