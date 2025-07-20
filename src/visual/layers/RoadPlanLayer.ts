import { BaseLayer } from './BaseLayer';
import { VisualConfig } from '../../config/VisualConfig';
import { ServiceContainer } from '../../core/ServiceContainer';
import { EventBus } from '../../core/EventBus';
import { ConstructPlannerService } from '../../services/ConstructPlannerService';
import { ConstructionStatus, LayerType } from '../../types';

/**
 * 道路规划图层
 */
export class RoadPlanLayer extends BaseLayer {
  protected name: string = "RoadPlanLayer";
  protected title: string = "道路规划";
  public layerType: LayerType = LayerType.MAP;
  private constructPlannerService: ConstructPlannerService;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.constructPlannerService = this.serviceContainer.get<ConstructPlannerService>('constructPlannerService');
    this.priority = VisualConfig.LAYER_DEFAULTS.RoadPlanLayer.priority;
  }

  /**
   * 渲染道路规划
   */
  public render(room: Room): void {
    if (!this.constructPlannerService) {
      console.log('[RoadPlanLayer] ConstructPlannerService not found');
      return;
    }

    // 获取所有我的房间
    const myRooms = Object.values(Game.rooms).filter(room => room.controller?.my);

    for (const room of myRooms) {
      this.renderRoomRoadPlan(room);
    }
  }

  /**
   * 渲染单个房间的道路规划
   */
  private renderRoomRoadPlan(room: Room): void {
    const planInfo = this.constructPlannerService.getRoadPlanInfo(room);
    if (!planInfo || planInfo.segments.length === 0) {
      return;
    }

    // 渲染每个道路段
    for (const segment of planInfo.segments) {
      this.renderRoadSegment(room, segment);
    }

    // 显示统计信息
    // this.renderStatistics(room, planInfo);
  }

  /**
   * 渲染单个道路段
   */
  private renderRoadSegment(room: Room, segment: any): void {
    if (segment.positions.length === 0) return;

    // 根据状态选择样式
    let style;
    switch (segment.status) {
      case ConstructionStatus.PLANNED:
        style = VisualConfig.STYLES.ROAD_PLAN_STYLE;
        break;
      case ConstructionStatus.UNDER_CONSTRUCTION:
        style = VisualConfig.STYLES.ROAD_UNDER_CONSTRUCTION_STYLE;
        break;
      case ConstructionStatus.COMPLETED:
        // 可选：是否显示已完成的道路
        // style = VisualConfig.STYLES.ROAD_COMPLETED_STYLE;
        return; // 暂时不显示已完成的道路
      default:
        style = VisualConfig.STYLES.ROAD_PLAN_STYLE;
    }

    // 使用RoomVisual进行绘制
    const visual = new RoomVisual(room.name);

    // 绘制道路路径
    for (let i = 0; i < segment.positions.length - 1; i++) {
      const current = segment.positions[i];
      const next = segment.positions[i + 1];

      visual.line(current.x, current.y, next.x, next.y, style);
    }

    // 在起点和终点添加标记
    if (segment.positions.length > 0) {
      const start = segment.positions[0];
      const end = segment.positions[segment.positions.length - 1];

      // 起点标记（Spawn）
      visual.circle(start.x, start.y, { ...style, fill: 'transparent', radius: 0.3 });

      // 终点标记（Source/Controller）
      visual.circle(end.x, end.y, { ...style, fill: 'transparent', radius: 0.3 });
    }
  }

  /**
   * 渲染统计信息
   * 暂时不显示，后续放到一个统一的统计图层中
   */
  private renderStatistics(room: Room, planInfo: any): void {
    const status = this.constructPlannerService.getRoadConstructionStatus(room);
    if (!status) return;

    const text = `Roads: ${status.completedPositions}/${status.totalPositions}`;
    const color = status.completedPositions === status.totalPositions ? '#00FF00' : '#FFD700';

    const visual = new RoomVisual(room.name);
    visual.text(text, 2, 4, {
      color: color,
      font: 0.6,
      align: 'left'
    });
  }
}
