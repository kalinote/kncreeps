import { BaseLayer } from './BaseLayer';
import { VisualConfig } from '../../config/VisualConfig';
import { ConstructionStatus, LayerType } from '../../types';
import { VisualLayoutService } from '../../services/visual/VisualLayoutService';
import { ConstructPlannerLayoutService } from '../../services/construction/ConstructPlannerLayoutService';

/**
 * 道路规划图层
 */
export class ConstructionPlannerLayer extends BaseLayer {
  protected name: string = "ConstructionPlannerLayer";
  protected title: string = "建筑规划";
  public layerType: LayerType = LayerType.MAP;

  protected get constructPlannerLayoutService(): ConstructPlannerLayoutService {
    return this.service.constructPlannerLayoutService;
  }

  constructor(service: VisualLayoutService) {
    super(service);
    this.priority = VisualConfig.LAYER_DEFAULTS.ConstructionPlannerLayer.priority;
  }

  /**
   * 渲染建筑规划
   */
  public render(room: Room): void {
    if (!this.constructPlannerLayoutService) {
      console.log('[ConstructionPlannerLayer] 未找到 ConstructPlannerService');
      return;
    }


    this.renderRoomRoadPlan(room);
    this.renderRoomContainerPlan(room);
    this.renderRoomExtensionPlan(room);
  }

  /**
   * 渲染单个房间的道路规划
   */
  private renderRoomRoadPlan(room: Room): void {
    const planInfo = this.constructPlannerLayoutService.getRoadPlanInfo(room);
    if (!planInfo || planInfo.segments.length === 0) {
      return;
    }

    const visual = new RoomVisual(room.name);

    // 遍历每个道路段并渲染
    for (const segment of planInfo.segments) {
      if (!segment.positions || segment.positions.length === 0) continue;

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
          continue; // 暂时不显示已完成的道路
        default:
          style = VisualConfig.STYLES.ROAD_PLAN_STYLE;
      }

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
  }

  /**
   * 渲染单个房间的container规划
   */
  private renderRoomContainerPlan(room: Room): void {
    const planInfo = this.constructPlannerLayoutService.getContainerPlanInfo(room);
    if (!planInfo || planInfo.length === 0) {
      return;
    }

    const visual = new RoomVisual(room.name);

    // 遍历每个container规划并渲染
    for (const plan of planInfo) {
      const pos = new RoomPosition(plan.pos.x, plan.pos.y, plan.pos.roomName);

      // 根据状态选择样式
      let style;
      let showLabel = true;

      // 检查是否已存在该建筑，如果已存在则跳过显示
      const existingStructure = pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_CONTAINER);
      if (existingStructure) {
        continue; // 跳过已完成的容器
      }

      // 检查是否有建造工地
      const constructionSite = pos.lookFor(LOOK_CONSTRUCTION_SITES).find(s => s.structureType === STRUCTURE_CONTAINER);
      if (constructionSite) {
        style = VisualConfig.STYLES.CONTAINER_UNDER_CONSTRUCTION_STYLE;
      } else {
        style = VisualConfig.STYLES.CONTAINER_PLAN_STYLE;
      }

      // 绘制容器位置（正方形）
      const size = 0.4;
      visual.rect(pos.x - size, pos.y - size, size * 2, size * 2, style);

      // 显示标签（仅对未完成的容器）
      if (showLabel) {
        let label = '';
        let labelColor = '#FFFFFF';

        // 根据后勤角色和资源类型设置标签
        switch (plan.logisticsRole) {
          case 'provider':
            if (plan.resourceType === RESOURCE_ENERGY) {
              label = 'E'; // Energy Provider
              labelColor = '#FFD700';
            } else {
              label = 'M'; // Mineral Provider
              labelColor = '#9370DB';
            }
            break;
          case 'consumer':
            label = 'C'; // Consumer
            labelColor = '#00FF00';
            break;
          default:
            label = '?';
        }

        // 绘制标签
        visual.text(label, pos.x, pos.y, {
          color: labelColor,
          font: 0.4,
          align: 'center',
          opacity: 0.9
        });
      }
    }
  }

  /**
   * 渲染单个房间的extension规划
   */
  private renderRoomExtensionPlan(room: Room): void {
    const planInfo = this.constructPlannerLayoutService.getExtensionPlanInfo(room);
    if (!planInfo || planInfo.length === 0) {
      return;
    }

    const visual = new RoomVisual(room.name);

    for (const plan of planInfo) {
      const pos = new RoomPosition(plan.pos.x, plan.pos.y, plan.pos.roomName);

      // 检查是否已存在该建筑，如果已存在则跳过显示
      const existingStructure = pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_EXTENSION);
      if (existingStructure) {
        continue; // 跳过已完成的扩展
      }

      // 检查是否有建造工地
      const constructionSite = pos.lookFor(LOOK_CONSTRUCTION_SITES).find(s => s.structureType === STRUCTURE_EXTENSION);

      // 根据建造状态选择颜色
      let strokeColor = '#FFFF00'; // 黄色圆环（规划中）
      if (constructionSite) {
        strokeColor = '#00FF00'; // 绿色圆环（正在建造）
      }

      // 绘制扩展位置（空心圆环）
      visual.circle(pos.x, pos.y, {
        fill: 'transparent',
        stroke: strokeColor,
        strokeWidth: 0.1,
        radius: 0.25,
        opacity: 0.4
      });
    }
  }
}
