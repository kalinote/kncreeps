import { BuildingPlan } from "types";
import { BasePlanner } from "./BasePlanner";

export class ExtensionPlanner extends BasePlanner {
  public name: string = 'extension';
  public structureType: BuildableStructureConstant = STRUCTURE_EXTENSION;

  private static readonly EXTENSION_LIMITS = CONTROLLER_STRUCTURES["extension"];

  public plan(room: Room): BuildingPlan[] {
    if (!room.controller) {
      return [];
    }

    // TODO 确定基准位置
    const basePosition = new RoomPosition(0, 0, room.name);

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
   * 计算最优的扩展位置
   * @param room 房间
   * @param basePosition 基准位置
   * @param count 需要建造的扩展数量
   * @returns 建筑规划
   */
  private calculateOptimalPositions(room: Room, basePosition: RoomPosition, count: number): BuildingPlan[] {
    return [];
  }

}

