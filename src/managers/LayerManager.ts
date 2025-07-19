import { EventConfig } from '../config/EventConfig';
import { EventBus } from '../core/EventBus';
import { ServiceContainer } from '../core/ServiceContainer';
import { VisualLayoutService } from '../services/VisualLayoutService';
import { LayerType } from '../types';
import { LayerRegistry } from '../visual/LayerRegistry';
import { BaseManager } from './BaseManager';

/**
 * 图层管理器
 * 负责响应渲染请求，并驱动所有图层的渲染流程。
 * TODO 这个manager的职责有待商榷，按理来说所有业务逻辑应该放在service中
 */
export class LayerManager extends BaseManager {
  private layerRegistry: LayerRegistry;
  private visualLayoutService: VisualLayoutService;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.layerRegistry = new LayerRegistry(eventBus, serviceContainer);
    this.visualLayoutService = serviceContainer.get('visualLayoutService');
  }

  protected setupEventListeners(): void {
    this.on(EventConfig.EVENTS.VISUALS_DRAW_REQUEST, () => {
      this.renderAllLayers();
    });
  }

  private renderAllLayers(): void {
    // 1. 为数据类图层计算布局
    const dataLayers = this.layerRegistry.getAllLayers().filter(l => l.layerType === LayerType.DATA && this.visualLayoutService.isLayerEnabled(l.getName()));
    const layoutMap = this.visualLayoutService.calculateLayout(dataLayers);

    // 2. 遍历所有可见房间
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (!room.controller?.my) continue;

      // 3. 获取该房间需要渲染的图层
      const activeLayers = this.layerRegistry.getAllLayers()
        .filter(layer => this.visualLayoutService.isLayerEnabled(layer.getName()))
        .sort((a, b) => a.getPriority() - b.getPriority());

      // 4. 渲染所有图层
      for (const layer of activeLayers) {
        try {
          if (layer.layerType === LayerType.DATA) {
            const offset = layoutMap.get(layer.getName());
            if (offset) {
              // console.log(`[LayerManager] 渲染图层: ${layer.getName()} 在房间 ${roomName} 的坐标: ${offset.x}, ${offset.y}`);
              layer.render(room, offset);
            }
          } else {
            layer.render(room);
          }
        } catch (error: any) {
          console.log(`[LayerManager] 图层渲染失败: ${layer.getName()} 在房间 ${roomName}: ${error.stack || error}`);
        }
      }
    }
  }

  public update(): void { }
}
