import { BuildingPlan } from "types";
import { BasePlanner } from "./BasePlanner";

export class ExtensionPlanner extends BasePlanner {
  public name: string = 'extension';
  public structureType: BuildableStructureConstant = STRUCTURE_EXTENSION;

  public plan(room: Room): BuildingPlan[] {
    if (!room.controller) {
      return [];
    }

    const plans: BuildingPlan[] = [];
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
      return [];
    }

    return plans;
  }

}

