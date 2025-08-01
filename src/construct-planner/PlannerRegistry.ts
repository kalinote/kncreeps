import { BasePlanner } from "./planners/BasePlanner";
import { ContainerPlanner } from "./planners/ContainerPlanner";
import { ExtensionPlanner } from "./planners/ExtensionPlanner";
import { RoadPlanner } from "./planners/RoadPlanner";
import { ConstructPlannerService } from '../services/construction/ConstructPlannerService';
/**
 * 规划器注册表
 * 统一管理所有的建筑规划器。
 */
export class PlannerRegistry {
  private planners: Map<string, BasePlanner> = new Map();
  private service: ConstructPlannerService;

  constructor(service: ConstructPlannerService) {
    this.service = service;
    this.registerPlanners();
  }

  /**
   * 注册所有的规划器实例
   */
  private registerPlanners(): void {
    this.register(new RoadPlanner(this.service));
    this.register(new ContainerPlanner(this.service));
    this.register(new ExtensionPlanner(this.service));
  }

  /**
   * 注册一个规划器
   * @param planner 规划器实例
   */
  private register(planner: BasePlanner): void {
    this.planners.set(planner.name, planner);
  }

  /**
   * 获取一个指定名称的规划器
   * @param plannerName 规划器的名称
   * @returns 规划器实例或 undefined
   */
  public getPlanner(plannerName: string): BasePlanner | undefined {
    return this.planners.get(plannerName);
  }

  /**
   * 获取所有已注册的规划器实例
   */
  public getAllPlanners(): BasePlanner[] {
    return Array.from(this.planners.values());
  }
}
