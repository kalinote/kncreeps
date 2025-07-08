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
    // Room相关事件
    ROOM_ENERGY_CHANGED: 'room.energy.changed',        // 房间能量变化
    ROOM_UNDER_ATTACK: 'room.under.attack',             // 房间受到攻击
    ROOM_NEEDS_ATTENTION: 'room.needs.attention',       // 房间需要关注

    // 建筑相关事件
    CONSTRUCTION_COMPLETED: 'construction.completed',   // 建筑完成
    CONSTRUCTION_RESOURCE_DEPLETED: 'construction.resource.depleted', // 建筑资源耗尽

    // 战斗相关事件
    COMBAT_ENEMY_SPOTTED: 'combat.enemy.spotted',                     // 敌人出现
    COMBAT_STARTED: 'combat.started',                   // 战斗开始
    COMBAT_ENDED: 'combat.ended',                       // 战斗结束
    COMBAT_DEFENDER_ENGAGED: 'combat.defender.engaged',               // 防御单位开始攻击
    COMBAT_DEFENDER_RETREATING: 'combat.defender.retreating',         // 防御单位撤退

    // 任务系统相关事件
    TASK_CREATED: 'task.created',                       // 任务创建
    TASK_COMPLETED: 'task.completed',                   // 任务完成
    TASK_FAILED: 'task.failed'                          // 任务失败
  } as const;
}
