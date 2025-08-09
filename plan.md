## 项目规划：后勤运输统一供给（SupplyService）接入与 FSM 改造

本计划文档汇总了截至目前关于后勤运输网络、任务生成、运输类 Creep 生产的分析、讨论、问答与决策；并给出 SupplyService 的落地方案、FSM 执行器接入方式、阶段性里程碑与待办清单。

### 一、系统现状与端到端流程（概述）

- 运输网络（`TransportService`）
  - 按房间维护 `providers`/`consumers`，动态扫描掉落物与墓碑作为供给点，定期 GC；监听工地创建（规划更新）与建造完成事件，将工地阶段的供需角色迁移到新建筑 id。
  - 生成运输任务建议：对每个需求方计算“重要度×紧急度”的优先级，按“就近贪心+多源补齐”生成任务请求；掉落物用 `sourcePos`，建筑用 `sourceId`。

- 任务生成（`TaskGeneratorService`）
  - 获取运输任务建议；与现有运输任务去重后落地为任务队列。

- 任务调度与执行（`TaskSchedulerService`/`TaskExecutionService`/FSM）
  - 调度器按动态有效优先级分配任务；执行服务基于 FSM 执行器驱动 creep 完成任务。

- Creep 生产（`CreepProductionService`）
  - 基于 pending 任务与角色上限评估生产需求；对运输任务有专门的“需求计算”，并确保房间的 RCL 最小角色配置。


### 二、已发现问题与修复建议（逻辑层面）

1) 工地建成后 provider 未切回 ready
- 位置：`TransportService.handleConstructionCompleted`
- 影响：`getAvailableSources` 只接受 `status==='ready'`，导致新建容器/储能不参与供给。
- 建议：迁移到新 id 时将 `status` 置为 `ready`。

2) 新占/新发现房间未兜底初始化运输网络内存
- 位置：`TransportService.onUpdate`
- 影响：`updateTransportNetwork` 可能在 `network` 未初始化时被调用，功能失效。
- 建议：在 `onUpdate` 的每个己方房间循环内调用 `initializeRoomMemory(roomName)` 兜底。

3) 运输任务去重对“地面资源”不安全
- 位置：`TaskGeneratorService.generateTransportTasks`
- 影响：`sourceId` 为空时未比较 `sourcePos`，多个不同地面资源到同一目标被误判为重复，任务被吞。
- 建议：当 `sourceId` 为空时，加入 `sourcePos`（x/y/roomName）的等值比较。

4) 运输生产忙碌数统计错误
- 位置：`CreepProductionService.getCreepsAssignedToTaskType`
- 影响：遍历了“任务数组”的索引当作 creepName，`busyCount` 近似为 0，易过量生产运输 creep。
- 建议：按房间+角色遍历 `Game.creeps`，使用 `taskStateService.getTaskByCreepName(creepName)` 判断任务类型。

注：上述 1)~4) 为关键稳定性/效率问题；除这些点外，其余问题已按讨论修复/将修复。


### 三、设计问答纪要（对用户 7 点回复的结论）

- 混合策略的改造量（“优先推送、失败回退自取”）
  - 结论：无需大规模重构。新增 `SupplyService` 作为统一“资源供应门面/编排层”，复用现有 `TransportService`（推送）与 `EnergyService`（能量自取兜底）。FSM 仅新增“请求/等待/超时自取”的轻量状态组。

- creep 的 consumer 注册/注销时机
  - 缺资源时由 FSM 注册（统一走 `SupplyService.request`）；资源足量/任务结束/离房间时注销。
  - 服务层定期清理（死亡/离房/已满足）兜底，避免漏注销。

- 等待策略（避免固定 tick 的问题）
  - 采用“动态 ETA 等待 + 续期 + 超时兜底自取”的策略：
    - `ETA = ceil(最短可达距离 × beta + overhead)`，并限幅 `[minWait, maxWait]`；
    - 若检测到“针对该 creep 的运输任务已分配/进行中”，可小幅延长等待；
    - 超时后执行一次“自取”方案（同房最近 provider 或能量本地源），成功则继续任务并注销请求。

- 资源范围
  - 不写死资源类型。`SupplyService` 以 `resourceType` 参数驱动，其他资源后续可扩展定位策略插件；短期先复用运输网络的 provider 查询与 `EnergyService` 的本地能量查找。

- 交付目标形态
  - 与普通 consumer 一致，允许直接交付给 creep（`targetId` 可指向 creep）。需要对 `TransportFSMExecutor` 做小增强：检查目标是否有 `store`（建筑或 creep 均可）。

- 就地投放策略
  - 仅极端情况启用（如运输 creep 濒死），并以“将交付点转换为临时 provider”的一致性方案处理；可放到第二阶段实现。

