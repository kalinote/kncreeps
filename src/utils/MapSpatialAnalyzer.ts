type Point = { r: number, c: number };
type Grid = number[][];
type CandidateSpace = {
  coord: Point;       // 空间中心点坐标
  openness: number;   // 空间开阔度(距离值)
  area: number;       // 空间估算面积
  centrality: number; // 空间中心性(0-1)
  score: number;      // 空间得分(0-1)
};

/*
 * 地图空间分析工具
 */
export class MapSpatialAnalyzer {
  // 50x50的房间，每个格子用一个数字表示，0表示可达，1表示不可达(包括不可通过建筑和障碍物、地形等)
  public static analyze(
    roomName: string,
    weights = { area: 0.5, openness: 0.4, centrality: 0.1 }
  ): { bestLocation: CandidateSpace | null; candidates: CandidateSpace[]; distGrid: Grid } {
    const terrain = new Room.Terrain(roomName);
    const raw = terrain.getRawBuffer();

    // 获取二值矩阵
    const matrix = MapSpatialAnalyzer.getBinaryMatrix(raw);
    const height = matrix.length;
    const width = matrix[0].length;

    // 计算距离矩阵
    const distGrid = MapSpatialAnalyzer.distanceTransform(matrix);

    // 寻找局部最大值
    const peaks = MapSpatialAnalyzer.findLocalMaxima(distGrid);
    if (peaks.length === 0) {
      let maxVal = -1;
      let maxCoord: Point = { r: 0, c: 0 };
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          if (distGrid[r][c] > maxVal) {
            maxVal = distGrid[r][c];
            maxCoord = { r, c };
          }
        }
      }
      if (maxVal > 0) peaks.push(maxCoord);
      else return { bestLocation: null, candidates: [], distGrid };
    }

    // 计算属性和评分
    const candidates: CandidateSpace[] = [];
    const mapCenter = { r: height / 2, c: width / 2 };
    const maxDistToCenter = Math.sqrt(mapCenter.r ** 2 + mapCenter.c ** 2);

    for (const peak of peaks) {
      const openness = distGrid[peak.r][peak.c];
      const area = MapSpatialAnalyzer.getSpaceAreaByRegionGrowing(peak, distGrid);

      const distToCenter = Math.sqrt((peak.r - mapCenter.r) ** 2 + (peak.c - mapCenter.c) ** 2);
      const centrality = 1.0 - (distToCenter / maxDistToCenter);

      candidates.push({ coord: peak, openness, area, centrality, score: 0 });
    }

    // 归一化并计算最终得分
    const maxArea = Math.max(1, ...candidates.map(c => c.area));
    const maxOpenness = Math.max(1, ...candidates.map(c => c.openness));

    for (const cand of candidates) {
      const normArea = cand.area / maxArea;
      const normOpenness = cand.openness / maxOpenness;

      cand.score = weights.area * normArea +
        weights.openness * normOpenness +
        weights.centrality * cand.centrality;
    }

    // 排序找到最佳
    candidates.sort((a, b) => b.score - a.score);

    return {
      bestLocation: candidates[0] || null,
      candidates,
      distGrid
    };
  }

  private static getMatrix(raw: { number: number }): Grid {
    const matrix: Grid = [];
    for (let y = 0; y < 50; y++) {
      matrix[y] = Array.prototype.slice.call(raw, y * 50, (y + 1) * 50);
    }
    return matrix;
  }

  private static getBinaryMatrix(raw: { number: number }): Grid {
    const matrix: Grid = [];
    for (let y = 0; y < 50; y++) {
      matrix[y] = Array.prototype.slice.call(raw, y * 50, (y + 1) * 50).map(num => num === (y & TERRAIN_MASK_WALL) || num === (y & TERRAIN_MASK_LAVA) ? 0 : 1);
    }
    return matrix;
  }

  /**
   * 计算平方欧几里得距离。
   * @param p1 点1
   * @param p2 点2
   * @returns 两点间的平方距离
   */
  private static distSq(p1: Point, p2: Point): number {
    const dr = p1.r - p2.r;
    const dc = p1.c - p2.c;
    return dr * dr + dc * dc;
  }

  /**
   * 距离变换计算
   * @param matrix 二值矩阵，0表示可达，1表示不可达，暂不考虑高移动成本地块(沼泽等)，全部以可达标识
   * @returns 距离矩阵，每个格子到最近障碍物的距离的归一化值
   */
  private static distanceTransform(matrix: Grid): Grid {
    const height = matrix.length;
    if (height === 0) return [];
    const width = matrix[0].length;
    if (width === 0) return [[]];

    const closestObstacles: Point[][] = Array.from({ length: height }, () => Array(width));
    const INFINITY_POINT: Point = { r: Infinity, c: Infinity };

    // 1. 初始化：障碍物点是自身，其他点是无穷远
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (matrix[r][c] === 1) {
          closestObstacles[r][c] = { r, c };
        } else {
          closestObstacles[r][c] = INFINITY_POINT;
        }
      }
    }

    // 2. 第一遍扫描: 左上 -> 右下
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        let currentPoint = { r, c };
        let closest = closestObstacles[r][c];

        // 检查上方和左方的邻居
        const neighbors: Point[] = [];
        if (r > 0) neighbors.push(closestObstacles[r - 1][c]);
        if (c > 0) neighbors.push(closestObstacles[r][c - 1]);
        if (r > 0 && c > 0) neighbors.push(closestObstacles[r - 1][c - 1]);
        if (r > 0 && c < width - 1) neighbors.push(closestObstacles[r - 1][c + 1]);

        for (const neighborObstacle of neighbors) {
          if (MapSpatialAnalyzer.distSq(currentPoint, neighborObstacle) < MapSpatialAnalyzer.distSq(currentPoint, closest)) {
            closest = neighborObstacle;
          }
        }
        closestObstacles[r][c] = closest;
      }
    }

    // 3. 第二遍扫描: 右下 -> 左上
    for (let r = height - 1; r >= 0; r--) {
      for (let c = width - 1; c >= 0; c--) {
        let currentPoint = { r, c };
        let closest = closestObstacles[r][c];

        // 检查下方和右方的邻居
        const neighbors: Point[] = [];
        if (r < height - 1) neighbors.push(closestObstacles[r + 1][c]);
        if (c < width - 1) neighbors.push(closestObstacles[r][c + 1]);
        if (r < height - 1 && c < width - 1) neighbors.push(closestObstacles[r + 1][c + 1]);
        if (r < height - 1 && c > 0) neighbors.push(closestObstacles[r + 1][c - 1]);

        for (const neighborObstacle of neighbors) {
          if (MapSpatialAnalyzer.distSq(currentPoint, neighborObstacle) < MapSpatialAnalyzer.distSq(currentPoint, closest)) {
            closest = neighborObstacle;
          }
        }
        closestObstacles[r][c] = closest;
      }
    }

    // 4. 生成最终的距离场
    const distanceField: Grid = Array.from({ length: height }, () => Array(width).fill(0));
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const closest = closestObstacles[r][c];
        distanceField[r][c] = Math.sqrt(MapSpatialAnalyzer.distSq({ r, c }, closest));
      }
    }

    return distanceField;
  }

  /**
   * 寻找局部最大值
   * @param distanceField 距离矩阵
   * @returns 局部最大值点
   */
  private static findLocalMaxima(distanceField: Grid): Point[] {
    const peaks: Point[] = [];
    const height = distanceField.length;
    if (height === 0) return [];
    const width = distanceField[0].length;

    for (let r = 1; r < height - 1; r++) {
      for (let c = 1; c < width - 1; c++) {
        const val = distanceField[r][c];
        if (val === 0) continue;
        // 检查8个邻居
        if (
          val > distanceField[r - 1][c] && val > distanceField[r + 1][c] &&
          val > distanceField[r][c - 1] && val > distanceField[r][c + 1] &&
          val > distanceField[r - 1][c - 1] && val > distanceField[r - 1][c + 1] &&
          val > distanceField[r + 1][c - 1] && val > distanceField[r + 1][c + 1]
        ) {
          peaks.push({ r, c });
        }
      }
    }
    return peaks;
  }

  /**
   * 基于区域生长的空间面积计算
   * @param startPoint 起始点
   * @param distanceField 距离矩阵
   * @param thresholdRatio 阈值比例，相对于起始点距离值，默认0.5
   * @returns 空间面积
   */
  private static getSpaceAreaByRegionGrowing(startPoint: Point, distanceField: Grid, thresholdRatio: number = 0.5): number {
    const height = distanceField.length;
    const width = distanceField[0].length;
    const startValue = distanceField[startPoint.r][startPoint.c];
    const threshold = startValue * thresholdRatio;

    const queue: Point[] = [startPoint];
    const visited = new Set<string>([`${startPoint.r},${startPoint.c}`]);
    let area = 0;

    while (queue.length > 0) {
      const { r, c } = queue.shift()!;

      if (distanceField[r][c] >= threshold) {
        area++;
        // 探索4个方向的邻居
        const neighbors: Point[] = [{ r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 }];
        for (const n of neighbors) {
          const key = `${n.r},${n.c}`;
          if (n.r >= 0 && n.r < height && n.c >= 0 && n.c < width && !visited.has(key)) {
            visited.add(key);
            queue.push(n);
          }
        }
      }
    }
    return area;
  }
}
