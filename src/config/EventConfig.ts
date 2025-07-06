/**
 * 事件相关配置
 */
export class EventConfig {
  // 事件类型
  public static readonly EVENTS = {
    CREEP_SPAWNED: 'creep.spawned',
    CREEP_DIED: 'creep.died',
    CREEP_TASK_ASSIGNED: 'creep.task.assigned',
    CREEP_TASK_COMPLETED: 'creep.task.completed',
    ROOM_ENERGY_CHANGED: 'room.energy.changed',
    ROOM_UNDER_ATTACK: 'room.under.attack',
    CONSTRUCTION_COMPLETED: 'construction.completed',
    RESOURCE_DEPLETED: 'resource.depleted',
    // 防御相关事件
    ENEMY_SPOTTED: 'enemy.spotted',
    COMBAT_STARTED: 'combat.started',
    COMBAT_ENDED: 'combat.ended',
    DEFENDER_ENGAGED: 'defender.engaged',
    DEFENDER_RETREATING: 'defender.retreating'
  } as const;
}
