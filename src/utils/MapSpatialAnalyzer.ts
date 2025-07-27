type Point = { y: number, x: number };
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

    const visual = new RoomVisual(roomName);
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        visual.rect(x - 0.5, y - 0.5, 1, 1, { fill: matrix[y][x] ? '#ff0000' : '#00ff00' });
      }
    }


    // 计算距离矩阵
    const distGrid = MapSpatialAnalyzer.distanceTransform(matrix);

    // 绘制距离矩阵可视化
    let maxDist = 0;
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        maxDist = Math.max(maxDist, distGrid[y][x]);
      }
    }
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        const distValue = distGrid[y][x];
        const normalizedValue = maxDist > 0 ? distValue / maxDist : 0;
        const color = `rgb(${Math.floor(normalizedValue * 255)}, ${Math.floor(normalizedValue * 255)}, ${Math.floor(normalizedValue * 255)})`;
        visual.rect(x - 0.5, y - 0.5, 1, 1, { fill: color, opacity: 0.25 });
      }
    }

    // 寻找局部最大值
    const peaks = MapSpatialAnalyzer.findLocalMaxima(distGrid);
    if (peaks.length === 0) {
      let maxVal = -1;
      let maxCoord: Point = { y: 0, x: 0 };
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (distGrid[y][x] > maxVal) {
            maxVal = distGrid[y][x];
            maxCoord = { y, x };
          }
        }
      }
      if (maxVal > 0) peaks.push(maxCoord);
      else return { bestLocation: null, candidates: [], distGrid };
    }

    // 计算属性和评分
    const candidates: CandidateSpace[] = [];
    const mapCenter = { y: height / 2, x: width / 2 };
    const maxDistToCenter = Math.sqrt(mapCenter.y ** 2 + mapCenter.x ** 2);

    for (const peak of peaks) {
      const openness = distGrid[peak.y][peak.x];
      const area = MapSpatialAnalyzer.getSpaceAreaByRegionGrowing(peak, distGrid);

      const distToCenter = Math.sqrt((peak.y - mapCenter.y) ** 2 + (peak.x - mapCenter.x) ** 2);
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
      matrix[y] = Array.prototype.slice.call(raw, y * 50, (y + 1) * 50).map(num => ((num & TERRAIN_MASK_WALL) || (num & TERRAIN_MASK_LAVA)) ? 1 : 0);
    }

    // 将最外层边界标记为不可达区域
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        if (y === 0 || y === 49 || x === 0 || x === 49) {
          matrix[y][x] = 1;
        }
      }
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
    const dy = p1.y - p2.y;
    const dx = p1.x - p2.x;
    return dy * dy + dx * dx;
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
    const INFINITY_POINT: Point = { y: Infinity, x: Infinity };

    // 1. 初始化：障碍物点是自身，其他点是无穷远
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (matrix[y][x] === 1) {
          closestObstacles[y][x] = { y, x };
        } else {
          closestObstacles[y][x] = INFINITY_POINT;
        }
      }
    }

    // 2. 第一遍扫描: 左上 -> 右下
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let currentPoint = { y, x };
        let closest = closestObstacles[y][x];

        // 检查上方和左方的邻居
        const neighbors: Point[] = [];
        if (y > 0) neighbors.push(closestObstacles[y - 1][x]);
        if (x > 0) neighbors.push(closestObstacles[y][x - 1]);
        if (y > 0 && x > 0) neighbors.push(closestObstacles[y - 1][x - 1]);
        if (y > 0 && x < width - 1) neighbors.push(closestObstacles[y - 1][x + 1]);

        for (const neighborObstacle of neighbors) {
          if (MapSpatialAnalyzer.distSq(currentPoint, neighborObstacle) < MapSpatialAnalyzer.distSq(currentPoint, closest)) {
            closest = neighborObstacle;
          }
        }
        closestObstacles[y][x] = closest;
      }
    }

    // 3. 第二遍扫描: 右下 -> 左上
    for (let y = height - 1; y >= 0; y--) {
      for (let x = width - 1; x >= 0; x--) {
        let currentPoint = { y, x };
        let closest = closestObstacles[y][x];

        // 检查下方和右方的邻居
        const neighbors: Point[] = [];
        if (y < height - 1) neighbors.push(closestObstacles[y + 1][x]);
        if (x < width - 1) neighbors.push(closestObstacles[y][x + 1]);
        if (y < height - 1 && x < width - 1) neighbors.push(closestObstacles[y + 1][x + 1]);
        if (y < height - 1 && x > 0) neighbors.push(closestObstacles[y + 1][x - 1]);

        for (const neighborObstacle of neighbors) {
          if (MapSpatialAnalyzer.distSq(currentPoint, neighborObstacle) < MapSpatialAnalyzer.distSq(currentPoint, closest)) {
            closest = neighborObstacle;
          }
        }
        closestObstacles[y][x] = closest;
      }
    }

    // 4. 生成最终的距离场
    const distanceField: Grid = Array.from({ length: height }, () => Array(width).fill(0));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const closest = closestObstacles[y][x];
        distanceField[y][x] = Math.sqrt(MapSpatialAnalyzer.distSq({ y, x }, closest));
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

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const val = distanceField[y][x];
        if (val === 0) continue;
        // 检查8个邻居
        if (
          val > distanceField[y - 1][x] && val > distanceField[y + 1][x] &&
          val > distanceField[y][x - 1] && val > distanceField[y][x + 1] &&
          val > distanceField[y - 1][x - 1] && val > distanceField[y - 1][x + 1] &&
          val > distanceField[y + 1][x - 1] && val > distanceField[y + 1][x + 1]
        ) {
          peaks.push({ y, x });
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
    const startValue = distanceField[startPoint.y][startPoint.x];
    const threshold = startValue * thresholdRatio;

    const queue: Point[] = [startPoint];
    const visited = new Set<string>([`${startPoint.y},${startPoint.x}`]);
    let area = 0;

    while (queue.length > 0) {
      const { y, x } = queue.shift()!;

      if (distanceField[y][x] >= threshold) {
        area++;
        // 探索4个方向的邻居
        const neighbors: Point[] = [{ y: y - 1, x }, { y: y + 1, x }, { y, x: x - 1 }, { y, x: x + 1 }];
        for (const n of neighbors) {
          const key = `${n.y},${n.x}`;
          if (n.y >= 0 && n.y < height && n.x >= 0 && n.x < width && !visited.has(key)) {
            visited.add(key);
            queue.push(n);
          }
        }
      }
    }
    return area;
  }
}
