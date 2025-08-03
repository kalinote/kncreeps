import { BuildingPlanMemory, ConstructionStatus, PlanningContextMemory, RoadConstructionStatus, RoadPlanInfo, RoadSegment, StructurePosition } from "../../types";
import { BasePlanner } from "./BasePlanner";

/**
 * 道路规划器
 * 负责连接房间内的关键建筑（Spawn, Sources, Controller）。
 */
export class RoadPlanner extends BasePlanner {
  public readonly name = 'road';
  public readonly structureType = STRUCTURE_ROAD;

  /**
   * 规划房间的道路网络
   * @param room 需要规划的房间
   * @returns 返回所有道路的位置坐标
   */
  public plan(room: Room, context: PlanningContextMemory): BuildingPlanMemory[] {
    const from = room.find(FIND_MY_SPAWNS)[0];
    if (!from) {
      console.log(`[RoadPlanner] 房间 ${room.name} 中没有找到 Spawn，无法规划道路。`);
      return [];
    }

    const toSources = room.find(FIND_SOURCES);
    const toController = room.controller;

    const destinations = [...toSources, toController];
    const allPathPositions = new Set<string>();

    for (const destination of destinations) {
      if (!destination) continue;

      const pathResult = PathFinder.search(
        from.pos,
        { pos: destination.pos, range: 1 },
        {
          plainCost: 2,
          swampCost: 10,
          roomCallback: roomName => {
            const room = Game.rooms[roomName];
            if (!room) return false;
            const costs = new PathFinder.CostMatrix();

            room.find(FIND_STRUCTURES).forEach(struct => {
              if (struct.structureType === STRUCTURE_ROAD) {
                // 在现有道路上行驶的成本较低
                costs.set(struct.pos.x, struct.pos.y, 1);
              } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                // 不能穿过无法通行的建筑
                costs.set(struct.pos.x, struct.pos.y, 0xff);
              }
            });

            return costs;
          }
        }
      );

      if (!pathResult.incomplete) {
        pathResult.path.forEach(pos => allPathPositions.add(`${pos.x},${pos.y},${pos.roomName}`));
      }
    }

