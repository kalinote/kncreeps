import { ConstructPlannerService } from '../../services/construction/ConstructPlannerService';
import { BuildingPlanMemory } from '../../types';

/**
 * 规划器的基类
 * 定义了所有具体规划器必须遵循的接口。
 */
export abstract class BasePlanner {
  protected service: ConstructPlannerService;

  constructor(service: ConstructPlannerService) {
    this.service = service;
  }

  /**
   * 规划器的唯一名称
   */
  public abstract readonly name: string;

  /**
   * 规划器对应的建筑类型
   * 这将被用于创建工地。
   */
  public abstract readonly structureType: BuildableStructureConstant;

  /**
   * 规划一个房间的特定建筑布局
   * @param room 需要规划的房间对象
   * @returns 返回一个包含所有建筑位置的数组
   */
  public abstract plan(room: Room): BuildingPlanMemory[];

  /**
   * 将路径点转换为标准的位置格式
   * @param pathRooms 包含多个路径点的数组
   * @param roomName 房间名
   * @returns 转换后的标准位置数组
   */
  protected pathToPositions(pathRooms: RoomPosition[], roomName: string): { x: number; y: number }[] {
    return pathRooms.map(pos => ({ x: pos.x, y: pos.y }));
  }
}
