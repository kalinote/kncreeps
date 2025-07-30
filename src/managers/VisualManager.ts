import { EventBus } from '../core/EventBus';
import { BaseManager } from './BaseManager';
import { VisualConfig } from '../config/VisualConfig';
import { EventConfig } from '../config/EventConfig';
import { GameConfig } from '../config/GameConfig';
import { VisualManagerMemory } from 'types';
import { Safe, SafeMemoryAccess } from '../utils/Decorators';

/**
 * 可视化管理器 - 负责渲染调度和缓存控制
 */
export class VisualManager extends BaseManager<VisualManagerMemory> {
  protected readonly memoryKey: string = 'visualManager';

  public cleanup(): void {}

  constructor(eventBus: EventBus, serviceContainer: any) {
    super(eventBus, serviceContainer);
    this.updateInterval = GameConfig.MANAGER_CONFIGS.VISUAL_MANAGER.UPDATE_INTERVAL;
  }

  /**
   * 初始化内存
   */
  @Safe("VisualManager.initialize")
  public initialize(): void {
    if (!this.memory.initAt) {
      this.memory = {
        initAt: Game.time,
        lastUpdate: Game.time,
        lastCleanup: Game.time,
        errorCount: 0,
        cache: null
      };
    }
  }

  /**
   * 管理器主更新循环
   */
  public updateManager(): void {
    this.render();
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
    if (!this.memory) return true;
    return Game.time - this.memory.lastUpdate >= VisualConfig.UPDATE_INTERVAL;
  }

  /**
   * 从缓存渲染
   */
  @Safe("VisualManager.renderFromCache")
  @SafeMemoryAccess("VisualManager.renderFromCache")
  private renderFromCache(): void {
    if (this.memory.cache) {
      Game.map.visual.import(this.memory.cache);
    } else {
      // 如果缓存为空，则强制刷新
      this.renderFresh();
    }
  }

  /**
   * 重新计算数据并渲染
   */
  @Safe("VisualManager.renderFresh")
  @SafeMemoryAccess("VisualManager.renderFresh")
  private renderFresh(): void {
    // 1. 清除现有视觉效果
    Game.map.visual.clear();

    // 2. 发出同步事件，请求所有图层进行绘制
    this.eventBus.emitSync(EventConfig.EVENTS.VISUALS_DRAW_REQUEST);

    // 3. 导出并缓存新的视觉效果
    this.memory.cache = Game.map.visual.export();
    this.memory.lastUpdate = Game.time;

    // 4. 检查大小并发出刷新完成事件
    this.checkVisualSize();
    this.emit(EventConfig.EVENTS.VISUALS_REFRESHED, {
      size: this.memory.cache.length,
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
    if (this.memory) {
      this.memory.lastUpdate = 0;
    }
  }
}