- API 形态
  - 不合并 `EnergyService`。新增通用 `SupplyService`（门面/编排），统一对外 API；内部先复用 `EnergyService` 处理能量自取兜底，其他资源走运输网络 provider 查询。


### 四、总体方案与分阶段落地

- 第 1 阶段（最小可用）
  - 新增并接入 `SupplyService`（注册到 `LogisticsManager`，定义内存 `supply`）。
  - 在 `SupplyService` 实现：`request`/`cancel`/`estimateETA`/`suggestSelfFetchPlan`；`onCleanup` 兜底清理。
  - 在 `BuildFSMExecutor`、`UpgradeFSMExecutor` 新增“请求/等待/超时自取”子状态，统一从 `SupplyService` 取资。
  - `TransportFSMExecutor` 小增强：交付目标支持 creep；拾取来源支持任意带 `store` 的对象（如 Tombstone/Ruin）。

- 第 2 阶段（体验增强）
  - `estimateETA` 加入“同目标运输任务分配状态”的加权与续期策略；
  - 支持旗帜驱动的临时落点（极端就地投放 → 临时 provider）；
  - 调整 `CONSUMER_IMPORTANCE.creep`（建议 0.5~0.6）保障升级/建造不饿死。

- 第 3 阶段（深度统一）
  - 将各 FSM 的取资路径全面统一到 `SupplyService`，逐步删除分散的临时取能分支；
  - 如需，扩展运输任务优先级计算，使“面向 creep 的交付”在拥堵时更合理。


### 五、SupplyService 设计与实现要点

- 内存结构（已添加到 `src/types/logistics.ts`）
  - `LogisticsMemory.supply?: SupplyRequestServiceMemory`
  - `SupplyRequestServiceMemory`：按房间记录 `requests: { [roomName]: SupplyRequestMemory[] }`
  - `SupplyRequestMemory`：请求 id、creepName、roomName、resourceType、amount、createdAt、suggestedWait、expiresAt（可选）

- 对外接口（方法签名）
  - `request(creep, resourceType, amount?, opts?) => { requestId, suggestedWait }`
  - `cancel(creep, resourceType?) => void`
  - `estimateETA(room, pos, resourceType, minAmount?) => number`
  - `suggestSelfFetchPlan(creep, resourceType, minAmount?) => { sourceId? | sourcePos? } | null`

- 实现细节（建议）
  - `request`
    - 调用 `TransportService.setConsumer(creep, room, resourceType)` 注册；
    - 调 `estimateETA` 计算 `suggestedWait`，记录/更新请求；
  - `cancel`
    - 调 `TransportService.removeConsumer(creep, room)` 注销；从 `requests` 中删除对应项；
  - `estimateETA`
    - 从 `TransportService.getProviders(room)` 选出 `status==='ready'` 且资源类型匹配的 provider，按 `PathFinder.search` 求最短可达距离，`ETA = ceil(dist×beta + overhead)` 并做限幅；
    - 初值建议：`beta=1.2, overhead=3, minWait=5, maxWait=60`；
  - `suggestSelfFetchPlan`
    - 对 `RESOURCE_ENERGY`：复用 `EnergyService.findEnergySources(creep)` 取最近源；
    - 其他资源：用 `TransportService.getClosestProvider(room, creep.pos, resourceType)` 返回最近 provider，掉落物给 `sourcePos`，非掉落物给 `sourceId`；
  - `onCleanup`
    - 每 20 tick 清理一次：死亡/离房/已满足的请求自动 `cancel`。


### 六、FSM 接入指南（以建造/升级为例）

- 进入“取资阶段”时：
  - 计算缺口 `need = creep.store.getFreeCapacity(resourceType)`；
  - 调用 `supplyService.request(creep, resourceType, need)` 获取 `{ suggestedWait }`；
  - 转入 `WAIT_SUPPLY` 子状态，记录 `waitUntil = Game.time + suggestedWait`。

- `WAIT_SUPPLY` 子状态逻辑：
  - 若 `creep.store.getFreeCapacity(resourceType) === 0`（或达到工序阈值）→ `supplyService.cancel(creep, resourceType)`，进入主工序；
  - 若 `Game.time >= waitUntil`：
    - `plan = supplyService.suggestSelfFetchPlan(creep, resourceType, need)`；
    - 有 `sourceId` → 移动到 1 格 → `withdraw`；有 `sourcePos` → 移动到坐标 → `pickup`；
    - 成功取到后 `supplyService.cancel(creep, resourceType)` 继续；失败可重新 `request` 或小等待后重试。

- 执行器中访问 `SupplyService`：`this.service.manager.logisticsManager.supplyService`


### 七、TransportFSMExecutor 的必要微改

