/**
 * 角色相关配置 - 简化后的角色系统
 */
export class RoleConfig {
  // 角色类型 - 简化后的角色定义
  public static readonly ROLES = {
    WORKER: 'worker',             // 通用工作者：采集、建造、升级
    TRANSPORTER: 'transporter',   // 搬运工，用于搬运资源
    SHOOTER: 'shooter',           // 战斗单位，用于防御和攻击
  } as const;

  // 优先级
  public static readonly PRIORITIES = {
    CRITICAL: 10,
    HIGH: 8,
    MEDIUM: 5,
    LOW: 2,
    MINIMAL: 1
  } as const;

  // 角色权限配置
  public static readonly ROLE_PERMISSIONS = {
    // 允许捡拾地面掉落资源的角色
    CAN_PICKUP_DROPPED_RESOURCES: [
      RoleConfig.ROLES.TRANSPORTER,
      RoleConfig.ROLES.WORKER  // 工作者在必要时也可以捡拾
    ],

    // 只能从存储建筑获取资源的角色
    STORAGE_ONLY_ROLES: [
      RoleConfig.ROLES.WORKER  // 工作者主要从存储建筑获取资源
    ]
  } as const;

  // 角色数量配置
  public static readonly ROLE_LIMITS = {
    // 全局限制配置
    GLOBAL: {
      MAX_CREEPS_PER_ROOM: 150,
      MIN_ENERGY_RESERVE: 100
    },

    // 按房间控制器等级的角色数量限制（提高上限以支持任务驱动生产）
    BY_RCL: {
      1: {
        [RoleConfig.ROLES.WORKER]: { min: 2, max: 12, priority: RoleConfig.PRIORITIES.HIGH },
        [RoleConfig.ROLES.TRANSPORTER]: { min: 0, max: 6, priority: RoleConfig.PRIORITIES.MEDIUM },
        [RoleConfig.ROLES.SHOOTER]: { min: 0, max: 2, priority: RoleConfig.PRIORITIES.MINIMAL }
      },
      2: {
        [RoleConfig.ROLES.WORKER]: { min: 2, max: 14, priority: RoleConfig.PRIORITIES.HIGH },
        [RoleConfig.ROLES.TRANSPORTER]: { min: 0, max: 6, priority: RoleConfig.PRIORITIES.MEDIUM },
        [RoleConfig.ROLES.SHOOTER]: { min: 0, max: 2, priority: RoleConfig.PRIORITIES.MINIMAL }
      },
      3: {
        [RoleConfig.ROLES.WORKER]: { min: 2, max: 16, priority: RoleConfig.PRIORITIES.HIGH },
        [RoleConfig.ROLES.TRANSPORTER]: { min: 1, max: 8, priority: RoleConfig.PRIORITIES.MEDIUM },
        [RoleConfig.ROLES.SHOOTER]: { min: 0, max: 2, priority: RoleConfig.PRIORITIES.MINIMAL }
      },
      4: {
        [RoleConfig.ROLES.WORKER]: { min: 2, max: 18, priority: RoleConfig.PRIORITIES.HIGH },
        [RoleConfig.ROLES.TRANSPORTER]: { min: 1, max: 8, priority: RoleConfig.PRIORITIES.MEDIUM },
        [RoleConfig.ROLES.SHOOTER]: { min: 0, max: 4, priority: RoleConfig.PRIORITIES.MINIMAL }
      },
      5: {
        [RoleConfig.ROLES.WORKER]: { min: 3, max: 20, priority: RoleConfig.PRIORITIES.HIGH },
        [RoleConfig.ROLES.TRANSPORTER]: { min: 2, max: 12, priority: RoleConfig.PRIORITIES.MEDIUM },
        [RoleConfig.ROLES.SHOOTER]: { min: 0, max: 4, priority: RoleConfig.PRIORITIES.MINIMAL }
      },
      6: {
        [RoleConfig.ROLES.WORKER]: { min: 3, max: 22, priority: RoleConfig.PRIORITIES.HIGH },
        [RoleConfig.ROLES.TRANSPORTER]: { min: 2, max: 14, priority: RoleConfig.PRIORITIES.MEDIUM },
        [RoleConfig.ROLES.SHOOTER]: { min: 0, max: 6, priority: RoleConfig.PRIORITIES.MINIMAL }
      },
      7: {
        [RoleConfig.ROLES.WORKER]: { min: 4, max: 26, priority: RoleConfig.PRIORITIES.HIGH },
        [RoleConfig.ROLES.TRANSPORTER]: { min: 3, max: 16, priority: RoleConfig.PRIORITIES.MEDIUM },
        [RoleConfig.ROLES.SHOOTER]: { min: 0, max: 8, priority: RoleConfig.PRIORITIES.MINIMAL }
      },
      8: {
        [RoleConfig.ROLES.WORKER]: { min: 4, max: 30, priority: RoleConfig.PRIORITIES.HIGH },
        [RoleConfig.ROLES.TRANSPORTER]: { min: 3, max: 20, priority: RoleConfig.PRIORITIES.MEDIUM },
        [RoleConfig.ROLES.SHOOTER]: { min: 0, max: 8, priority: RoleConfig.PRIORITIES.MINIMAL }
      }
    }
  } as const;

