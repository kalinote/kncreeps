/**
 * Source分析器 - 分析source的可采集位置
 */
export class SourceAnalyzer {

  /**
   * 获取source周围的可采集位置
   * @param source 要分析的source
   * @returns 可采集位置数组
   */
  public static getHarvestPositions(source: Source): RoomPosition[] {
    const positions: RoomPosition[] = [];
    const room = source.room;

    // 扫描source周围8个位置
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue; // 跳过source本身的位置

        const x = source.pos.x + dx;
        const y = source.pos.y + dy;

        // 检查位置是否在房间范围内
        if (x < 0 || x >= 50 || y < 0 || y >= 50) continue;

        const pos = new RoomPosition(x, y, room.name);

        // 检查位置是否可通行（creep可以站立）
        if (this.isPositionWalkable(pos)) {
          positions.push(pos);
        }
      }
    }

    return positions;
  }

    /**
   * 检查位置是否可通行
   * @param pos 要检查的位置
   * @returns 是否可通行
   */
  private static isPositionWalkable(pos: RoomPosition): boolean {
    const room = Game.rooms[pos.roomName];
    if (!room) return false;

    // 检查是否有建筑阻挡
    const structures = room.lookForAt(LOOK_STRUCTURES, pos);
    for (const structure of structures) {
      if (structure.structureType === STRUCTURE_WALL) {
        return false; // 墙壁阻挡
      }
      if (structure.structureType === STRUCTURE_ROAD) {
        return true; // 道路可以通行
      }
    }

    // 检查地形
    const terrain = room.getTerrain();
    const terrainType = terrain.get(pos.x, pos.y);

    // 平原(0)和沼泽(2)可以通行，墙壁(1)不能通行
    return terrainType !== TERRAIN_MASK_WALL;
  }

  /**
   * 获取source的可采集位置数量
   * @param source 要分析的source
   * @returns 可采集位置数量
   */
  public static getHarvestPositionCount(source: Source): number {
    return this.getHarvestPositions(source).length;
  }

  /**
   * 检查source是否有可采集位置
   * @param source 要分析的source
   * @returns 是否有可采集位置
   */
  public static hasHarvestPositions(source: Source): boolean {
    return this.getHarvestPositionCount(source) > 0;
  }

  /**
   * 获取房间内所有source的可采集位置统计
   * @param sources 要分析的source
   * @returns 统计信息
   */
  public static getRoomSourceStats(sources: Source[]): {
    totalSources: number;
    totalHarvestPositions: number;
    sourceDetails: Array<{
      sourceId: string;
      positionCount: number;
      positions: RoomPosition[];
    }>;
  } {
    const sourceDetails = sources.map(source => {
      const positions = this.getHarvestPositions(source);
      return {
        sourceId: source.id,
        positionCount: positions.length,
        positions: positions
      };
    });

    const totalHarvestPositions = sourceDetails.reduce((sum, detail) => sum + detail.positionCount, 0);

    return {
      totalSources: sources.length,
      totalHarvestPositions: totalHarvestPositions,
      sourceDetails: sourceDetails
    };
  }
}
