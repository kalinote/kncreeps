import { BuildingPlanMemory, PlanningContextMemory } from "types";
import { BasePlanner } from "./BasePlanner";
import { MapSpatialAnalyzer } from "../../utils/MapSpatialAnalyzer";

/**
 * Extension规划器
 * 负责以spawn为中心进行棋盘格布局的extension规划
 * 支持多阶段动态规划，能够填补之前因阻塞留下的空位
 */
export class ExtensionPlanner extends BasePlanner {
  public name: string = 'extension';
  public structureType: BuildableStructureConstant = STRUCTURE_EXTENSION;

  private static readonly EXTENSION_LIMITS = CONTROLLER_STRUCTURES["extension"];

  public plan(room: Room, context: PlanningContextMemory): BuildingPlanMemory[] {
    if (!room.controller) {
      return [];
    }

    // 将房间的第一个Spawn作为布局的中心基准点
    const spawns = room.find(FIND_MY_SPAWNS);
    if (spawns.length === 0) {
      // TODO 这里可能会依赖于spawn建造完成后再进行规划，而实际上规划是被房间初始化完成事件触发的
      // 新占领的房间在初始化完成时可能还没有spawn，需要考虑如何处理这种情况
      return [];
    }
    const basePosition = spawns[0].pos;

    const maxExtensionCount = ExtensionPlanner.EXTENSION_LIMITS[room.controller.level];
    if (maxExtensionCount === 0) {
      return [];
    }

    const existingExtensions = room.find(FIND_MY_STRUCTURES, {
      filter: (structure) => structure.structureType === STRUCTURE_EXTENSION
    });

    const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
      filter: (site) => site.structureType === STRUCTURE_EXTENSION
    });

    const totalPlanned = existingExtensions.length + constructionSites.length;
    const remaining = maxExtensionCount - totalPlanned;

    if (remaining <= 0) {
      return [];
    }

    return this.calculateOptimalPositions(room, basePosition, remaining);
  }

    /**
   * 选择最佳的extension位置
   * @param room 房间对象
   * @param basePosition 布局的中心点（第一个spawn位置）
   * @param count 需要规划的扩展数量
   * @returns 建筑规划数组
   */
  private calculateOptimalPositions(room: Room, basePosition: RoomPosition, count: number): BuildingPlanMemory[] {
    const plans: BuildingPlanMemory[] = [];
    let foundCount = 0;

    // 进行地形分析，获取连通区域信息
    const labeledGrid = MapSpatialAnalyzer.analyzeLabeledGrid(room.name);
    const spawnRegionId = labeledGrid[basePosition.y][basePosition.x];

    // 获取考虑地形适应性的位置序列
    const positionSequence = this.generateTerrainAdaptiveSequence(basePosition, labeledGrid, spawnRegionId);

    for (const offset of positionSequence) {
      if (foundCount >= count) break;

      const pos = new RoomPosition(
        basePosition.x + offset.x,
        basePosition.y + offset.y,
        room.name
      );

      // 检查该位置是否可以放置extension
      if (this.canPlaceExtension(pos, room)) {
        plans.push({
          pos: { x: pos.x, y: pos.y, roomName: room.name },
          version: 1,
          structureType: STRUCTURE_EXTENSION,
          logisticsRole: 'consumer',
          resourceType: RESOURCE_ENERGY
        });
        foundCount++;
      }
    }

    console.log(`[ExtensionPlanner] 为房间 ${room.name} 规划了 ${foundCount} 个extension位置（spawn区域ID: ${spawnRegionId}）`);
    return plans;
  }

    /**
   * 生成考虑地形适应性的extension位置序列
   * 使用螺旋环绕算法，确保extension围绕spawn均匀分布
   * 棋盘格模式：(x+y) % 2 === 1 的位置放extension，0的位置留空（可建道路）
   * @param basePosition spawn位置
   * @param labeledGrid 连通区域标记矩阵
   * @param spawnRegionId spawn所在的区域ID
   * @returns 位置偏移量数组，按螺旋环绕优先级排序
   */
  private generateTerrainAdaptiveSequence(
    basePosition: RoomPosition,
    labeledGrid: number[][],
    spawnRegionId: number
  ): Array<{x: number, y: number}> {
    const sameRegionPositions: Array<{x: number, y: number, distance: number, angle: number}> = [];
    const otherRegionPositions: Array<{x: number, y: number, distance: number, angle: number}> = [];

    // 搜索范围：在spawn周围25格(全图)范围内寻找合适位置
    // 扩大搜索范围以应对复杂地形
    for (let dx = -25; dx <= 25; dx++) {
      for (let dy = -25; dy <= 25; dy++) {
        // 跳过spawn自身位置
        if (dx === 0 && dy === 0) continue;

        // 棋盘格模式：(x+y) % 2 === 1 的位置用于放置extension
        if ((((dx + dy) % 2) + 2) % 2 !== 1) continue;

        const absoluteX = basePosition.x + dx;
        const absoluteY = basePosition.y + dy;

        // 检查是否在房间边界内
        if (absoluteX <= 1 || absoluteX >= 48 || absoluteY <= 1 || absoluteY >= 48) continue;

        // 检查该位置所属的连通区域
        const regionId = labeledGrid[absoluteY][absoluteX];

        // 跳过不可达区域（墙体等，regionId为0）
        if (regionId === 0) continue;

        // 计算到spawn的距离和角度
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx); // 角度范围 [-π, π]
        const positionInfo = {x: dx, y: dy, distance, angle};

        // 根据区域ID分类
        if (regionId === spawnRegionId) {
          sameRegionPositions.push(positionInfo);
        } else {
          otherRegionPositions.push(positionInfo);
        }
      }
    }

    // 使用螺旋环绕排序：先按距离分组，然后在每个距离环内按角度均匀分布
    const sortedSameRegion = this.applySpiralSort(sameRegionPositions);
    const sortedOtherRegion = this.applySpiralSort(otherRegionPositions);

    // 优先返回同一区域的位置，然后是其他区域的位置
    const combinedSequence = [
      ...sortedSameRegion.map(item => ({x: item.x, y: item.y})),
      ...sortedOtherRegion.map(item => ({x: item.x, y: item.y}))
    ];

    console.log(
      `[ExtensionPlanner] 螺旋分析完成：spawn区域内可用位置 ${sortedSameRegion.length} 个，` +
      `其他区域可用位置 ${sortedOtherRegion.length} 个`
    );

    return combinedSequence;
  }

  /**
   * 应用螺旋环绕排序算法
   * 按距离分组，每组内按角度均匀分布，确保环绕spawn的均匀布局
   * @param positions 位置数组
   * @returns 螺旋排序后的位置数组
   */
  private applySpiralSort(positions: Array<{x: number, y: number, distance: number, angle: number}>): Array<{x: number, y: number, distance: number, angle: number}> {
    // 按距离分组（使用小的容差来处理浮点数精度问题）
    const distanceGroups = new Map<number, Array<{x: number, y: number, distance: number, angle: number}>>();

    for (const pos of positions) {
      // 将距离四舍五入到最近的0.1，用于分组
      const roundedDistance = Math.round(pos.distance * 10) / 10;

      if (!distanceGroups.has(roundedDistance)) {
        distanceGroups.set(roundedDistance, []);
      }
      distanceGroups.get(roundedDistance)!.push(pos);
    }

    // 对距离进行排序
    const sortedDistances = Array.from(distanceGroups.keys()).sort((a, b) => a - b);

    const result: Array<{x: number, y: number, distance: number, angle: number}> = [];

    // 为每个距离环按角度排序，实现环绕分布
    for (const distance of sortedDistances) {
      const group = distanceGroups.get(distance)!;

      // 在每个距离环内，按角度排序实现环绕效果
      // 从0度开始，按逆时针方向排列
      group.sort((a, b) => {
        // 将角度转换为0-2π范围，便于排序
        const angleA = a.angle < 0 ? a.angle + 2 * Math.PI : a.angle;
        const angleB = b.angle < 0 ? b.angle + 2 * Math.PI : b.angle;
        return angleA - angleB;
      });

      result.push(...group);
    }

    return result;
  }

  /**
   * 检查指定位置是否可以放置extension
   * @param pos 要检查的位置
   * @param room 房间对象
   * @returns 是否可以放置extension
   */
  private canPlaceExtension(pos: RoomPosition, room: Room): boolean {
    // 检查是否在房间边界内（留1格边距）
    if (pos.x <= 1 || pos.x >= 48 || pos.y <= 1 || pos.y >= 48) {
      return false;
    }

    // 检查是否有现有建筑
    const structures = pos.lookFor(LOOK_STRUCTURES);
    if (structures.length > 0) {
      return false;
    }

    // 检查是否有建造工地
    const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
    if (sites.length > 0) {
      return false;
    }

    // 检查地形是否为墙壁
    const terrain = Game.map.getRoomTerrain(room.name).get(pos.x, pos.y);
    if (terrain === TERRAIN_MASK_WALL) {
      return false;
    }

    return true;
  }
}

