import { BaseBehavior, BehaviorResult, EnergySourceStrategy, EnergySourceConfig } from "./BaseBehavior";
import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";

/**
 * 升级工行为状态
 */
enum UpgraderState {
  IDLE = "idle",
  MOVING_TO_ENERGY_SOURCE = "moving_to_energy_source",
  HARVESTING_ENERGY = "harvesting_energy",
  MOVING_TO_CONTROLLER = "moving_to_controller",
  UPGRADING = "upgrading"
}

/**
 * 升级工行为类
 * 负责升级房间控制器
 */
export class UpgraderBehavior extends BaseBehavior {
  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  /**
   * 获取能量获取配置 - 升级工使用存储建筑策略
   */
  protected getEnergySourceConfig(): EnergySourceConfig {
    return {
      strategy: EnergySourceStrategy.STORAGE_ONLY,
      allowSpawn: true,
      allowExtensions: true,
      allowContainers: true,
      allowStorage: true,
      allowDroppedResources: false,
      allowDirectHarvest: false,
      minEnergyThreshold: 0
    };
  }

  /**
   * 获取角色名称
   */
  protected getRoleName(): string {
    return GameConfig.ROLES.UPGRADER;
  }

  public run(creep: Creep): BehaviorResult {
    return this.safeExecute(() => {
      // 初始化creep状态
      if (!creep.memory.state) {
        creep.memory.state = UpgraderState.IDLE;
      }

      const state = creep.memory.state as UpgraderState;

      // 状态机逻辑
      switch (state) {
        case UpgraderState.IDLE:
          return this.decideNextAction(creep);

        case UpgraderState.MOVING_TO_ENERGY_SOURCE:
        case UpgraderState.HARVESTING_ENERGY:
          return this.handleEnergyHarvesting(creep);

        case UpgraderState.MOVING_TO_CONTROLLER:
        case UpgraderState.UPGRADING:
          return this.handleUpgrading(creep);

        default:
          creep.memory.state = UpgraderState.IDLE;
          return this.decideNextAction(creep);
      }
    }, `UpgraderBehavior.run(${creep.name})`);
  }

  /**
   * 决定下一步行动
   */
  private decideNextAction(creep: Creep): BehaviorResult {
    // 如果没有能量，优先获取能量
    if (this.needsEnergy(creep)) {
      creep.memory.state = UpgraderState.MOVING_TO_ENERGY_SOURCE;
      return this.handleEnergyHarvesting(creep);
    }

    // 如果有能量，去升级控制器
    if (this.hasEnergy(creep)) {
      creep.memory.state = UpgraderState.MOVING_TO_CONTROLLER;
      return this.handleUpgrading(creep);
    }

    return { success: true, message: "等待任务分配" };
  }

  /**
   * 处理能量获取逻辑
   */
  private handleEnergyHarvesting(creep: Creep): BehaviorResult {
    console.log(`[${creep.name}] 升级工寻找能量源，当前能量: ${creep.store.getUsedCapacity(RESOURCE_ENERGY)}/${creep.store.getCapacity(RESOURCE_ENERGY)}`);

    const energySource = this.findBestEnergySource(creep);
    if (!energySource) {
      console.log(`[${creep.name}] 升级工未找到能量源，配置: ${JSON.stringify(this.getEnergySourceConfig())}`);
      return { success: false, message: "未找到能量源" };
    }

    console.log(`[${creep.name}] 升级工选择能量源: ${energySource.constructor.name}`);

    // 保存目标到内存
    creep.memory.targetId = energySource.id;

    // 使用基类的通用能量获取方法
    const harvestResult = this.handleEnergyCollection(creep, energySource);

    switch (harvestResult) {
      case OK:
        creep.memory.state = UpgraderState.HARVESTING_ENERGY;
        // 检查是否已满
        if (creep.store.getFreeCapacity() === 0) {
          creep.memory.state = UpgraderState.IDLE;
          delete creep.memory.targetId;
        }
        return { success: true, message: "正在获取能量" };

      case ERR_NOT_IN_RANGE:
        creep.memory.state = UpgraderState.MOVING_TO_ENERGY_SOURCE;
        this.moveToTarget(creep, energySource);
        return { success: true, message: "移动到能量源" };

      case ERR_NOT_ENOUGH_RESOURCES:
        // 目标资源不足，清除目标重新寻找
        delete creep.memory.targetId;
        creep.memory.state = UpgraderState.IDLE;
        return { success: true, message: "目标资源不足，重新寻找" };

      case ERR_FULL:
        // 已满，去工作
        creep.memory.state = UpgraderState.IDLE;
        delete creep.memory.targetId;
        return { success: true, message: "能量已满，准备工作" };

      default:
        return { success: false, message: `获取能量失败: ${harvestResult}` };
    }
  }

  /**
   * 处理升级逻辑
   */
  private handleUpgrading(creep: Creep): BehaviorResult {
    // 检查是否还有能量
    if (!this.hasEnergy(creep)) {
      creep.memory.state = UpgraderState.IDLE;
      return { success: true, message: "能量不足，重新获取" };
    }

    // 获取控制器
    const controller = creep.room.controller;
    if (!controller || !controller.my) {
      return { success: false, message: "没有可升级的控制器" };
    }

    const upgradeResult = creep.upgradeController(controller);

    switch (upgradeResult) {
      case OK:
        creep.memory.state = UpgraderState.UPGRADING;
        return { success: true, message: "正在升级控制器" };

      case ERR_NOT_IN_RANGE:
        creep.memory.state = UpgraderState.MOVING_TO_CONTROLLER;
        this.moveToTarget(creep, controller);
        return { success: true, message: "移动到控制器" };

      case ERR_NOT_ENOUGH_RESOURCES:
        // 能量不足，去获取能量
        creep.memory.state = UpgraderState.IDLE;
        return { success: true, message: "能量不足，重新获取" };

      case ERR_INVALID_TARGET:
        return { success: false, message: "无效的升级目标" };

      default:
        return { success: false, message: `升级失败: ${upgradeResult}` };
    }
  }

  /**
   * 检查行为是否可以执行 - 当房间有控制器时需要升级工
   */
  public canExecute(creep: Creep): boolean {
    return creep.room.controller && creep.room.controller.my ? true : false;
  }

  /**
   * 获取行为优先级
   */
  public getPriority(): number {
    return GameConfig.PRIORITIES.MEDIUM;
  }

  /**
   * 获取行为名称
   */
  public getName(): string {
    return "UpgraderBehavior";
  }
}
