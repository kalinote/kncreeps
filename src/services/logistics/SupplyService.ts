import { EventBus } from "../../core/EventBus";
import { BaseService } from "../BaseService";
import { LogisticsManager } from "../../managers/LogisticsManager";
import { SupplyRequestServiceMemory } from "../../types";

// TODO 临时定义的参数，后续可能需要优化
const ETA_PARAMS = {
  beta: 1.2,          // 路径到达的放大系数
  overhead: 3,        // 处理开销
  minWait: 5,         // 最小等待
  maxWait: 60         // 最大等待
};

export class SupplyService extends BaseService<SupplyRequestServiceMemory, LogisticsManager> {
  protected onUpdate(): void {}
  protected onCleanup(): void {}
  protected onReset(): void {}

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

  // TODO FSM 缺资源时调用：注册 creep 为 consumer，并返回建议等待时长（动态 ETA 转换）
  public request() {}

  // TODO 资源满足/任务结束/离开房间等时调用
  public cancel() {}

  // TODO 动态 ETA 估计（供 FSM 决策等待时长）
  public estimateETA() {}

  // TODO 超时兜底的“自取”方案建议（返回计划，由 FSM 执行 withdraw/pickup）
  public suggestSelfFetchPlan() {}
}
