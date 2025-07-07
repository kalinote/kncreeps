import { EventBus } from "../core/EventBus";
import { EnergyService, EnergySourceConfig, EnergySourceStrategy } from "../services/EnergyService";

/**
 * 行为执行结果
 */
export interface BehaviorResult {
  success: boolean;
  message?: string;
  nextState?: string;
}

/**
 * 重新导出能量相关类型以保持向后兼容
 */
export { EnergySourceStrategy, EnergySourceConfig } from "../services/EnergyService";

/**
 * 行为基类 - 所有具体行为的基础
 */
export abstract class BaseBehavior {
  protected eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * 执行行为的主要方法
   */
  public abstract run(creep: Creep): BehaviorResult;

  /**
   * 检查行为是否可以执行
   */
  public abstract canExecute(creep: Creep): boolean;

  /**
   * 行为优先级（数字越大优先级越高）
   */
  public abstract getPriority(): number;

  /**
   * 获取行为名称
   */
  public abstract getName(): string;

  /**
   * 获取能量获取配置 - 子类可重写
   */
  protected getEnergySourceConfig(): EnergySourceConfig {
    return EnergyService.getEnergySourceConfig(EnergySourceStrategy.STORAGE_ONLY);
  }

  /**
   * 获取角色名称 - 子类可重写以返回具体角色
   */
  protected getRoleName(): string {
    return "unknown";
  }

  /**
   * 寻找最佳能量源 - 使用EnergyService
   */
  protected findBestEnergySource(creep: Creep): Structure | Resource | Source | null {
    const config = this.getEnergySourceConfig();
    const roleName = this.getRoleName();
    return EnergyService.findBestEnergySource(creep, config, roleName);
  }

  /**
   * 验证能量源是否有效 - 使用EnergyService
   */
  protected isValidEnergySource(target: Structure | Resource | Source | null): boolean {
    const config = this.getEnergySourceConfig();
    const roleName = this.getRoleName();
    return EnergyService.isValidEnergySource(target, config, roleName);
  }

  /**
   * 通用的能量获取处理逻辑 - 使用EnergyService
   */
  protected handleEnergyCollection(creep: Creep, target: Structure | Resource | Source): ScreepsReturnCode {
    return EnergyService.handleEnergyCollection(creep, target);
  }

  /**
   * 安全执行方法，包装错误处理
   */
  protected safeExecute(action: () => BehaviorResult, context: string): BehaviorResult {
    try {
      return action();
    } catch (error) {
      console.log(`[${context}] 行为执行错误: ${error}`);
      return { success: false, message: `执行错误: ${error}` };
    }
  }

  /**
   * 通用的移动到目标方法
   */
  protected moveToTarget(creep: Creep, target: RoomPosition | RoomObject): ScreepsReturnCode {
    return creep.moveTo(target, {
      visualizePathStyle: { stroke: '#ffffff' },
      reusePath: 10
    });
  }

  /**
   * 检查creep是否需要能量 - 使用EnergyService
   */
  protected needsEnergy(creep: Creep): boolean {
    return EnergyService.needsEnergy(creep);
  }

  /**
   * 检查creep是否携带能量 - 使用EnergyService
   */
  protected hasEnergy(creep: Creep): boolean {
    return EnergyService.hasEnergy(creep);
  }
}
