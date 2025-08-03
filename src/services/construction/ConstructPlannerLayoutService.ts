import { BaseService } from "../BaseService";
import { EventBus } from "../../core/EventBus";
import { PlannerRegistry } from "../../construct-planner/PlannerRegistry";
import { RoadPlanner } from "../../construct-planner/planners/RoadPlanner";
import { ContainerPlanner } from "../../construct-planner/planners/ContainerPlanner";
import { RoadPlanInfo, RoadConstructionStatus, BuildingPlanMemory, ConstructServiceMemory, ConstructionManagerMemory, PlanningTaskMemory } from "../../types";
import { EventConfig } from "../../config/EventConfig";
import { ConstructionManager } from "../../managers/ConstructionManager";
import { GameConfig } from "config/GameConfig";
import { TransportService } from "../logistics/TransportService";

/**
 * 建筑规划服务 - 负责管理所有规划器的状态和事件触发
 */
export class ConstructPlannerLayoutService extends BaseService<{ [roomName: string]: ConstructServiceMemory }, ConstructionManager> {
  protected onCleanup(): void { }
  protected onReset(): void { }

  private _plannerRegistry: PlannerRegistry;

  public get plannerRegistry(): PlannerRegistry {
    return this._plannerRegistry;
  }

  public get transportService(): TransportService {
    return this.manager.transportService;
  }

  constructor(eventBus: EventBus, manager: ConstructionManager, memory: ConstructionManagerMemory) {
    super(eventBus, manager, memory, 'layouts');
    this._plannerRegistry = new PlannerRegistry(this);
  }

