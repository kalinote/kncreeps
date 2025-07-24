import { BaseService } from './BaseService';
import { EventBus } from '../core/EventBus';
import { ServiceContainer } from '../core/ServiceContainer';
import { PlannerRegistry } from '../construct-planner/PlannerRegistry';
import { RoadPlanner } from '../construct-planner/planners/RoadPlanner';
import { ContainerPlanner } from '../construct-planner/planners/ContainerPlanner';
import { ConstructionStatus, RoadPlanInfo, RoadConstructionStatus, BuildingPlan } from '../types';
import { EventConfig } from '../config/EventConfig';

/**
 * 建筑规划服务 - 负责管理所有规划器的状态和事件触发
 */
export class ConstructPlannerService extends BaseService {
  // TODO 明确ConstructionManager和ConstructPlannerService的职责，并且PlannerRegistry只应该创建一次
  private plannerRegistry: PlannerRegistry;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.plannerRegistry = new PlannerRegistry();
  }

  /**
   * 获取道路规划信息
   */
  public getRoadPlanInfo(room: Room): RoadPlanInfo | null {
    const roadPlanner = this.plannerRegistry.getPlanner('road') as RoadPlanner;
    if (!roadPlanner) return null;

    return roadPlanner.getRoadPlanInfo(room);
  }

  /**
   * 获取道路建造状态
   */
  public getRoadConstructionStatus(room: Room): RoadConstructionStatus | null {
    const roadPlanner = this.plannerRegistry.getPlanner('road') as RoadPlanner;
    if (!roadPlanner) return null;

    return roadPlanner.getRoadConstructionStatus(room);
  }

  /**
   * 获取未建造的道路
   */
  public getUnbuiltRoads(room: Room): any[] {
    const roadPlanner = this.plannerRegistry.getPlanner('road') as RoadPlanner;
    if (!roadPlanner) return [];

    return roadPlanner.getUnbuiltRoads(room);
  }

  /**
   * 更新所有规划器的状态并触发相应事件
   */
  public updateConstructionStatus(): void {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (!room.controller?.my) continue;

      this.updateRoadConstructionStatus(room);
    }
  }

  /**
   * 获取container规划信息
   */
  public getContainerPlanInfo(room: Room): BuildingPlan[] {
    const containerPlanner = this.plannerRegistry.getPlanner('container') as ContainerPlanner;
    if (!containerPlanner) return [];

    return containerPlanner.plan(room);
  }

  /**
   * 获取container建造状态
   */
  public getContainerConstructionStatus(room: Room): { planned: number; underConstruction: number; completed: number } {
    const plans = this.getContainerPlanInfo(room);
    let planned = 0;
    let underConstruction = 0;
    let completed = 0;

    for (const plan of plans) {
      const pos = new RoomPosition(plan.pos.x, plan.pos.y, plan.pos.roomName);

      // 检查是否已存在该建筑
      const existingStructure = pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_CONTAINER);
      if (existingStructure) {
        completed++;
        continue;
      }

      // 检查是否有建造工地
      const constructionSite = pos.lookFor(LOOK_CONSTRUCTION_SITES).find(s => s.structureType === STRUCTURE_CONTAINER);
      if (constructionSite) {
        underConstruction++;
        continue;
      }

      // 否则为已规划状态
      planned++;
    }

    return { planned, underConstruction, completed };
  }

  /**
   * 更新道路建造状态并触发事件
   */
  private updateRoadConstructionStatus(room: Room): void {
    const status = this.getRoadConstructionStatus(room);
    if (!status) return;

    // 检查是否有新的建造工地
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter: site => site.structureType === STRUCTURE_ROAD
    });

    if (constructionSites.length > 0 && status.underConstructionSegments === 0) {
      // 发出建造开始事件
      this.emit(EventConfig.EVENTS.CONSTRUCTION_PLAN_UPDATED, {
        roomName: room.name,
        structureType: STRUCTURE_ROAD,
        status: 'construction_started'
      });
    }

    // 检查是否所有道路都已完成
    if (status.completedPositions === status.totalPositions && status.totalPositions > 0) {
      // 发出建造完成事件
      this.emit(EventConfig.EVENTS.CONSTRUCTION_PLAN_COMPLETED, {
        roomName: room.name,
        structureType: STRUCTURE_ROAD,
        status: 'completed'
      });
    }
  }
}
