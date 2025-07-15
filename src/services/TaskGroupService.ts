import { BaseService } from "./BaseService";
import { EventBus } from "../core/EventBus";
import { ServiceContainer } from "../core/ServiceContainer";
import { EventConfig } from "../config/EventConfig";
import { TaskKind } from "../types";

/**
 * 任务组信息
 */
export interface TaskGroup {
  id: string;
  kind: TaskKind;
  members: string[];           // creep名称列表
  meta?: Record<string, any>; // 组元数据
  createdAt: number;
  lastActivity: number;
}

/**
 * 任务组服务
 * 负责管理多creep协同执行任务
 */
export class TaskGroupService extends BaseService {
  private groups: Map<string, TaskGroup> = new Map();

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
  }

  /**
   * 创建任务组
   * @param kind 任务类型
   * @param meta 组元数据
   * @returns 组ID
   */
  public createGroup(kind: TaskKind, meta?: Record<string, any>): string {
    const groupId = `group_${Game.time}_${Math.floor(Math.random() * 1000)}`;

    const group: TaskGroup = {
      id: groupId,
      kind,
      members: [],
      meta,
      createdAt: Game.time,
      lastActivity: Game.time
    };

    this.groups.set(groupId, group);

    this.emit(EventConfig.EVENTS.COORDINATION_NEEDED, {
      type: 'group_created',
      groupId,
      kind,
      meta
    });

    console.log(`[TaskGroupService] 创建任务组: ${groupId}, 类型: ${kind}`);
    return groupId;
  }

  /**
   * 加入任务组
   * @param creep 要加入的creep
   * @param groupId 组ID
   * @returns 是否成功加入
   */
  public joinGroup(creep: Creep, groupId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      console.log(`[TaskGroupService] 任务组不存在: ${groupId}`);
      return false;
    }

    if (group.members.includes(creep.name)) {
      return true; // 已经是成员
    }

    group.members.push(creep.name);
    group.lastActivity = Game.time;

    this.emit(EventConfig.EVENTS.COORDINATION_NEEDED, {
      type: 'member_joined',
      groupId,
      creepName: creep.name
    });

    console.log(`[TaskGroupService] Creep ${creep.name} 加入任务组: ${groupId}`);
    return true;
  }

  /**
   * 离开任务组
   * @param creep 要离开的creep
   * @param groupId 组ID
   */
  public leaveGroup(creep: Creep, groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) {
      return;
    }

    const index = group.members.indexOf(creep.name);
    if (index > -1) {
      group.members.splice(index, 1);
      group.lastActivity = Game.time;

      this.emit(EventConfig.EVENTS.COORDINATION_NEEDED, {
        type: 'member_left',
        groupId,
        creepName: creep.name
      });

      console.log(`[TaskGroupService] Creep ${creep.name} 离开任务组: ${groupId}`);
    }
  }

  /**
   * 向组内广播消息
   * @param groupId 组ID
   * @param message 消息内容
   */
  public broadcast(groupId: string, message: any): void {
    const group = this.groups.get(groupId);
    if (!group) {
      return;
    }

    this.emit(EventConfig.EVENTS.COORDINATION_NEEDED, {
      type: 'group_broadcast',
      groupId,
      message,
      members: group.members
    });

    group.lastActivity = Game.time;
  }

  /**
   * 获取任务组信息
   * @param groupId 组ID
   * @returns 任务组信息
   */
  public getGroup(groupId: string): TaskGroup | undefined {
    return this.groups.get(groupId);
  }

  /**
   * 获取creep所属的任务组
   * @param creepName creep名称
   * @returns 组ID，如果没有则返回undefined
   */
  public getCreepGroup(creepName: string): string | undefined {
    for (const [groupId, group] of this.groups) {
      if (group.members.includes(creepName)) {
        return groupId;
      }
    }
    return undefined;
  }

  /**
   * 解散任务组
   * @param groupId 组ID
   */
  public dissolveGroup(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) {
      return;
    }

    this.emit(EventConfig.EVENTS.COORDINATION_NEEDED, {
      type: 'group_dissolved',
      groupId,
      members: group.members
    });

    this.groups.delete(groupId);
    console.log(`[TaskGroupService] 解散任务组: ${groupId}`);
  }

  /**
   * 清理过期任务组
   * @param maxAge 最大年龄（tick）
   */
  public cleanupExpiredGroups(maxAge: number = 1000): void {
    const now = Game.time;
    const expiredGroups: string[] = [];

    for (const [groupId, group] of this.groups) {
      if (now - group.lastActivity > maxAge) {
        expiredGroups.push(groupId);
      }
    }

    for (const groupId of expiredGroups) {
      this.dissolveGroup(groupId);
    }

    if (expiredGroups.length > 0) {
      console.log(`[TaskGroupService] 清理了 ${expiredGroups.length} 个过期任务组`);
    }
  }

  /**
   * 获取所有任务组
   */
  public getAllGroups(): Map<string, TaskGroup> {
    return new Map(this.groups);
  }

  /**
   * 获取任务组统计信息
   */
  public getGroupStats(): any {
    const stats = {
      totalGroups: this.groups.size,
      totalMembers: 0,
      groupsByKind: {} as Record<string, number>
    };

    for (const group of this.groups.values()) {
      stats.totalMembers += group.members.length;
      stats.groupsByKind[group.kind] = (stats.groupsByKind[group.kind] || 0) + 1;
    }

    return stats;
  }
}