  protected onInitialize(): void {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        this.initializeRoomMemory(roomName);
      }
    }
  }

  private initializeRoomMemory(roomName: string): void {
    if (!this.memory[roomName]) {
      console.log(`[ConstructPlannerService] 初始化房间 ${roomName} 内存`);
      this.memory[roomName] = {} as ConstructServiceMemory;
      this.memory[roomName].initAt = Game.time;
      this.memory[roomName].lastUpdate = Game.time;
      this.memory[roomName].lastCleanup = Game.time;
      this.memory[roomName].errorCount = 0;
      this.memory[roomName].version = 1;
      this.memory[roomName].buildings = {};
    }
  }

  protected onUpdate(): void {
    // 1. 执行规划任务
    const queue = this.manager.constructPlannerStrategyService.getPlanningQueue();
    if (queue.length > 0) {
      const task = queue.shift()!; // 取出任务
      this.executePlanningTask(task);
      // 每个tick只执行一个规划任务，以分散CPU，所以这里可以 return
      // 如果不return，则会继续执行建造流程，取决于你的CPU预算
    }

    // 2. 执行建造流程 (可以设置节流阀)
    // 使用一个较低的更新频率来减少CPU消耗
    if (Game.time % 5 === 0) { // 你可以根据需要调整频率
      for (const roomName in this.memory) {
        const room = Game.rooms[roomName];
        if (room?.controller?.my) {
          this.runBuilder(room);
        }
      }
    }

    // 3. 状态更新 (可以保留，但建议也使用节流阀)
    if (Game.time % 20 === 0) { // 状态更新不需要太频繁
      this.updateConstructionStatus();
    }
  }


  /**
   * 规划状态机
   * @param room 房间对象
   */
  private executePlanningTask(task: PlanningTaskMemory): void {
    const planner = this._plannerRegistry.getPlanner(task.plannerName);
    const room = Game.rooms[task.context.roomName];
    if (!planner || !room) {
      console.log(`[LayoutService] 无法执行任务，Planner [${task.plannerName}] 或 Room [${task.context.roomName}] 不存在。`);
      return;
    }

    console.log(`[LayoutService] 执行规划: Planner [${planner.name}] for room ${room.name}`);
    // Planner的plan方法需要调整以接收context
    const newPlans = planner.plan(room, task.context);

    if (newPlans && newPlans.length > 0) {
      this.initializeRoomMemory(room.name); // 确保内存存在
      const layout = this.memory[room.name];
      for (const plan of newPlans) {
        const structureType = plan.structureType;
        if (!layout.buildings[structureType]) {
          layout.buildings[structureType] = [];
        }
        // 可选：检查重复的规划位置，防止重复添加
        const isDuplicate = layout.buildings[structureType]!.some(p => p.pos.x === plan.pos.x && p.pos.y === plan.pos.y);
        if (!isDuplicate) {
          layout.buildings[structureType]!.push(plan);
        }
      }
      console.log(`[LayoutService] [${planner.name}] 为 ${room.name} 生成了 ${newPlans.length} 个新建筑蓝图。`);
      layout.lastUpdate = Game.time;
    }
  }

  /**
   * 建造决策器
   * @param room 房间对象
   */
  private runBuilder(room: Room): void {
    const layout = this.memory[room.name];
    if (!layout || room.find(FIND_MY_CONSTRUCTION_SITES).length > 0) {
      return;
    }

    const buildPriorityOrder = GameConfig.CONSTRUCTION.BUILD_PRIORITY_ORDER as BuildableStructureConstant[];
    this.tryBuild(room, layout, buildPriorityOrder);
  }

  /**
   * 尝试根据给定的优先级列表建造一个建筑
   * @param room 房间
   * @param layout 蓝图
   * @param priorityList 建筑类型的优先级列表
   * @returns 是否成功创建了工地
   */
  private tryBuild(room: Room, layout: ConstructServiceMemory, priorityList: BuildableStructureConstant[]): boolean {
    for (const structureType of priorityList) {
      const buildingPlans = layout.buildings[structureType] || [];

      for (const plan of buildingPlans) {
        const pos = new RoomPosition(plan.pos.x, plan.pos.y, room.name);

        const hasStructure = pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === structureType);
        if (hasStructure) continue;

        const hasSite = pos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType === structureType);
        if (hasSite) continue;

        const result = pos.createConstructionSite(structureType);
        if (result === OK) {
          console.log(`[Builder] 在 [${pos.x},${pos.y}] 创建 ${structureType} 工地。`);

          const site = pos.lookFor(LOOK_CONSTRUCTION_SITES).find(s => s.structureType === structureType);
          if (site && plan.logisticsRole && plan.logisticsRole !== 'non_logistics_management_building') {
            if (plan.logisticsRole === 'provider') {
              this.transportService.setProvider(site, room.name, plan.resourceType || RESOURCE_ENERGY, 'underConstruction');
            } else if (plan.logisticsRole === 'consumer') {
              this.transportService.setConsumer(site, room.name, plan.resourceType || RESOURCE_ENERGY);
            }
          }

          this.emit(EventConfig.EVENTS.CONSTRUCTION_PLAN_UPDATED, {
            roomName: room.name,
            structureType: structureType,
            position: { x: pos.x, y: pos.y }
          });

          return true; // 成功创建一个工地后立即返回
        }
      }
    }
    return false;
  }


  /**
   * 获取道路规划信息
   */
  public getRoadPlanInfo(room: Room): RoadPlanInfo | null {
    const roadPlanner = this._plannerRegistry.getPlanner('road') as RoadPlanner;
    if (!roadPlanner) return null;

    return roadPlanner.getRoadPlanInfo(room);
  }

  /**
   * 获取道路建造状态
   */
  public getRoadConstructionStatus(room: Room): RoadConstructionStatus | null {
    const roadPlanner = this._plannerRegistry.getPlanner('road') as RoadPlanner;
    if (!roadPlanner) return null;

    return roadPlanner.getRoadConstructionStatus(room);
  }

  /**
   * 获取未建造的道路
   */
  public getUnbuiltRoads(room: Room): any[] {
    const roadPlanner = this._plannerRegistry.getPlanner('road') as RoadPlanner;
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
  public getContainerPlanInfo(room: Room): BuildingPlanMemory[] {
    const containerPlanner = this._plannerRegistry.getPlanner('container') as ContainerPlanner;
    if (!containerPlanner) return [];

    const layout = this.getLayout(room.name);
    if (!layout) return [];

    return layout.buildings.container || [];
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

  public getLayout(roomName: string): ConstructServiceMemory | null {
    return this.memory[roomName];
  }
}
