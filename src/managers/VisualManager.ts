import { RoomInfoLayer } from "../visual/layers/RoomInfoLayer";
import { EventBus } from "../core/EventBus";
import { BaseManager } from "./BaseManager";
import { VisualLayer } from "../visual/VisualLayer";
import { GameConfig } from "../config/GameConfig";
import { VisualConfig } from "../config/VisualConfig";
import { EventConfig } from "../config/EventConfig";

/**
 * TODO 可视化内容管理器
 */
export class VisualManager extends BaseManager {
  private layers: Map<string, VisualLayer> = new Map();
  private visualSize: number = 0;

  constructor(eventBus: EventBus) {
    super(eventBus);
    this.initializeLayers();
    this.setupEventListeners();
  }

  public update(): void {
    if (!this.shouldUpdate()) {
      return;
    }

    this.safeExecute(() => {
      // this.clearVisuals();
      this.renderLayers();
      this.checkVisualSize();
    }, 'VisualManager.update');

    this.updateCompleted();
  }


  /**
   * 初始化所有可视化层
   */
  private initializeLayers(): void {
    // 注册房间信息层
    this.registerLayer(new RoomInfoLayer(this.eventBus));

    // 后续可以添加更多层
    // this.registerLayer(new PathfindingLayer(this.eventBus));
    // this.registerLayer(new ConstructionLayer(this.eventBus));
  }

  /**
   * 注册可视化层
   */
  private registerLayer(layer: VisualLayer): void {
    this.layers.set(layer.getName(), layer);
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听房间能量变化事件
    this.on(GameConfig.EVENTS.ROOM_ENERGY_CHANGED, (data: any) => {
      // 可以触发特定层的更新
    });
  }

  /**
   * 渲染所有层
   */
  private renderLayers(): void {
    // 按优先级排序渲染
    const sortedLayers = Array.from(this.layers.values())
      .filter(layer => layer.isEnabled())
      .sort((a, b) => a.getPriority() - b.getPriority());

    for (const layer of sortedLayers) {
      layer.render();
    }
  }

  /**
   * 清除所有可视化内容
   * 每个tick游戏会自动清除，不需要手动调用这个
   */
  private clearVisuals(): void {
    Game.map.visual.clear();
    this.visualSize = 0;
  }

  /**
   * 检查可视化大小
   */
  private checkVisualSize(): void {
    const currentSize = Game.map.visual.getSize();
    if (currentSize > VisualConfig.PERFORMANCE.MAX_VISUAL_SIZE) {
      console.log(`警告: 可视化数据大小 ${currentSize} 超过限制`);
      this.emit(EventConfig.EVENTS.VISUAL_OVERFLOW, { size: currentSize });
    }
  }

  /**
   * 切换层的启用状态
   */
  public toggleLayer(layerName: string): void {
    const layer = this.layers.get(layerName);
    if (layer) {
      if (layer.isEnabled()) {
        layer.disable();
      } else {
        layer.enable();
      }
      this.emit(EventConfig.EVENTS.LAYER_TOGGLED, { layerName, enabled: layer.isEnabled() });
    }
  }

  /**
   * 获取所有层状态
   */
  public getLayersStatus(): any {
    const status: any = {};
    for (const [name, layer] of this.layers) {
      status[name] = {
        enabled: layer.isEnabled(),
        priority: layer.getPriority()
      };
    }
    return status;
  }
}
