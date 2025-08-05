import { EventBus } from '../core/EventBus';
import { BaseManager } from './BaseManager';
import { VisualConfig } from '../config/VisualConfig';
import { EventConfig } from '../config/EventConfig';
import { GameConfig } from '../config/GameConfig';
import { VisualManagerMemory, LayerType } from '../types';
import { Safe, SafeMemoryAccess } from '../utils/Decorators';
import { RoomManager } from './RoomManager';
import { ConstructionManager } from './ConstructionManager';
import { TaskManager } from './TaskManager';
import { ManagerContainer } from '../core/ManagerContainer';
import { VisualLayoutService } from '../services/visual/VisualLayoutService';
import { LayerRegistry } from '../visual/LayerRegistry';
import { LogisticsManager } from './LogisticsManager';

/**
 * 可视化管理器 - 负责渲染调度和缓存控制
 */
export class VisualManager extends BaseManager<VisualManagerMemory> {
  protected onCleanup(): void {}
  protected onReset(): void {}

  public get roomManager(): RoomManager {
    return this.managerContainer.get<RoomManager>('roomManager');
  }

  public get constructionManager(): ConstructionManager {
    return this.managerContainer.get<ConstructionManager>('constructionManager');
  }

  public get taskManager(): TaskManager {
    return this.managerContainer.get<TaskManager>('taskManager');
  }

  public get logisticsManager(): LogisticsManager {
    return this.managerContainer.get<LogisticsManager>('logisticsManager');
  }

  public get visualLayoutService(): VisualLayoutService {
    return this.services.get('visualLayoutService') as VisualLayoutService;
  }

  public get layerRegistry(): LayerRegistry {
    return this.visualLayoutService.layerRegistry;
  }

  constructor(eventBus: EventBus, managerContainer: ManagerContainer) {
    super(eventBus, managerContainer, 'visualManager');
    this.updateInterval = GameConfig.MANAGER_CONFIGS.VISUAL_MANAGER.UPDATE_INTERVAL;

    this.registerServices("visualLayoutService", new VisualLayoutService(eventBus, this, this.memory));
  }

  /**
   * 初始化内存
   */
  @Safe("VisualManager.initialize")
  protected onInitialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastUpdate = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
      this.memory.cache = null;
    }
  }

  protected setupEventListeners(): void {
    this.on(EventConfig.EVENTS.VISUALS_DRAW_REQUEST, () => {
      this.renderAllLayers();
    });
  }

  /**
   * 管理器主更新循环
   */
  protected onUpdate(): void {
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

  // TODO 这些功能应该放到一个service中，而不是在manager中执行
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
            const title = `${layer.getTitle()}`;
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

  /**
   * 强制刷新下一tick的视觉效果
   */
  public forceRefresh(): void {
    if (this.memory) {
      this.memory.lastUpdate = 0;
    }
  }
}