- 交付目标支持 creep：
  - `handleDeliver` 中将 `target` 从 `Structure` 放宽为“任意带 `store` 的对象”，并用 `creep.transfer(target as any, resourceType)`；若 `!target || !('store' in target)` 则结束。

- 拾取来源支持 `Tombstone/Ruin` 等：
  - `pickupResource` 中，除 `Resource`/`Structure` 分支外，遇到“带 `store` 但非 `Structure`”的对象（如 `Tombstone`）直接用 `withdraw`。


### 八、动态等待策略参数（建议初值）

- `beta = 1.2`（路径速度系数，考虑道路/疲劳等不确定性）
- `overhead = 3`（处理/交接开销）
- `minWait = 5`、`maxWait = 60`（限幅）
- 续期策略（第二阶段可加）：若检测到“同目标运输任务已分配/进行中”，在 ETA 基础上 +8 tick 缓冲；反之可 -4 tick 以便快进自取。


### 九、旗帜（Flag）扩展的规划（后续）

- 用于手动声明某位置/建筑的物流角色（provider/consumer）以及临时落点；
- 扫描到旗帜时将其绑定位置注册为 provider/consumer；
- 极端就地投放场景下，可通过旗帜定义“投放点”，系统把该点注册为临时 provider，后续消费者自取。


### 十、待办清单（状态追踪）

- 已完成
  - 新增 `SupplyService` 文件骨架：`src/services/logistics/SupplyService.ts`；
  - 在 `LogisticsManager` 注册并暴露 `supplyService`；
  - 在 `types/logistics.ts` 中定义了 `supply` 内存结构（`SupplyRequestServiceMemory`、`SupplyRequestMemory`）。

- 进行中 / 待开始
  - [待开始] 实现 `SupplyService.request/cancel/estimateETA/suggestSelfFetchPlan/onCleanup` 方法；
  - [待开始] FSM（建造/升级）接入 `SupplyService` 的“请求/等待/超时自取”子状态；
  - [建议修复] `TransportService.handleConstructionCompleted` 在 provider 迁移时将 `status` 置为 `ready`；
  - [建议修复] `TransportService.onUpdate` 中对新房间兜底调用 `initializeRoomMemory(roomName)`；
  - [建议修复] `TaskGeneratorService` 的运输任务去重在 `sourceId` 为空时比较 `sourcePos`；
  - [建议修复] 修正 `CreepProductionService.getCreepsAssignedToTaskType` 的忙碌统计实现；
  - [建议增强] `TransportFSMExecutor`：交付目标支持 creep；拾取来源支持带 `store` 的非 `Structure` 对象（Tombstone/Ruin）。

- 第二阶段（可选增强）
  - `SupplyService.estimateETA` 加入“任务分配状态”的加权；
  - 旗帜驱动的临时落点与 provider 注册；
  - `CONSUMER_IMPORTANCE.creep` 调整为 0.5~0.6。

- 第三阶段（统一与优化）
  - 将各 FSM 的取资全面统一到 `SupplyService`，删除临时取能分支；
  - 优化运输任务优先级，使面向 creep 的交付在拥堵下表现更合理。


### 十一、里程碑与验收

- 里程碑 M1：`SupplyService` 方法实现完成并通过基础联调（ETA 合理、清理生效、兜底自取可用）。
- 里程碑 M2：`Build/Upgrade` FSM 已接入 `SupplyService`，开局与正常期均能稳定取资，无明显饥饿/堆积。
- 里程碑 M3：`TransportFSMExecutor` 支持 creep 交付与墓碑取用，运输链路更通用。
- 里程碑 M4（可选）：旗帜增强、任务加权与参数调优。

- 验收条件（示例）
  - 运输任务对 creep 的交付能在建议等待窗口内多数完成；
  - 超时回退的自取成功率高于 80%；
  - 施工与升级基本不因取资饥饿而长时间阻塞；
  - 没有明显的 consumer 残留与网络脏内存。


### 十二、风险与回退

- ETA 估计不准 → 通过限幅和续期策略降低“过等/欠等”风险；必要时提升 `beta/overhead` 或增量观测数据。
- 过度依赖 `EnergyService` → 仅用于能量自取兜底，其他资源仍以运输网络为主，后续再逐步抽象定位插件。
- FSM 接入不当导致抖动 → 将等待与自取逻辑封装在子状态中，状态切换仅在“足量/超时/任务结束”三类事件发生，避免频繁震荡。


### 十三、已实施改动清单（截至当前）

- 新增：`src/services/logistics/SupplyService.ts`（骨架）
- 新增：`LogisticsManager` 注册并暴露 `supplyService`
- 新增/调整：`types/logistics.ts` 中的 `LogisticsMemory.supply`、`SupplyRequestServiceMemory`、`SupplyRequestMemory`

