import { BuildingPlanMemory, PlanningContextMemory } from '../../types';
import { BasePlanner } from './BasePlanner';

/**
 * 容器规划器
 * 负责在能量源、矿物和控制器附近规划容器的位置。
 */
export class ContainerPlanner extends BasePlanner {
  public readonly name: string = 'container';
  public readonly structureType: BuildableStructureConstant = STRUCTURE_CONTAINER;

  /**
   * 规划房间内所有容器的位置
   * @param room 需要规划的房间对象
   * @returns 返回一个包含所有容器位置的数组
   */
  public plan(room: Room, context: PlanningContextMemory): BuildingPlanMemory[] {
    if (!room.controller) {
      return [];
    }

    const plans: BuildingPlanMemory[] = [];
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
      return [];
    }

    // 1. 为能量源规划容器 -> Provider
    const sources = room.find(FIND_SOURCES);
    for (const source of sources) {
      const containerPos = this.findBestPositionNear(source.pos, spawn.pos);
      if (containerPos) {
        plans.push({
          pos: { x: containerPos.x, y: containerPos.y, roomName: room.name },
          structureType: this.structureType,
          logisticsRole: 'provider',
          resourceType: RESOURCE_ENERGY,
          version: 1    // 暂时还没有什么作用，先写死占位
        });
      }
    }

    // 2. 为矿物规划容器 -> Provider
    const mineral = room.find(FIND_MINERALS)[0];
    if (mineral) {
      const containerPos = this.findBestPositionNear(mineral.pos, spawn.pos);
      if (containerPos) {
        plans.push({
          pos: { x: containerPos.x, y: containerPos.y, roomName: room.name },
          structureType: this.structureType,
          logisticsRole: 'provider',
          resourceType: mineral.mineralType,
          version: 1    // 暂时还没有什么作用，先写死占位
        });
      }
    }

    // 3. 为控制器规划容器 -> Consumer
    const controllerPos = this.findBestPositionNear(room.controller.pos, spawn.pos, 3);
    if (controllerPos) {
      plans.push({
        pos: { x: controllerPos.x, y: controllerPos.y, roomName: room.name },
        structureType: this.structureType,
        logisticsRole: 'consumer',
        resourceType: RESOURCE_ENERGY,
        version: 1    // 暂时还没有什么作用，先写死占位
      });
    }

    return plans;
  }

  /**
   * 在目标点附近寻找一个最佳的、可放置建筑的空地
   * @param targetPos 目标点 (如Source, Controller)
   * @param referencePos 参考点 (如Spawn)，用于确定方向
   * @param range 查找的切比雪夫距离，默认为2，即“间隔一格”
   * @returns 找到的最佳位置，或null
   */
  private findBestPositionNear(targetPos: RoomPosition, referencePos: RoomPosition, range: number = 2): RoomPosition | null {
    const terrain = new Room.Terrain(targetPos.roomName);
    let bestPos: RoomPosition | null = null;
    let minDistance = Infinity;

    // 遍历以targetPos为中心的(2*range+1)x(2*range+1)的正方形区域
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        // FIX: 使用切比雪夫距离，并且只选择最外圈的位置
        // 这确保了与目标点之间至少间隔一格空地
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== range) {
          continue;
        }

        const x = targetPos.x + dx;
        const y = targetPos.y + dy;

        // 检查边界
        if (x <= 0 || x >= 49 || y <= 0 || y >= 49) continue;

        // 检查地形是否为平地
        if (terrain.get(x, y) !== 0) continue;

        const currentPos = new RoomPosition(x, y, targetPos.roomName);
        const distanceToReference = currentPos.getRangeTo(referencePos);

        // 选择离参考点最近的位置
        if (distanceToReference < minDistance) {
          minDistance = distanceToReference;
          bestPos = currentPos;
        }
      }
    }

    return bestPos;
  }
}
