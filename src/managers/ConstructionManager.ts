import { BaseManager } from "./BaseManager";
import { EventBus } from "../core/EventBus";
import { ServiceContainer } from "../core/ServiceContainer";
import { GameConfig } from "../config/GameConfig";
import { PlannerRegistry } from "../construct-planner/PlannerRegistry";
import { EventStrategyRegistry } from "../construct-planner/EventStrategyRegistry";
import { RoomLayout } from "../types";
import { ConstructPlannerService } from "../services/ConstructPlannerService";
import { EventConfig } from "../config/EventConfig";

/**
 * 建筑管理器
 * 负责驱动建筑规划和创建建筑工地。
 */
export class ConstructionManager extends BaseManager {
  private plannerRegistry: PlannerRegistry;
  private strategyRegistry: EventStrategyRegistry;
  private constructPlannerService: ConstructPlannerService;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.plannerRegistry = new PlannerRegistry();
    this.strategyRegistry = new EventStrategyRegistry();
    this.constructPlannerService = serviceContainer.get('constructPlannerService') as ConstructPlannerService;

    // 修复运行时错误：直接在此处设置事件监听，而不是在被父类构造函数过早调用的重写方法中
    for (const eventType of this.strategyRegistry.getMonitoredEvents()) {
      this.on(eventType, (data: any) => this.handleEmergencyEvent(eventType, data));
    }
    // 监听RCL等级变化事件
    // this.on(GameConfig.EVENTS.RCL_LEVEL_CHANGED, (data: any) => this.handleRclChange(data));
  }

  /**
   * 设置事件监听
   */
  protected setupEventListeners(): void {
    // 监听建造完成事件
    this.on(EventConfig.EVENTS.CONSTRUCTION_COMPLETED, (data: any) => {
      this.handleConstructionCompleted(data);
    });
  }

  private initializeMemory(): void {
    if (!Memory.constructPlanner) {
      Memory.constructPlanner = {
        layouts: {},
        lastRun: Game.time
      };
    }
  }

  public update(): void {
    this.initializeMemory();
    // 使用一个较低的更新频率来减少CPU消耗
    if (Game.time % 10 !== 0) return;

    this.safeExecute(() => {
      for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (room.controller?.my) {
          // 1. 运行规划状态机
          this.runPlannerStateMachine(room);
          // 2. 运行建造决策逻辑
          this.runBuilder(room);
          // 3. 更新建造状态并触发事件
          this.constructPlannerService.updateConstructionStatus();
        }
      }
    }, 'ConstructionManager.update');
  }

  /**
   * 规划状态机
   * @param room 房间对象
   */
  private runPlannerStateMachine(room: Room): void {
    let layout = Memory.constructPlanner!.layouts[room.name];

    // 状态一：初始化规划
    if (!layout) {
      if (!room.controller) return;

      // 记录首次尝试规划的时间
      if (room.memory.planningAttemptedAt === undefined) {
        room.memory.planningAttemptedAt = Game.time;
      }
      // 检查是否达到了延迟规划的时间
      if (Game.time - room.memory.planningAttemptedAt < GameConfig.CONSTRUCTION.PLANNING_DELAY) {
        return;
      }

      console.log(`[Planner] 初始化房间 ${room.name} 的规划蓝图。`);
      layout = {
        version: 1,
        status: 'planning',
        nextPlannerIndex: 0,
        lastUpdated: Game.time,
        buildings: {}
      };
      Memory.constructPlanner!.layouts[room.name] = layout;
      return;
    }

    // 状态二：分步执行规划
    if (layout.status === 'planning') {
      const planningOrder = GameConfig.CONSTRUCTION.PLANNING_ORDER;
      if (layout.nextPlannerIndex >= planningOrder.length) {
        layout.status = 'done';
        console.log(`[Planner] 房间 ${room.name} 所有常规规划已完成。`);
        return;
      }

      const plannerName = planningOrder[layout.nextPlannerIndex];
      const planner = this.plannerRegistry.getPlanner(plannerName);

      if (planner) {
        console.log(`[Planner] 为 ${room.name} 执行 [${plannerName}] 规划...`);
        const positions = planner.plan(room);
        layout.buildings[planner.name] = positions.map(p => ({
          pos: { x: p.x, y: p.y, roomName: room.name }
        }));
      }

      layout.nextPlannerIndex++;
      layout.lastUpdated = Game.time;
    }
  }

  /**
   * 建造决策器
   * @param room 房间对象
   */
  private runBuilder(room: Room): void {
    const layout = Memory.constructPlanner!.layouts[room.name];
    if (!layout || layout.status !== 'done') return;

    // 修复紧急状态解除逻辑：在建造前检查是否可以清除紧急状态
    if (room.memory.activeConstructionStrategy) {
      // 当前只处理“受攻击”事件，其解除条件是敌人消失
      if (room.memory.activeConstructionStrategy === GameConfig.EVENTS.ROOM_UNDER_ATTACK) {
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        if (hostiles.length === 0) {
          console.log(`[Emergency] 房间 ${room.name} 威胁已解除，恢复常规建造流程。`);
          delete room.memory.activeConstructionStrategy;
        }
      }
    }

    if (room.find(FIND_MY_CONSTRUCTION_SITES).length > 0) return;

    // 决策一：如果处于紧急策略中，优先尝试执行紧急建造
    if (room.memory.activeConstructionStrategy) {
      const strategy = this.strategyRegistry.getStrategy(room.memory.activeConstructionStrategy);
      if (strategy) {
        // 尝试进行紧急建造，如果成功创建了工地，则本轮结束
        const emergencyBuildStarted = this.tryBuild(room, layout, strategy.priorityPlanners);
        if (emergencyBuildStarted) {
          return;
        }
      }
    }

    // 决策二：如果紧急建造无事可做（或没有紧急情况），则执行常规建造
    const buildStarted = this.tryBuild(room, layout, GameConfig.CONSTRUCTION.BUILD_PRIORITY_ORDER);

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
  private tryBuild(room: Room, layout: RoomLayout, priorityList: string[]): boolean {
    for (const plannerName of priorityList) {
      const planner = this.plannerRegistry.getPlanner(plannerName);
      if (!planner) continue;

      const positions = layout.buildings[planner.name] || [];
      const structureType = planner.structureType;

      for (const sPos of positions) {
        const pos = new RoomPosition(sPos.pos.x, sPos.pos.y, room.name);
        const hasStructure = pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === structureType);
        const hasSite = pos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType === structureType);

        if (!hasStructure && !hasSite) {
          const result = pos.createConstructionSite(structureType);
          if (result === OK) {
            console.log(`[Builder] 在 [${pos.x},${pos.y}] 创建 ${structureType} 工地。`);

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
   * 处理紧急事件
   * @param eventType 事件类型
   * @param data 事件数据
   */
  private handleEmergencyEvent(eventType: string, data: any): void {
    const roomName = data.roomName;
    if (!roomName) return;

    const room = Game.rooms[roomName];
    if (!room) return;

    const strategy = this.strategyRegistry.getStrategy(eventType);
    if (!strategy) return;

    console.log(`[Emergency] 房间 ${roomName} 触发紧急策略: ${strategy.name}`);

    // 激活策略
    room.memory.activeConstructionStrategy = eventType;

    // 如果需要，立即触发一次快速规划
    if (strategy.triggerPlanner) {
      console.log(`[Emergency] 为 ${roomName} 触发快速防御规划...`);
      const layout = Memory.constructPlanner!.layouts[roomName];
      // 确保布局已初始化
      if (!layout) {
        console.log(`[Emergency] 无法执行快速规划：房间 ${roomName} 尚未有基础布局。`);
        return;
      }

      for (const plannerName of strategy.priorityPlanners) {
        const planner = this.plannerRegistry.getPlanner(plannerName);
        if (planner) {
          console.log(`[Emergency] 正在规划 [${plannerName}]...`);
          const positions = planner.plan(room);
          // 更新或覆盖布局中的相应建筑部分
          layout.buildings[planner.name] = positions.map(p => ({
            pos: { x: p.x, y: p.y, roomName: room.name }
          }));
          console.log(`[Emergency] 规划了 ${positions.length} 个 [${plannerName}]。`);
        }
      }
      // 更新布局的时间戳
      layout.lastUpdated = Game.time;
    }
  }

  /**
   * 处理建造完成事件
   */
  private handleConstructionCompleted(data: any): void {
    const { roomName, structureType, position } = data;

    // 如果是道路建造完成，触发相应事件
    if (structureType === STRUCTURE_ROAD) {
      this.emit(EventConfig.EVENTS.CONSTRUCTION_PLAN_UPDATED, {
        roomName,
        structureType,
        status: 'construction_progress',
        position
      });
    }
  }
}
