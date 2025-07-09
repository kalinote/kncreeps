import { EventBus } from '../core/EventBus';
import { BaseManager } from './BaseManager';
import { GameConfig } from '../config/GameConfig';
import { VisualConfig } from '../config/VisualConfig';
import { EventConfig } from '../config/EventConfig';

/**
 * 可视化管理器 - 负责渲染调度和缓存控制
 */
export class VisualManager extends BaseManager {
  constructor(eventBus: EventBus) {
    super(eventBus);
    this.initializeMemory();
  }

  /**
   * 初始化内存
   */
  private initializeMemory(): void {
    if (!Memory.visuals) {
      Memory.visuals = {
        cache: null,
        lastUpdateTime: 0,
        layerSettings: {} // layerSettings 由 LayerManager 初始化
      };
    }
    if (Memory.visuals.cache === undefined) {
      Memory.visuals.cache = null;
    }
    if (Memory.visuals.lastUpdateTime === undefined) {
      Memory.visuals.lastUpdateTime = 0;
    }
  }

  /**
   * 管理器主更新循环
   */
  public update(): void {
    if (!this.shouldUpdate()) {
      return;
    }

    this.safeExecute(() => {
      this.render();
    }, 'VisualManager.update');

    this.updateCompleted();
  }

  /**
   * 渲染总入口
   * 根据缓存和更新周期决定渲染方式
   */
  private render(): void {
    if (this.shouldRefreshData()) {
      this.renderFresh();
    } else {
      this.renderFromCache();
    }
  }

  /**
   * 检查是否需要强制刷新数据
   */
  private shouldRefreshData(): boolean {
    if (!Memory.visuals) return true;
    return Game.time - Memory.visuals.lastUpdateTime >= VisualConfig.UPDATE_INTERVAL;
  }

  /**
   * 从缓存渲染
   */
  private renderFromCache(): void {
    if (Memory.visuals?.cache) {
      Game.map.visual.import(Memory.visuals.cache);
    } else {
      // 如果缓存为空，则强制刷新
      this.renderFresh();
    }
  }

  /**
   * 重新计算数据并渲染
   */
  private renderFresh(): void {
    if (!Memory.visuals) return;

    // 1. 清除现有视觉效果
    Game.map.visual.clear();

    // 2. 发出同步事件，请求所有图层进行绘制
    this.eventBus.emitSync(EventConfig.EVENTS.VISUALS_DRAW_REQUEST);

    // 3. 导出并缓存新的视觉效果
    Memory.visuals.cache = Game.map.visual.export();
    Memory.visuals.lastUpdateTime = Game.time;

    // 4. 检查大小并发出刷新完成事件
    this.checkVisualSize();
    this.emit(EventConfig.EVENTS.VISUALS_REFRESHED, {
      size: Memory.visuals.cache.length,
      time: Game.time
    });
  }

  /**
   * 检查可视化数据大小
   */
  private checkVisualSize(): void {
    const currentSize = Game.map.visual.getSize();
    if (currentSize > VisualConfig.PERFORMANCE.MAX_VISUAL_SIZE) {
      console.log(`警告: 可视化数据大小 ${currentSize} 超过限制`);
      this.emit(EventConfig.EVENTS.VISUAL_OVERFLOW, { size: currentSize });
    }
  }

  /**
   * 强制刷新下一tick的视觉效果
   */
  public forceRefresh(): void {
    if (Memory.visuals) {
      Memory.visuals.lastUpdateTime = 0;
    }
  }
}
