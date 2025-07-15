import { EventBus } from "core/EventBus";
import { BaseService } from "./BaseService";
import { ServiceContainer } from "core/ServiceContainer";

/**
 * Creep移动缓存服务
 */
export class CreepMoveService extends BaseService {
  // TODO: 后续增加缓存功能和动态避障逻辑
  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
  }

  /**
   * 移动creep到目标位置
   * @param creep 要移动的creep
   * @param target 目标位置或对象
   * @param opts 移动选项
   * @returns 移动结果
   */
  public move(creep: Creep, target: RoomPosition | RoomObject, opts: MoveToOpts = {}): ScreepsReturnCode {
    // TODO: 后续可以在这里插入路径缓存和动态避障逻辑
    return creep.moveTo(target, {
      visualizePathStyle: { stroke: '#ffffff' },
      reusePath: 10,
      ...opts
    });
  }

  /**
   * 智能移动到目标位置（支持精确位置和范围位置）
   * @param creep 要移动的creep
   * @param target 目标位置或对象
   * @param exactPosition 是否需要精确位置
   * @returns 移动结果
   */
  public smartMove(creep: Creep, target: RoomPosition | RoomObject, exactPosition: boolean = false): ScreepsReturnCode {
    const targetPos = target instanceof RoomPosition ? target : target.pos;

    if (exactPosition) {
      // 需要精确位置
      if (creep.pos.isEqualTo(targetPos)) {
        return OK;
      }
    } else {
      // 不需要精确位置，范围内即可
      const distance = creep.pos.getRangeTo(targetPos);
      if (distance <= 1) {
        return OK;
      }
    }

    return this.move(creep, target);
  }

  /**
   * 检查是否在范围内
   * @param creep 要检查的creep
   * @param target 目标位置或对象
   * @param range 范围
   * @returns 是否在范围内
   */
  public isInRange(creep: Creep, target: RoomPosition | RoomObject, range: number = 1): boolean {
    const targetPos = target instanceof RoomPosition ? target : target.pos;
    return creep.pos.getRangeTo(targetPos) <= range;
  }
}
