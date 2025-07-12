import { BaseService } from './BaseService';
import { EventBus } from '../core/EventBus';
import { ServiceContainer } from '../core/ServiceContainer';
import { VisualConfig, DATA_LAYER_LAYOUTS } from '../config/VisualConfig';
import { EventConfig } from '../config/EventConfig';
import { BaseLayer } from '../visual/layers/BaseLayer';

/**
 * 视觉布局服务
 * 负责计算图层布局和管理图层状态。
 */
export class VisualLayoutService extends BaseService {
  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.initializeMemory();
  }

  /**
   * 初始化内存，确保所有图层都有默认的启用/禁用设置
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
    // 注意：这里我们假设 VisualConfig.LAYER_DEFAULTS 仍然存在且有效
    for (const layerName in VisualConfig.LAYER_DEFAULTS) {
      if (Memory.visuals.layerSettings[layerName] === undefined) {
        Memory.visuals.layerSettings[layerName] =
          VisualConfig.LAYER_DEFAULTS[layerName as keyof typeof VisualConfig.LAYER_DEFAULTS];
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
   * 设置图层的启用/禁用状态 (用于控制台指令)
   */
  public setLayerEnabled(layerName: string, enabled: boolean): boolean {
    if (Memory.visuals?.layerSettings[layerName]) {
      Memory.visuals.layerSettings[layerName].enabled = enabled;
      this.emit(EventConfig.EVENTS.LAYER_TOGGLED, { layerName, enabled });
      console.log(`[VisualLayoutService] 图层 '${layerName}' 已设置为 ${enabled ? '启用' : '禁用'}.`);
      return true;
    }
    console.log(`[VisualLayoutService] 错误: 未找到名为 '${layerName}' 的图层配置。`);
    return false;
  }

  /**
   * 计算所有数据类图层的布局
   * @param dataLayers 需要计算布局的数据图层数组
   * @param visual RoomVisual 对象，用于尺寸计算
   * @returns 返回一个 Map，键是图层名，值是其渲染的起始坐标 {x, y}
   */
  public calculateLayout(dataLayers: BaseLayer[], visual: RoomVisual): Map<string, { x: number; y: number }> {
    const layoutMap = new Map<string, { x: number; y: number }>();
    const anchorGroups: { [anchorKey: string]: BaseLayer[] } = {};

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

        layoutMap.set(layer.getName(), { x: startX, y: startY + cumulativeOffsetY });

        // 累加高度，为下一个图层做准备
        // TODO 优化计算方法
        const dimensions = layer.calculateDimensions(visual);
        cumulativeOffsetY += dimensions.height + 0.8; // 暂时固定间距为0.8
      }
    }

    return layoutMap;
  }

  protected setupEventListeners(): void {
    // 此服务现在不再需要监听任何事件
  }
}
