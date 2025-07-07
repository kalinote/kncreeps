import { Task, TaskResult, CapabilityRequirement } from "../../types";

/**
 * 任务执行器基类
 */
export abstract class BaseTaskExecutor {
  /**
   * 检查creep是否能执行此任务
   */
  public abstract canExecute(creep: Creep, task: Task): boolean;

  /**
   * 执行任务
   */
  public abstract execute(creep: Creep, task: Task): TaskResult;

  /**
   * 获取执行此任务需要的能力要求
   */
  public abstract getRequiredCapabilities(): CapabilityRequirement[];

  /**
   * 获取任务类型名称
   */
  public abstract getTaskTypeName(): string;

  /**
   * 检查creep是否具备所需能力
   */
  protected checkCapabilities(creep: Creep): boolean {
    const requirements = this.getRequiredCapabilities();

    for (const requirement of requirements) {
      const count = creep.body.filter(part => part.type === requirement.bodyPart).length;
      if (count < requirement.minCount) {
        return false;
      }
    }

    return true;
  }

  /**
   * 计算能力匹配度评分
   */
  protected calculateCapabilityScore(creep: Creep): number {
    const requirements = this.getRequiredCapabilities();
    let totalScore = 0;
    let maxScore = 0;

    for (const requirement of requirements) {
      const count = creep.body.filter(part => part.type === requirement.bodyPart).length;
      const score = Math.min(count / requirement.minCount, 2) * requirement.weight;
      totalScore += score;
      maxScore += requirement.weight * 2;
    }

    return maxScore > 0 ? totalScore / maxScore : 0;
  }

  /**
   * 通用移动方法
   */
  protected moveToTarget(creep: Creep, target: RoomPosition | RoomObject): ScreepsReturnCode {
    return creep.moveTo(target, {
      visualizePathStyle: { stroke: '#ffffff' },
      reusePath: 10
    });
  }

  /**
   * 检查位置是否可达
   */
  protected isPositionReachable(creep: Creep, targetPos: RoomPosition, maxRange: number = 1): boolean {
    // 使用PathFinder检查是否可达
    const result = PathFinder.search(creep.pos, { pos: targetPos, range: maxRange }, {
      roomCallback: (roomName) => {
        const room = Game.rooms[roomName];
        if (!room) return false;

        // 创建CostMatrix，标记不可通行的地形和建筑
        const costs = new PathFinder.CostMatrix();

        // 标记墙壁和沼泽
        const terrain = room.getTerrain();
        for (let x = 0; x < 50; x++) {
          for (let y = 0; y < 50; y++) {
            const tile = terrain.get(x, y);
            if (tile === TERRAIN_MASK_WALL) {
              costs.set(x, y, 255); // 不可通行
            } else if (tile === TERRAIN_MASK_SWAMP) {
              costs.set(x, y, 5); // 沼泽成本高
            }
          }
        }

        // 标记建筑
        room.find(FIND_STRUCTURES).forEach(structure => {
          if (structure.structureType !== STRUCTURE_ROAD &&
              structure.structureType !== STRUCTURE_CONTAINER &&
              structure.structureType !== STRUCTURE_RAMPART) {
            costs.set(structure.pos.x, structure.pos.y, 255);
          }
        });

        return costs;
      },
      maxOps: 2000 // 限制计算量
    });

    return !result.incomplete && result.path.length > 0;
  }

  /**
   * 寻找目标位置附近最接近的可达位置
   */
  protected findClosestReachablePosition(creep: Creep, targetPos: RoomPosition, maxRange: number = 3): RoomPosition | null {
    // 如果目标位置本身可达，直接返回
    if (this.isPositionReachable(creep, targetPos, 0)) {
      return targetPos;
    }

    // 在指定范围内寻找可达位置
    const positions: RoomPosition[] = [];

    for (let range = 1; range <= maxRange; range++) {
      for (let dx = -range; dx <= range; dx++) {
        for (let dy = -range; dy <= range; dy++) {
          // 只检查边界位置，避免重复检查内部
          if (Math.abs(dx) === range || Math.abs(dy) === range) {
            const x = targetPos.x + dx;
            const y = targetPos.y + dy;

            if (x >= 0 && x < 50 && y >= 0 && y < 50) {
              const pos = new RoomPosition(x, y, targetPos.roomName);
              if (this.isPositionReachable(creep, pos, 0)) {
                positions.push(pos);
              }
            }
          }
        }
      }

      // 如果找到可达位置，返回最近的
      if (positions.length > 0) {
        positions.sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b));
        return positions[0];
      }
    }

    return null;
  }

  /**
   * 智能移动到目标位置
   */
  protected smartMoveTo(creep: Creep, targetPos: RoomPosition, exactPosition: boolean = false): { success: boolean; message: string } {
    if (exactPosition) {
      // 需要精确位置，尝试直接移动
      if (creep.pos.isEqualTo(targetPos)) {
        return { success: true, message: '已到达目标位置' };
      }

      // 检查是否可达
      if (!this.isPositionReachable(creep, targetPos, 0)) {
        // 目标位置不可达，寻找最接近的可达位置
        const fallbackPos = this.findClosestReachablePosition(creep, targetPos, 2);
        if (fallbackPos) {
          creep.moveTo(fallbackPos);
          return { success: true, message: `目标位置不可达，移动到最接近位置 (${fallbackPos.x}, ${fallbackPos.y})` };
        } else {
          return { success: false, message: '目标位置及附近都不可达' };
        }
      }

      creep.moveTo(targetPos);
      return { success: true, message: '移动到目标位置' };
    } else {
      // 不需要精确位置，范围内即可
      const distance = creep.pos.getRangeTo(targetPos);
      if (distance <= 1) {
        return { success: true, message: '已在目标范围内' };
      }

      creep.moveTo(targetPos);
      return { success: true, message: '移动到目标范围' };
    }
  }

  /**
   * 安全执行，包装错误处理
   */
  protected safeExecute(action: () => TaskResult, context: string): TaskResult {
    try {
      return action();
    } catch (error) {
      console.log(`[${context}] 任务执行错误: ${error}`);
      return {
        success: false,
        completed: false,
        message: `执行错误: ${error}`
      };
    }
  }
}
