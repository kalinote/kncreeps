/**
 * 事件相关配置
 */
export class EventConfig {
  // 事件类型
  public static readonly EVENTS = {
    // Creep相关事件
    CREEP_SPAWNED: 'creep.spawned',                     // 单位生成
    CREEP_DIED: 'creep.died',                           // 单位死亡
    CREEP_TASK_ASSIGNED: 'creep.task.assigned',         // 单位任务分配
    CREEP_TASK_COMPLETED: 'creep.task.completed',       // 单位任务完成
    CREEP_PRODUCTION_NEEDED: 'creep.production.needed', // 单位生产需求

    // Room相关事件
    ROOM_ENERGY_CHANGED: 'room.energy.changed',        // 房间能量变化
    ROOM_UNDER_ATTACK: 'room.under.attack',             // 房间受到攻击
    ROOM_THREAT_CLEARED: 'room.threat.cleared',         // 房间威胁清除
    ROOM_THREAT_PERSISTS: 'room.threat.persists',       // 房间威胁持续存在
    ROOM_NEEDS_ATTENTION: 'room.needs.attention',       // 房间需要关注
    ROOM_CONTROLLER_LEVEL_CHANGED: 'room.controller.level.changed', // 房间控制器等级变化

    // 建筑相关事件
    CONSTRUCTION_COMPLETED: 'construction.completed',   // 建筑完成
    CONSTRUCTION_RESOURCE_DEPLETED: 'construction.resource.depleted', // 建筑资源耗尽

    // 建筑规划相关事件
    CONSTRUCTION_PLAN_CREATED: 'construction.plan.created', // 建筑规划创建
    CONSTRUCTION_PLAN_UPDATED: 'construction.plan.updated', // 建筑规划更新
    CONSTRUCTION_PLAN_FAILED: 'construction.plan.failed', // 建筑规划失败
    CONSTRUCTION_PLAN_CANCELLED: 'construction.plan.cancelled', // 建筑规划取消
    CONSTRUCTION_PLAN_COMPLETED: 'construction.plan.completed', // 建筑规划完成

    // 战斗相关事件
    COMBAT_ENEMY_SPOTTED: 'combat.enemy.spotted',                     // 敌人出现
    COMBAT_STARTED: 'combat.started',                   // 战斗开始
    COMBAT_ENDED: 'combat.ended',                       // 战斗结束
    COMBAT_DEFENDER_ENGAGED: 'combat.defender.engaged',               // 防御单位开始攻击
    COMBAT_DEFENDER_RETREATING: 'combat.defender.retreating',         // 防御单位撤退

    // 任务系统相关事件
    TASK_CREATED: 'task.created',                       // 任务创建
    TASK_COMPLETED: 'task.completed',                   // 任务完成
    TASK_FAILED: 'task.failed',                         // 任务失败
    TASK_STARTED: 'task.started',                       // 任务开始执行
    TASK_PROGRESS: 'task.progress',                     // 任务进度更新

    // 系统相关事件
    SYSTEM_ERROR: 'system.error',                       // 系统错误
    MANAGER_ERROR: 'manager.error',                     // 管理器错误
    SYSTEM_CLEANUP: 'system.cleanup',                   // 系统清理
    STATS_UPDATED: 'stats.updated',                     // 统计信息更新
    COORDINATION_NEEDED: 'coordination.needed',         // 需要协调

    // 可视化相关事件
    LAYER_TOGGLED: 'visual.layer.toggled',
    LAYER_UPDATED: 'visual.layer.updated',
    VISUAL_CLEARED: 'visual.cleared',
    VISUAL_OVERFLOW: 'visual.overflow',
    // 可视化系统事件
    VISUALS_DRAW_REQUEST: 'visuals.draw.request', // 由 VisualManager 发出，请求绘制
    VISUALS_REFRESHED: 'visuals.refreshed', // 由 VisualManager 发出，通知刷新完成
  } as const;
}
