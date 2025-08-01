import { BaseService } from "../BaseService";
import { EventBus } from "../../core/EventBus";
import { PlannerRegistry } from "../../construct-planner/PlannerRegistry";
import { RoadPlanner } from "../../construct-planner/planners/RoadPlanner";
import { ContainerPlanner } from "../../construct-planner/planners/ContainerPlanner";
import { RoadPlanInfo, RoadConstructionStatus, BuildingPlanMemory, RoomLayoutMemory } from "../../types";
import { EventConfig } from "../../config/EventConfig";
import { EventStrategyRegistry } from "../../construct-planner/EventStrategyRegistry";
import { ConstructionManager } from "../../managers/ConstructionManager";
import { GameConfig } from "config/GameConfig";
import { TransportService } from "../logistics/TransportService";

/**
 * 建筑规划服务 - 负责管理所有规划器的状态和事件触发
 */
export class ConstructPlannerService extends BaseService<{[roomName: string]: RoomLayoutMemory}, ConstructionManager> {
  public cleanup(): void {}

  private _plannerRegistry: PlannerRegistry;
  private _strategyRegistry: EventStrategyRegistry;

  public get plannerRegistry(): PlannerRegistry {
    return this._plannerRegistry;
  }

  public get strategyRegistry(): EventStrategyRegistry {
    return this._strategyRegistry;
  }

  public get transportService(): TransportService {
    return this.manager.transportService;
  }

  constructor(eventBus: EventBus, manager: ConstructionManager, memory: any) {
    super(eventBus, manager, memory, 'layouts');
    this._plannerRegistry = new PlannerRegistry(this);
    this._strategyRegistry = new EventStrategyRegistry();

  }

  public initialize(): void {
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
      this.memory[roomName] = {} as RoomLayoutMemory;
      this.memory[roomName].version = 1;
      this.memory[roomName].status = 'planning';
      this.memory[roomName].nextPlannerIndex = 0;
      this.memory[roomName].lastUpdated = Game.time;
      this.memory[roomName].buildings = {};
    }
  }

  public update(): void {
    // 使用一个较低的更新频率来减少CPU消耗
    // TODO 后续改成配置文件设置

    if (Game.time % 10 !== 0) return;

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller?.my) {
        // 1. 运行规划状态机
        this.runPlannerStateMachine(room);

        // 2. 运行建造决策逻辑
        this.runBuilder(room);

        // 3. 更新建造状态并触发事件
        this.updateConstructionStatus();
      }
    }
  }

  /**
   * 规划状态机
   * @param room 房间对象
   *
   * // TODO 后续考虑放到某个service中，不应该由manager来处理
   */
  private runPlannerStateMachine(room: Room): void {
    // 状态二：分步执行规划
    if (this.memory[room.name].status === 'planning') {
      const planningOrder = GameConfig.CONSTRUCTION.PLANNING_ORDER;
      if (this.memory[room.name].nextPlannerIndex >= planningOrder.length) {
        this.memory[room.name].status = 'done';
        console.log(`[Planner] 房间 ${room.name} 所有常规规划已完成。`);
        return;
      }

      const plannerName = planningOrder[this.memory[room.name].nextPlannerIndex];
      const planner = this.plannerRegistry.getPlanner(plannerName);

      if (planner) {
        console.log(`[Planner] 为 ${room.name} 执行 [${plannerName}] 规划...`);
        const plans = planner.plan(room);
        this.memory[room.name].buildings[planner.name] = plans;
      }

      this.memory[room.name].nextPlannerIndex++;
      this.memory[room.name].lastUpdated = Game.time;
    }
  }

  /**
   * 建造决策器
   * @param room 房间对象
   */
  private runBuilder(room: Room): void {
    if (!this.memory[room.name] || this.memory[room.name].status !== 'done') return;
    if (room.find(FIND_MY_CONSTRUCTION_SITES).length > 0) return;

    // 决策二：如果紧急建造无事可做（或没有紧急情况），则执行常规建造
    const buildStarted = this.tryBuild(room, this.memory[room.name], GameConfig.CONSTRUCTION.BUILD_PRIORITY_ORDER);

    // 如果开始建造，触发建造开始事件
    if (buildStarted) {
      // 检查具体开始建造的是什么类型的建筑
      const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);
      if (constructionSites.length > 0) {
        // 获取最新创建的工地
        const latestSite = constructionSites[constructionSites.length - 1];

        this.emit(EventConfig.EVENTS.CONSTRUCTION_PLAN_UPDATED, {
          roomName: room.name,
          structureType: latestSite.structureType,
          status: 'construction_started',
          position: { x: latestSite.pos.x, y: latestSite.pos.y }
        });
      }
    }
  }

  /**
   * 尝试根据给定的优先级列表建造一个建筑
   * @param room 房间
   * @param layout 蓝图
   * @param priorityList 规划器名称列表
   * @returns 是否成功创建了工地
   */
  private tryBuild(room: Room, layout: RoomLayoutMemory, priorityList: string[]): boolean {
    for (const plannerName of priorityList) {
      const buildingPlans = layout.buildings[plannerName] || [];

      for (const plan of buildingPlans) {
        const pos = new RoomPosition(plan.pos.x, plan.pos.y, room.name);
        const structureType = plan.structureType;

        const hasStructure = pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === structureType);
        const hasSite = pos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType === structureType);

        if (!hasStructure && !hasSite) {
          const result = pos.createConstructionSite(structureType);
          if (result === OK) {
            console.log(`[Builder] 在 [${pos.x},${pos.y}] 创建 ${structureType} 工地。`);

            const site = pos.lookFor(LOOK_CONSTRUCTION_SITES).find(s => s.structureType === structureType);
            if (site && plan.logisticsRole) {
                if (plan.logisticsRole === 'provider') {
                    this.transportService.setProvider(site, room.name, plan.resourceType || RESOURCE_ENERGY, 'underConstruction');
                } else if (plan.logisticsRole === 'consumer') {
                    this.transportService.setConsumer(site, room.name, plan.resourceType || RESOURCE_ENERGY);
                }
            }

            // 触发建造开始事件
            this.emit(EventConfig.EVENTS.CONSTRUCTION_PLAN_UPDATED, {
              roomName: room.name,
              structureType: structureType,
              status: 'construction_started',
              position: { x: pos.x, y: pos.y }
            });

            return true;
          }
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

    return layout.buildings.container;
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

  public getLayout(roomName: string): RoomLayoutMemory | null {
    return this.memory[roomName];
  }
}
