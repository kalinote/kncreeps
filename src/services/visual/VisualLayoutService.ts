import { BaseService } from '../BaseService';
import { VisualConfig, DATA_LAYER_LAYOUTS } from '../../config/VisualConfig';
import { EventConfig } from '../../config/EventConfig';
import { BaseLayer } from '../../visual/layers/BaseLayer';
import { LayerSettingsMemory } from '../../types';
import { EventBus } from '../../core/EventBus';
import { VisualManager } from '../../managers/VisualManager';
import { RoomService } from '../room/RoomService';
import { ConstructPlannerLayoutService } from '../construction/ConstructPlannerLayoutService';
import { TaskStateService } from '../task/TaskStateService';
import { LayerRegistry } from '../../visual/LayerRegistry';
import { TransportService } from '../logistics/TransportService';

/**
 * 视觉布局服务
 * 负责计算图层布局和管理图层状态。
 */
export class VisualLayoutService extends BaseService<{ [layerName: string]: LayerSettingsMemory }, VisualManager> {
  protected onUpdate(): void {}
  protected onCleanup(): void {}
  protected onReset(): void {}

  private _layerRegistry: LayerRegistry;

  public get roomService(): RoomService {
    return this.manager.roomManager.roomService;
  }

  public get constructPlannerLayoutService(): ConstructPlannerLayoutService {
    return this.manager.constructionManager.constructPlannerLayoutService;
  }

  public get taskStateService(): TaskStateService {
    return this.manager.taskManager.taskStateService;
  }

  public get transportService(): TransportService {
    return this.manager.logisticsManager.transportService;
  }

  public get layerRegistry(): LayerRegistry {
    return this._layerRegistry;
  }

  constructor(eventBus: EventBus, manager: VisualManager, memory: any) {
    super(eventBus, manager, memory, 'layerSettings');
    this._layerRegistry = new LayerRegistry(this);
  }

  /**
   * 初始化内存，确保所有图层都有默认的启用/禁用设置
   */
  protected onInitialize(): void {
    for (const layerName in VisualConfig.LAYER_DEFAULTS) {
      if (!this.memory[layerName]) {
        this.memory[layerName] = VisualConfig.LAYER_DEFAULTS[layerName as keyof typeof VisualConfig.LAYER_DEFAULTS] as LayerSettingsMemory;
      }
    }
  }

  /**
   * 检查某个图层是否已启用
   */
  public isLayerEnabled(layerName: string): boolean {
    return this.memory[layerName]?.enabled ?? false;
  }

  /**
   * 设置图层的启用/禁用状态 (用于控制台指令)
   */
  public setLayerEnabled(layerName: string, enabled: boolean): boolean {
    if (this.memory[layerName]) {
      this.memory[layerName].enabled = enabled;
      this.emit(EventConfig.EVENTS.LAYER_TOGGLED, { layerName, enabled });
      console.log(`[VisualLayoutService] 图层 '${layerName}' 已设置为 ${enabled ? '启用' : '禁用'}.`);
      return true;
    }
    console.log(`[VisualLayoutService] 错误: 未找到名为 '${layerName}' 的图层配置。`);
    return false;
  }

  /**
   * 计算所有数据类图层的布局
   */
  public calculateLayout(dataLayers: BaseLayer[]): Map<string, { x: number; y: number; width: number; height: number }> {
    const layoutMap = new Map<string, { x: number; y: number; width: number; height: number }>();
    const anchorGroups: { [anchorKey: string]: BaseLayer[] } = {};

    for (const roomName in Game.rooms) {
      // 1. 按锚点分组
      for (const layer of dataLayers) {
        const layoutConfig = DATA_LAYER_LAYOUTS[layer.getName()];
        if (!layoutConfig) continue;

        const anchorKey = Object.keys(layoutConfig.anchor).join(','); // e.g., "0,0" for TOP_LEFT
        if (!anchorGroups[anchorKey]) {
          anchorGroups[anchorKey] = [];
        }
        anchorGroups[anchorKey].push(layer);
      }

      // 2. 对每个锚点分组进行布局计算
      for (const anchorKey in anchorGroups) {
        const layersInGroup = anchorGroups[anchorKey];
        const layoutConfigSample = DATA_LAYER_LAYOUTS[layersInGroup[0].getName()];
        const anchor = layoutConfigSample.anchor;

        // 按 order 排序
        layersInGroup.sort((a, b) => {
          const orderA = DATA_LAYER_LAYOUTS[a.getName()]?.order ?? 99;
          const orderB = DATA_LAYER_LAYOUTS[b.getName()]?.order ?? 99;
          return orderA - orderB;
        });

        let cumulativeOffsetY = 0;

        // 3. 遍历排序后的图层，计算最终坐标
        for (const layer of layersInGroup) {
          const config = DATA_LAYER_LAYOUTS[layer.getName()];
          const padding = config.padding || { x: 0, y: 0 };

          // 计算起始坐标
          const startX = anchor.x === 1 ? 49.5 + padding.x : anchor.x + padding.x;
          const startY = anchor.y === 1 ? 49.5 + padding.y : anchor.y + padding.y;

          // 累加高度，为下一个图层做准备
          // TODO 优化计算方法
          layer.preRender(Game.rooms[roomName]);
          const dimensions = layer.calculateDimensions();

          layoutMap.set(layer.getName(), { x: startX, y: startY + cumulativeOffsetY, width: dimensions.width, height: dimensions.height + 1.2 /* 标题高度 */ });

          // console.log(`[VisualLayoutService] layer: ${layer.getName()} dimensions: ${dimensions.height}`);
          cumulativeOffsetY += dimensions.height + 1.2; // 标题高度
        }
      }
    }

    return layoutMap;
  }

  protected setupEventListeners(): void {
    // 此服务现在不再需要监听任何事件
  }
}
