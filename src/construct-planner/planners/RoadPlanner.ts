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
  public plan(room: Room): { x: number; y: number }[] {
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
        pathResult.path.forEach(pos => allPathPositions.add(`${pos.x},${pos.y}`));
      }
    }

    return Array.from(allPathPositions).map(s => {
      const [x, y] = s.split(',');
      return { x: parseInt(x, 10), y: parseInt(y, 10) };
    });
  }
}
