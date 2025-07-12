import { VisualLayer } from '../VisualLayer';
import { VisualConfig } from '../../config/VisualConfig';
import { ServiceContainer } from '../../core/ServiceContainer';
import { EventBus } from '../../core/EventBus';
import { ConstructPlannerService } from '../../services/ConstructPlannerService';
import { ConstructionStatus } from '../../types';

/**
 * 道路规划图层
 */
export class RoadPlanLayer extends VisualLayer {
  protected name: string = VisualConfig.LAYERS.ROAD_PLAN;
  private constructPlannerService: ConstructPlannerService;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.constructPlannerService = this.serviceContainer.get<ConstructPlannerService>('constructPlannerService');
    this.priority = VisualConfig.LAYER_DEFAULTS.RoadPlanLayer.priority;
  }

  /**
   * 渲染道路规划
   */
  public render(): void {
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
    this.renderStatistics(room, planInfo);
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

    // 绘制道路路径
    for (let i = 0; i < segment.positions.length - 1; i++) {
      const current = segment.positions[i];
      const next = segment.positions[i + 1];

      Game.map.visual.line(
        new RoomPosition(current.x, current.y, room.name),
        new RoomPosition(next.x, next.y, room.name),
        style
      );
    }

    // 在起点和终点添加标记
    if (segment.positions.length > 0) {
      const start = segment.positions[0];
      const end = segment.positions[segment.positions.length - 1];

      // 起点标记（Spawn）
      Game.map.visual.circle(
        new RoomPosition(start.x, start.y, room.name),
        { ...style, fill: 'transparent', radius: 0.3 }
      );

      // 终点标记（Source/Controller）
      Game.map.visual.circle(
        new RoomPosition(end.x, end.y, room.name),
        { ...style, fill: 'transparent', radius: 0.3 }
      );
    }
  }

  /**
   * 渲染统计信息
   */
  private renderStatistics(room: Room, planInfo: any): void {
    const status = this.constructPlannerService.getRoadConstructionStatus(room);
    if (!status) return;

    const text = `Roads: ${status.completedPositions}/${status.totalPositions}`;
    const color = status.completedPositions === status.totalPositions ? '#00FF00' : '#FFD700';

    Game.map.visual.text(text, new RoomPosition(2, 4, room.name), {
      color: color,
      fontSize: 0.6,
      align: 'left'
    });
  }
}
