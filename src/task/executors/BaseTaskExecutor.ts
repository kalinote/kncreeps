import { Task, TaskResult, CapabilityRequirement } from "../../types";
import { EnergyConfig } from "../../config/EnergyConfig";

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
   * 智能移动到目标位置
   */
  protected smartMoveToTarget(creep: Creep, target: RoomPosition | RoomObject, exactPosition: boolean = false): TaskResult {
    const targetPos = target instanceof RoomPosition ? target : target.pos;

    if (exactPosition) {
      // 需要精确位置
      if (creep.pos.isEqualTo(targetPos)) {
        return { success: true, completed: false, message: '已到达目标位置' };
      }

      // 检查是否可达
      if (!this.isPositionReachable(creep, targetPos, 0)) {
        // 目标位置不可达，寻找最接近的可达位置
        const fallbackPos = this.findClosestReachablePosition(creep, targetPos, 2);
        if (fallbackPos) {
          creep.moveTo(fallbackPos);
          return { success: true, completed: false, message: `目标位置不可达，移动到最接近位置 (${fallbackPos.x}, ${fallbackPos.y})` };
        } else {
          return { success: false, completed: false, message: '目标位置及附近都不可达' };
        }
      }

      creep.moveTo(targetPos);
      return { success: true, completed: false, message: '移动到目标位置' };
    } else {
      // 不需要精确位置，范围内即可
      const distance = creep.pos.getRangeTo(targetPos);
      if (distance <= 1) {
        return { success: true, completed: false, message: '已在目标范围内' };
      }

      creep.moveTo(targetPos);
      return { success: true, completed: false, message: '移动到目标范围' };
    }
  }

  /**
   * 检查是否在范围内
   */
  protected isInRange(creep: Creep, target: RoomPosition | RoomObject, range: number = 1): boolean {
    const targetPos = target instanceof RoomPosition ? target : target.pos;
    return creep.pos.getRangeTo(targetPos) <= range;
  }

  /**
   * 检查creep是否即将死亡
   */
  protected isCreepDying(creep: Creep, threshold: number = 50): boolean {
    return creep.ticksToLive !== undefined && creep.ticksToLive < threshold;
  }

  /**
   * 检查creep是否携带指定资源
   */
  protected hasResource(creep: Creep, resourceType: ResourceConstant): boolean {
    return creep.store.getUsedCapacity(resourceType) > 0;
  }

  /**
   * 检查creep是否有空间
   */
  protected hasCapacity(creep: Creep, resourceType: ResourceConstant): boolean {
    return creep.store.getFreeCapacity(resourceType) > 0;
  }

  /**
   * 通用拾取方法
   */
  protected pickupResource(creep: Creep, target: Resource | Structure | Source, resourceType: ResourceConstant): TaskResult {
    // 检查目标类型并执行相应的拾取操作
    if (target instanceof Resource) {
      // 地面资源
      if (target.resourceType !== resourceType) {
        return { success: false, completed: false, message: `目标资源类型不匹配，期望: ${resourceType}，实际: ${target.resourceType}` };
      }

      const pickupResult = creep.pickup(target);
      return this.handlePickupResult(pickupResult, creep, target, '地面资源');
    } else if (target instanceof Structure) {
      // 建筑资源
      if (!('store' in target)) {
        return { success: false, completed: false, message: '目标建筑不支持存储' };
      }

      const storeStructure = target as any;
      if (storeStructure.store.getUsedCapacity(resourceType) === 0) {
        return { success: false, completed: false, message: `目标建筑没有${resourceType}资源` };
      }

      const withdrawResult = this.withdrawResource(creep, target, resourceType);
      return this.handleWithdrawResult(withdrawResult, creep, target, resourceType);
    } else if (target instanceof Source) {
      // 采集源
      if (resourceType !== RESOURCE_ENERGY) {
        return { success: false, completed: false, message: '采集源只能提供能量' };
      }

      const harvestResult = creep.harvest(target);
      return this.handleHarvestResult(harvestResult, creep, target);
    }

    return { success: false, completed: false, message: '不支持的目标类型' };
  }

  /**
   * 通用传输方法
   */
  protected transferResource(creep: Creep, target: Structure, resourceType: ResourceConstant): TaskResult {
    if (!('store' in target)) {
      return { success: false, completed: false, message: '目标建筑不支持存储' };
    }

    const transferResult = creep.transfer(target, resourceType);
    return this.handleTransferResult(transferResult, creep, target, resourceType);
  }

  /**
   * 通用丢弃方法
   */
  protected dropResource(creep: Creep, resourceType: ResourceConstant, targetPos?: RoomPosition): TaskResult {
    if (!this.hasResource(creep, resourceType)) {
      return { success: false, completed: false, message: `creep没有${resourceType}资源` };
    }

    if (targetPos) {
      // 丢弃到指定位置
      if (creep.pos.isEqualTo(targetPos)) {
        creep.drop(resourceType);
        return { success: true, completed: true, message: `已将${resourceType}丢弃到指定位置` };
      } else {
        const moveResult = this.smartMoveToTarget(creep, targetPos, true);
        if (!moveResult.success) {
          // 无法到达指定位置，在当前位置丢弃
          creep.drop(resourceType);
          return { success: true, completed: true, message: `无法到达指定位置，已在当前位置丢弃${resourceType}` };
        }
        return moveResult;
      }
    } else {
      // 在当前位置丢弃
      creep.drop(resourceType);
      return { success: true, completed: true, message: `已在当前位置丢弃${resourceType}` };
    }
  }

  /**
   * 通用取用方法（从建筑）
   */
  protected withdrawResource(creep: Creep, structure: Structure, resourceType: ResourceConstant, amount?: number): ScreepsReturnCode {
    // 检查是否是spawn且为能量资源
    if (structure.structureType === STRUCTURE_SPAWN && resourceType === RESOURCE_ENERGY) {
      return this.withdrawEnergySafely(creep, structure, amount);
    }

    // 其他情况正常取用
    return creep.withdraw(structure, resourceType, amount);
  }

  /**
   * 处理拾取结果
   */
  private handlePickupResult(result: ScreepsReturnCode, creep: Creep, target: Resource, targetType: string): TaskResult {
    switch (result) {
      case OK:
        return { success: true, completed: false, message: `正在拾取${targetType}` };
      case ERR_NOT_IN_RANGE:
        this.moveToTarget(creep, target);
        return { success: true, completed: false, message: `移动到${targetType}` };
      case ERR_FULL:
        return { success: true, completed: false, message: 'creep已满' };
      case ERR_INVALID_TARGET:
        return { success: false, completed: true, message: '无效的拾取目标' };
      default:
        return { success: false, completed: false, message: `拾取失败: ${result}` };
    }
  }

  /**
   * 处理取用结果
   */
  private handleWithdrawResult(result: ScreepsReturnCode, creep: Creep, target: Structure, resourceType: ResourceConstant): TaskResult {
    switch (result) {
      case OK:
        return { success: true, completed: false, message: `正在从${target.structureType}获取${resourceType}` };
      case ERR_NOT_IN_RANGE:
        this.moveToTarget(creep, target);
        return { success: true, completed: false, message: `移动到${target.structureType}` };
      case ERR_NOT_ENOUGH_RESOURCES:
        return { success: false, completed: true, message: `${target.structureType}资源不足` };
      case ERR_FULL:
        return { success: true, completed: false, message: 'creep已满' };
      case ERR_INVALID_TARGET:
        return { success: false, completed: true, message: '无效的取用目标' };
      default:
        return { success: false, completed: false, message: `取用失败: ${result}` };
    }
  }

  /**
   * 处理传输结果
   */
  private handleTransferResult(result: ScreepsReturnCode, creep: Creep, target: Structure, resourceType: ResourceConstant): TaskResult {
    switch (result) {
      case OK:
        return { success: true, completed: true, message: `${resourceType}传输完成` };
      case ERR_NOT_IN_RANGE:
        this.moveToTarget(creep, target);
        return { success: true, completed: false, message: `移动到${target.structureType}` };
      case ERR_FULL:
        return { success: false, completed: true, message: `${target.structureType}已满` };
      case ERR_INVALID_TARGET:
        return { success: false, completed: true, message: '无效的传输目标' };
      default:
        return { success: false, completed: false, message: `传输失败: ${result}` };
    }
  }

  /**
   * 处理采集结果
   */
  private handleHarvestResult(result: ScreepsReturnCode, creep: Creep, target: Source): TaskResult {
    switch (result) {
      case OK:
        return { success: true, completed: false, message: '正在采集' };
      case ERR_NOT_IN_RANGE:
        this.moveToTarget(creep, target);
        return { success: true, completed: false, message: '移动到采集源' };
      case ERR_NOT_ENOUGH_RESOURCES:
        return { success: true, completed: false, message: '等待采集源恢复' };
      case ERR_BUSY:
        return { success: true, completed: false, message: '等待孵化完成' };
      default:
        return { success: false, completed: false, message: `采集失败: ${result}` };
    }
  }

  /**
   * 通用能量获取方法
   */
  protected getEnergy(creep: Creep, sources?: Structure[], allowGroundPickup: boolean = true): TaskResult {
    // 如果指定了源建筑列表，优先从列表中获取
    if (sources && sources.length > 0) {
      const result = this.getEnergyFromStructures(creep, sources);
      if (result.success) {
        return result;
      }
    }

    // 从任意符合条件的建筑中获取能量
    const energyStructures = creep.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        if (!('store' in structure)) return false;
        const storeStructure = structure as any;
        return storeStructure.store && storeStructure.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
      }
    });

    if (energyStructures.length > 0) {
      const result = this.getEnergyFromStructures(creep, energyStructures);
      if (result.success) {
        return result;
      }
    }

    // 如果允许从地面拾取能量
    if (allowGroundPickup) {
      return this.pickupGroundEnergy(creep);
    }

    return { success: false, completed: false, message: '找不到可用的能量源' };
  }

  /**
   * 从地面拾取能量
   */
  protected pickupGroundEnergy(creep: Creep): TaskResult {
    const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: (resource) => resource.resourceType === RESOURCE_ENERGY
    });

    if (droppedEnergy.length > 0) {
      const closestEnergy = creep.pos.findClosestByPath(droppedEnergy);
      if (closestEnergy) {
        return this.pickupResource(creep, closestEnergy, RESOURCE_ENERGY);
      }
    }

    return { success: false, completed: false, message: '地面没有可用能量' };
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

  /**
   * 安全地从建筑中取用能量，确保spawn保留足够能量
   */
  protected withdrawEnergySafely(creep: Creep, structure: Structure, amount?: number): ScreepsReturnCode {
    // 检查是否是spawn
    if (structure.structureType === STRUCTURE_SPAWN) {
      const spawn = structure as StructureSpawn;
      const currentEnergy = spawn.store.getUsedCapacity(RESOURCE_ENERGY);
      const spawnCapacity = spawn.store.getCapacity(RESOURCE_ENERGY);
      const requestAmount = amount || creep.store.getFreeCapacity(RESOURCE_ENERGY);
      const minReserve = EnergyConfig.SPAWN_ENERGY_RESERVE.MIN_RESERVE;

      // 如果spawn接近满能量，允许正常取用
      if (currentEnergy >= spawnCapacity * EnergyConfig.SPAWN_ENERGY_RESERVE.FULL_CAPACITY_THRESHOLD) {
        return creep.withdraw(spawn, RESOURCE_ENERGY, amount);
      }

      // 如果取用后剩余能量少于最小保留量，调整取用量
      if (currentEnergy - requestAmount < minReserve) {
        const availableAmount = Math.max(0, currentEnergy - minReserve);
        if (availableAmount <= 0) {
          return ERR_NOT_ENOUGH_RESOURCES;
        }
        // 使用调整后的取用量
        return creep.withdraw(spawn, RESOURCE_ENERGY, availableAmount);
      }
    }

    // 非spawn建筑，正常取用
    return creep.withdraw(structure, RESOURCE_ENERGY, amount);
  }

  /**
   * 从建筑列表中安全地获取能量，优先从非spawn建筑获取
   */
  protected getEnergyFromStructures(creep: Creep, structures: Structure[]): TaskResult {
    // 分离spawn和非spawn建筑
    const spawns = structures.filter(s => s.structureType === STRUCTURE_SPAWN);
    const otherStructures = structures.filter(s => s.structureType !== STRUCTURE_SPAWN);

    // 优先从非spawn建筑获取能量
    for (const structure of otherStructures) {
      if ('store' in structure) {
        const storeStructure = structure as any;
        if (storeStructure.store && storeStructure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          const withdrawResult = creep.withdraw(structure, RESOURCE_ENERGY);

          switch (withdrawResult) {
            case OK:
              return { success: true, completed: false, message: `正在从${structure.structureType}获取能量` };
            case ERR_NOT_IN_RANGE:
              this.moveToTarget(creep, structure);
              return { success: true, completed: false, message: `移动到${structure.structureType}` };
            case ERR_NOT_ENOUGH_RESOURCES:
              continue; // 尝试下一个建筑
            case ERR_FULL:
              return { success: true, completed: false, message: 'creep已满' };
            default:
              continue; // 尝试下一个建筑
          }
        }
      }
    }

    // 如果非spawn建筑都没有能量，尝试从spawn获取（使用安全取用）
    for (const spawn of spawns) {
      if ('store' in spawn) {
        const storeStructure = spawn as any;
        const spawnEnergy = storeStructure.store.getUsedCapacity(RESOURCE_ENERGY);
        const spawnCapacity = storeStructure.store.getCapacity(RESOURCE_ENERGY);

        // 检查spawn是否有足够的能量（考虑保留量）
        const hasEnoughEnergy = spawnEnergy > EnergyConfig.SPAWN_ENERGY_RESERVE.MIN_RESERVE ||
                               spawnEnergy >= spawnCapacity * EnergyConfig.SPAWN_ENERGY_RESERVE.FULL_CAPACITY_THRESHOLD;

        if (storeStructure.store && spawnEnergy > 0 && hasEnoughEnergy) {
          const withdrawResult = this.withdrawEnergySafely(creep, spawn);

          switch (withdrawResult) {
            case OK:
              return { success: true, completed: false, message: '正在从spawn安全获取能量' };
            case ERR_NOT_IN_RANGE:
              this.moveToTarget(creep, spawn);
              return { success: true, completed: false, message: '移动到spawn' };
            case ERR_NOT_ENOUGH_RESOURCES:
              continue; // 尝试下一个spawn
            case ERR_FULL:
              return { success: true, completed: false, message: 'creep已满' };
            default:
              continue; // 尝试下一个spawn
          }
        }
      }
    }

    return { success: false, completed: false, message: '所有建筑都没有可用能量' };
  }
}