  /**
   * 获取房间指定角色的数量限制
   */
  public static getRoleLimits(roomLevel: number, role: string): { min: number; max: number; priority: number } | null {
    const config = RoleConfig.ROLE_LIMITS.BY_RCL[roomLevel as keyof typeof RoleConfig.ROLE_LIMITS.BY_RCL];
    if (!config || !(config as any)[role]) {
      return null;
    }
    return (config as any)[role];
  }

  /**
   * 检查是否可以生产更多指定角色的creep
   */
  public static canProduceMoreCreeps(
    roomLevel: number,
    role: string,
    currentCount: number,
    totalCreepsInRoom: number
  ): boolean {
    // 检查全局房间creep上限
    if (totalCreepsInRoom >= RoleConfig.ROLE_LIMITS.GLOBAL.MAX_CREEPS_PER_ROOM) {
      return false;
    }

    // 检查角色特定限制
    const limits = RoleConfig.getRoleLimits(roomLevel, role);
    if (!limits) {
      return false;
    }

    return currentCount < limits.max;
  }

  /**
   * 检查是否需要生产指定角色的creep
   */
  public static needsMoreCreeps(roomLevel: number, role: string, currentCount: number): boolean {
    const limits = RoleConfig.getRoleLimits(roomLevel, role);
    if (!limits) {
      return false;
    }

    return currentCount < limits.min;
  }

  /**
   * 获取角色生产优先级
   */
  public static getRolePriority(roomLevel: number, role: string): number {
    const limits = RoleConfig.getRoleLimits(roomLevel, role);
    return limits ? limits.priority : 999;
  }

  /**
   * 获取房间所有角色的配置
   */
  public static getRoomRoleConfig(roomLevel: number): { [role: string]: { min: number; max: number; priority: number } } {
    return RoleConfig.ROLE_LIMITS.BY_RCL[roomLevel as keyof typeof RoleConfig.ROLE_LIMITS.BY_RCL] || {};
  }

  /**
   * 检查角色是否可以捡拾地面掉落资源
   */
  public static canPickupDroppedResources(role: string): boolean {
    return RoleConfig.ROLE_PERMISSIONS.CAN_PICKUP_DROPPED_RESOURCES.includes(role as any);
  }

  /**
   * 检查角色是否只能从存储建筑获取资源
   */
  public static isStorageOnlyRole(role: string): boolean {
    return RoleConfig.ROLE_PERMISSIONS.STORAGE_ONLY_ROLES.includes(role as any);
  }
}