    return Array.from(allPathPositions).map(s => {
      const [x, y, roomName] = s.split(',');
      return {
        pos: { x: parseInt(x, 10), y: parseInt(y, 10), roomName },
        structureType: this.structureType,
        logisticsRole: 'non_logistics_management_building',
        resourceType: undefined,
        version: 1
      };
    });
  }

  /**
   * 获取道路建造状态
   */
  public getRoadConstructionStatus(room: Room): RoadConstructionStatus | null {
    const planInfo = this.getRoadPlanInfo(room);
    if (!planInfo) return null;

    let plannedSegments = 0;
    let underConstructionSegments = 0;
    let completedSegments = 0;
    let totalPositions = planInfo.totalPositions;
    let completedPositions = 0;

    for (const segment of planInfo.segments) {
      // 更新段状态
      this.updateSegmentStatus(room, segment);

      switch (segment.status) {
        case ConstructionStatus.PLANNED:
          plannedSegments++;
          break;
        case ConstructionStatus.UNDER_CONSTRUCTION:
          underConstructionSegments++;
          break;
        case ConstructionStatus.COMPLETED:
          completedSegments++;
          break;
      }

      // 计算已完成的道路位置
      for (const pos of segment.positions) {
        const roomPos = new RoomPosition(pos.x, pos.y, room.name);
        const hasStructure = roomPos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_ROAD);
        const hasSite = roomPos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType === STRUCTURE_ROAD);

        if (hasStructure || hasSite) {
          completedPositions++;
        }
      }
    }

    return {
      roomName: room.name,
      plannedSegments,
      underConstructionSegments,
      completedSegments,
      totalPositions,
      completedPositions
    };
  }

  /**
   * 更新道路段状态
   */
  private updateSegmentStatus(room: Room, segment: RoadSegment): void {
    let hasConstruction = false;
    let hasCompleted = false;
    let totalPositions = segment.positions.length;
    let completedPositions = 0;

    for (const pos of segment.positions) {
      const roomPos = new RoomPosition(pos.x, pos.y, room.name);
      const hasStructure = roomPos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_ROAD);
      const hasSite = roomPos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType === STRUCTURE_ROAD);

      if (hasStructure) {
        completedPositions++;
        hasCompleted = true;
      } else if (hasSite) {
        hasConstruction = true;
      }
    }

    // 更新段状态（只更新状态，不触发事件）
    if (completedPositions === totalPositions) {
      segment.status = ConstructionStatus.COMPLETED;
      if (!segment.completedAt) {
        segment.completedAt = Game.time;
      }
    } else if (hasConstruction) {
      segment.status = ConstructionStatus.UNDER_CONSTRUCTION;
    } else {
      segment.status = ConstructionStatus.PLANNED;
    }
  }

  /**
   * 获取道路规划信息
   */
  public getRoadPlanInfo(room: Room): RoadPlanInfo | null {
    const layout = this.service.getLayout(room.name);
    if (!layout || !layout.buildings.road) {
      return null;
    }

    const roadPositions = layout.buildings.road;
    const segments = this.buildRoadSegments(room, roadPositions);

    // 更新所有段的状态
    for (const segment of segments) {
      this.updateSegmentStatus(room, segment);
    }

    const totalPositions = roadPositions.length;
    const completedPositions = this.getCompletedPositions(room, roadPositions);

    return {
      roomName: room.name,
      segments,
      totalPositions,
      completedPositions,
      lastUpdate: layout.lastUpdate
    };
  }

  /**
   * 获取未建造的道路段
   */
  public getUnbuiltRoads(room: Room): RoadSegment[] {
    const planInfo = this.getRoadPlanInfo(room);
    if (!planInfo) return [];

    return planInfo.segments.filter(segment =>
      segment.status === ConstructionStatus.PLANNED || segment.status === ConstructionStatus.UNDER_CONSTRUCTION
    );
  }

  /**
   * 构建道路段信息
   */
  private buildRoadSegments(room: Room, positions: StructurePosition[]): RoadSegment[] {
    const segments: RoadSegment[] = [];
    const spawns = room.find(FIND_MY_SPAWNS);
    const sources = room.find(FIND_SOURCES);
    const controller = room.controller;

    if (spawns.length === 0) return segments;

    const destinations = [...sources, controller].filter(Boolean);
    let segmentId = 0;

    for (const destination of destinations) {
      if (!destination) continue;

      const pathResult = PathFinder.search(
        spawns[0].pos,
        { pos: destination.pos, range: 1 },
        {
          plainCost: 2,
          swampCost: 10,
          roomCallback: roomName => {
            const room = Game.rooms[roomName];
            if (!room) return false;
            const costs = new PathFinder.CostMatrix();

            room.find(FIND_STRUCTURES).forEach(struct => {
              if (struct.structureType === STRUCTURE_ROAD) {
                costs.set(struct.pos.x, struct.pos.y, 1);
              } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                costs.set(struct.pos.x, struct.pos.y, 0xff);
              }
            });

            return costs;
          }
        }
      );

      if (!pathResult.incomplete && pathResult.path.length > 0) {
        const segmentPositions = pathResult.path.map(pos => ({ x: pos.x, y: pos.y }));
        const segment: RoadSegment = {
          id: `road_${room.name}_${segmentId++}`,
          from: { x: spawns[0].pos.x, y: spawns[0].pos.y, roomName: room.name },
          to: { x: destination.pos.x, y: destination.pos.y, roomName: room.name },
          positions: segmentPositions,
          status: ConstructionStatus.PLANNED,  // 使用枚举
          createdAt: Game.time
        };
        segments.push(segment);
      }
    }

    return segments;
  }

  /**
   * 获取已完成的道路位置数量
   */
  private getCompletedPositions(room: Room, positions: StructurePosition[]): number {
    let completedCount = 0;

    for (const pos of positions) {
      const roomPos = new RoomPosition(pos.pos.x, pos.pos.y, room.name);
      const hasStructure = roomPos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_ROAD);
      const hasSite = roomPos.lookFor(LOOK_CONSTRUCTION_SITES).some(s => s.structureType === STRUCTURE_ROAD);

      if (hasStructure || hasSite) {
        completedCount++;
      }
    }

    return completedCount;
  }
}
