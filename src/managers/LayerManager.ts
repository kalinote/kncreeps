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

            // 4.1 数据类图层绘制窗口
            const title = `${layer.getName()}`;
            const window = new RoomVisual(roomName);
            window.rect(offset!.x, offset!.y - 0.8 /* 去掉标题高度 */, offset!.width, offset!.height, { fill: '#000000', opacity: 0.5, stroke: '#FFFFFF', strokeWidth: 0.1 });
            window.text(title, offset!.x + 0.25 /* 左边距 */, offset!.y, { color: '#FFFFFF', font: 0.8 , align: "left"});
            window.line(offset!.x, offset!.y + 0.35/* 这个值暂时是随便定的 */, offset!.x + offset!.width, offset!.y + 0.35, { color: '#FFFFFF', width: 0.05 });

            if (offset) {
              // console.log(`[LayerManager] 渲染图层: ${layer.getName()} 在房间 ${roomName} 的坐标: ${offset.x}, ${offset.y}`);
              layer.render(room, {x: offset!.x + 0.5, y: offset!.y + 1.2 /* 标题高度 */});
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
