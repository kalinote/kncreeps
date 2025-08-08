import { EventBus } from "../../core/EventBus";
import { BaseService } from "../BaseService";
import { LogisticsManager } from "../../managers/LogisticsManager";
import { SupplyRequestMemory, SupplyRequestServiceMemory } from "../../types";

// TODO 临时定义的参数，后续可能需要优化
const ETA_PARAMS = {
  beta: 1.2,          // 路径到达的放大系数
  overhead: 3,        // 处理开销
  minWait: 5,         // 最小等待
  maxWait: 60         // 最大等待
};

export class SupplyService extends BaseService<SupplyRequestServiceMemory, LogisticsManager> {
  protected onUpdate(): void { }
  protected onReset(): void { }

  constructor(eventBus: EventBus, manager: LogisticsManager, memory: any) {
    super(eventBus, manager, memory, 'supplyRequestService');
  }

  protected onInitialize(): void {
    if (!this.memory.initAt) {
      this.memory.initAt = Game.time;
      this.memory.lastUpdate = Game.time;
      this.memory.lastCleanup = Game.time;
      this.memory.errorCount = 0;
      this.memory.requests = {};
    }
  }

  protected onCleanup(): void {
    // 每 20 tick 清理一次
    // TODO 后续可以考虑通过配置文件来设置清理间隔
    if (Game.time - (this.memory.lastCleanup || 0) < 20) return;

    for (const roomName in this.memory.requests) {
      const arr = this.memory.requests[roomName] || [];
      for (let i = arr.length - 1; i >= 0; i--) {
        const req = arr[i];
        const creep = Game.creeps[req.creepName];
        const expired = req.expiresAt && Game.time > req.expiresAt;
        const wrongRoom = creep && creep.room.name !== roomName;
        const satisfied = creep && creep.store.getFreeCapacity(req.resourceType) === 0;

        if (!creep || expired || wrongRoom || satisfied) {
          // 注销 consumer + 移除请求
          this.cancelInternal(roomName, req.creepName, req.resourceType);
        }
      }
    }

    this.memory.lastCleanup = Game.time;
  }


  // 私有：确保房间请求数组存在
  private ensureRoomRequests(roomName: string): { room: string; list: SupplyRequestMemory[] } {
    if (!this.memory.requests[roomName]) this.memory.requests[roomName] = [];
    return { room: roomName, list: this.memory.requests[roomName] };
  }

  // 私有：生成请求ID
  private buildRequestId(roomName: string, creepName: string, resourceType: ResourceConstant) {
    return `${roomName}:${creepName}:${resourceType}`;
  }

  // 私有：内部取消实现（不校验creep是否存在）
  private cancelInternal(roomName: string, creepName: string, resourceType?: ResourceConstant) {
    const { list } = this.ensureRoomRequests(roomName);
    // 移除 consumer（由于TransportService以id为key，重复删除安全）
    const creep = Game.creeps[creepName];
    if (creep) {
      this.manager.transportService.removeConsumer(creep, roomName);
    }
    // 移除请求
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if (it.creepName === creepName && (!resourceType || it.resourceType === resourceType)) {
        list.splice(i, 1);
      }
    }
  }

  // TODO FSM 缺资源时调用：注册 creep 为 consumer，并返回建议等待时长（动态 ETA 转换）
  public request(creep: Creep, resourceType: ResourceConstant, amount?: number, opts?: { urgency?: 'normal' | 'high' }): { requestId: string; suggestedWait: number } {
    const room = creep.room;
    const roomName = room.name;
    const creepName = creep.name;

    const requestId = this.buildRequestId(roomName, creepName, resourceType);

    // 注册为consumer（不写死资源类型）
    this.manager.transportService.setConsumer(creep, roomName, resourceType);

    // 估算ETA并转化为建议等待tick
    const suggestedWait = this.estimateETA(room, creep.pos, resourceType, amount);

    // 记录请求（幂等）
    const { list } = this.ensureRoomRequests(roomName);
    const exists = list.find(r => r.id === requestId);
    if (!exists) {
      list.push({
        id: requestId,
        creepName,
        roomName,
        resourceType,
        amount,
        createdAt: Game.time,
        suggestedWait,
        // 也可以不设 expiresAt，完全由清理逻辑判断
      });
    } else {
      exists.suggestedWait = suggestedWait;
      exists.amount = amount;
      exists.createdAt = Game.time;
    }

    return { requestId, suggestedWait };
  }

  // TODO 资源满足/任务结束/离开房间等时调用
  public cancel(creep: Creep, resourceType?: ResourceConstant): void {
    const roomName = creep.room.name;
    this.cancelInternal(roomName, creep.name, resourceType);
  }

  // TODO 动态 ETA 估计（供 FSM 决策等待时长）
  public estimateETA(room: Room, pos: RoomPosition, resourceType: ResourceConstant, minAmount?: number): number {
    // 从运输网络拿可用provider
    const providers = this.manager.transportService
      .getProviders(room.name)
      .filter(p =>
        p.resourceType === resourceType &&
        p.status === 'ready' &&
        (minAmount ? ((p.amount ?? 9999) >= minAmount) : true)
      );

    if (providers.length === 0) {
      // 网络暂不可用，给一个保守等待时间（也可返回 minWait 让FSM尽快考虑自取）
      return ETA_PARAMS.maxWait;
    }

    // 计算路径最短距离
    let best = Infinity;
    for (const p of providers) {
      const goal = { pos: new RoomPosition(p.pos.x, p.pos.y, p.pos.roomName), range: 1 };
      const res = PathFinder.search(pos, goal, {
        plainCost: 2,
        swampCost: 10,
        maxOps: 2000
      });
      const dist = res.incomplete ? pos.getRangeTo(goal.pos) + 20 : res.path.length;
      if (dist < best) best = dist;
    }

    const raw = Math.ceil(best * ETA_PARAMS.beta + ETA_PARAMS.overhead);
    return Math.max(ETA_PARAMS.minWait, Math.min(ETA_PARAMS.maxWait, raw))
  }

  // TODO 超时兜底的“自取”方案建议（返回计划，由 FSM 执行 withdraw/pickup）
  public suggestSelfFetchPlan(creep: Creep, resourceType: ResourceConstant, minAmount?: number): { sourceId?: string; sourcePos?: { x: number; y: number; roomName: string } } | null {
    // 能源优先复用现有EnergyService的本地寻找逻辑
    if (resourceType === RESOURCE_ENERGY) {
      const sources = this.manager.energyService.findEnergySources(creep);
      if (sources.length > 0) {
        const obj = sources[0].object;
        if (obj instanceof Resource) {
          return { sourcePos: { x: obj.pos.x, y: obj.pos.y, roomName: obj.pos.roomName } };
        } else {
          return { sourceId: obj.id };
        }
      }
    }

    // 其他资源：走运输网络的最近provider
    const provider = this.manager.transportService.getClosestProvider(creep.room, creep.pos, resourceType);
    if (!provider) return null;

    if (provider.type === 'droppedResource') {
      return { sourcePos: provider.pos };
    }
    return { sourceId: provider.id };
  }

}
