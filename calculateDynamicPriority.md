# 动态优先级计算算法（calculateDynamicPriority）

> 本文档用于描述如何在 KnCreeps 项目中引入基于任务**基础优先级**、**时间老化**与**人手饱和衰减**的动态优先级调度算法。通过统一的有效优先级 \(P_{eff}\) 计算，可在保证高优任务及时处理的同时，避免低优任务长期饥饿，并且提升整体资源利用率。

---

## 目录

- [动态优先级计算算法（calculateDynamicPriority）](#动态优先级计算算法calculatedynamicpriority)
  - [目录](#目录)
  - [背景](#背景)
  - [术语与符号](#术语与符号)
  - [算法设计](#算法设计)
    - [时间老化 (Aging) 函数](#时间老化-aging-函数)
    - [人手饱和衰减函数](#人手饱和衰减函数)
    - [综合有效优先级计算](#综合有效优先级计算)
    - [调度流程整合](#调度流程整合)
  - [TypeScript 参考实现](#typescript-参考实现)
  - [算法优势](#算法优势)
  - [潜在缺点与对策](#潜在缺点与对策)
  - [与现有“两段式调度”对比](#与现有两段式调度对比)
  - [理论支撑](#理论支撑)
  - [参数调优指南](#参数调优指南)
  - [未来改进方向](#未来改进方向)

---

## 背景

当前调度器采用“先独占任务→再共享任务”的两段式流程。虽然保证了独占任务不被资源竞争，但也导致：

* 低优先级独占任务 _永远_ 领先于高优先级共享任务。
* 长期运行后，低优任务可能被饿死。
* 共用类型任务间缺乏精细化优先级区分。

为解决上述问题，引入统一的动态优先级计算，使所有任务均根据时序变化与资源占用情况动态调整权重，再按 \(P_{eff}\) 进行全局排序分配。

## 术语与符号

| 符号 | 含义 |
| ---- | ---- |
| \(P_{base}\) | 任务基础优先级（来自 `TaskPriority` 枚举的权重映射） |
| \(t\) | 当前 tick 与任务 `createdAt` 之差，表示等待时长 |
| \(n\_{assigned}\) | 已分配的 creep 数量 |
| \(n\_{max}\) | 任务允许的最大分配数 `maxAssignees` |
| \(k_1, k_2\) | Aging 与饱和衰减的系数，用于调节灵敏度 |
| \(P_{eff}\) | 动态有效优先级，调度排序依据 |

## 算法设计

### 时间老化 (Aging) 函数

通过随时间增长逐步提升优先级，保证低优任务最终得到处理。

1. **线性老化**
   \[
   Aging(t) = k_1 \cdot t
   \]
   简单直观，但时序过长时增长过快。

2. **对数老化**（推荐）
   \[
   Aging(t) = k_1 \cdot \log(1+t)
   \]
   初期增长快，后期放缓，避免溢出。

3. **根号老化**
   \[
   Aging(t) = k_1 \cdot \sqrt{t}
   \]
   介于线性与对数之间，平滑可控。

> 实际项目可在配置文件中自由选择函数形式及 \(k_1\)。

### 人手饱和衰减函数

共享任务已分配越多 creep，其边际收益越低，应降低其竞争力。

1. **线性衰减**
   \[
   Saturation(n) = 1 - \frac{n\_{assigned}}{n\_{max}}
   \]

2. **指数衰减**
   \[
   Saturation(n) = \exp\bigl(-k_2 \cdot n\_{assigned}\bigr)
   \]
   更激进，鼓励均衡分配。

3. **超级线性衰减**
   \[
   Saturation(n) = 1 - \Bigl(\frac{n\_{assigned}}{n\_{max}}\Bigr)^\gamma, \; \gamma>1
   \]

> 独占任务可视为 \(n\_{max}=1\)，当已分配时饱和度立即为 0，不再继续抢占。

### 综合有效优先级计算

> 对每个任务实时计算 \(P_{eff}\) 后，按降序全局排序。

\[
P_{eff} = P_{base} \times \bigl(1 + Aging(t)\bigr) \times Saturation(n)\tag{1}
\]

* Aging 只增不减，使等待时间越长优先级越高。
* Saturation \(\in(0,1]\)，使人手饱和的任务优先级降低。
* 两者相乘即可兼顾公平性与效率。

### 调度流程整合

1. **收集任务**：`taskStateService.getActiveTasks()`。
2. **计算 \(P_{eff}\)**：对每个任务调用 `calculateEffectivePriority`。
3. **全局排序**：按 \(P_{eff}\) 递减排列，不再区分独占/共享。
4. **逐一尝试分配**：
   * 若 `assignmentType === EXCLUSIVE`：最多指派 1 名适合的 creep。
   * 若 `SHARED`：按 `allocateProportionally` 分配，但权重改用 \(P_{eff}\)。
5. **写入状态**：通过 `taskStateService.assignTask` 更新内存。

---

## TypeScript 参考实现

> 以下代码片段可放入 `utils/PriorityCalculator.ts`，供调度器复用。

```ts
/**
 * 动态优先级计算工具
 */
export class PriorityCalculator {
  /**
   * 计算任务的有效优先级
   * @param task 任务对象
   * @param currentTick 当前 Game.time
   */
  public static calc(task: Task, currentTick: number): number {
    const base = this.getBaseWeight(task.priority);
    const ageBoost = this.agingLog(currentTick - task.createdAt);
    const saturation = this.saturationLinear(task.assignedCreeps.length, task.maxAssignees);
    return base * (1 + ageBoost) * saturation;
  }

  /** 基础权重，可与现有映射保持一致 */
  private static getBaseWeight(priority: TaskPriority): number {
    switch (priority) {
      case TaskPriority.EMERGENCY:   return 10;
      case TaskPriority.CRITICAL:    return 8;
      case TaskPriority.HIGH:        return 6;
      case TaskPriority.NORMAL:      return 4;
      case TaskPriority.LOW:         return 2;
      case TaskPriority.BACKGROUND:  return 1;
      default:                       return 4;
    }
  }

  /** 对数老化 */
  private static agingLog(t: number, k1 = 0.3): number {
    return k1 * Math.log1p(Math.max(0, t));
  }

  /** 线性饱和衰减 */
  private static saturationLinear(nAssigned: number, nMax: number, k2 = 1): number {
    if (nMax === 0) return 1; // 理论不应发生
    const ratio = Math.min(1, nAssigned / nMax);
    return 1 - k2 * ratio; // 保证在 0~1 之间
  }
}
```

在 `TaskSchedulerService.update()` 中：

```ts
const tasks = this.taskStateService.getActiveTasks();
// 重新计算权重
for (const t of tasks) {
  (t as any).effectivePriority = PriorityCalculator.calc(t, Game.time);
}
// 按 effectivePriority 排序
const sortedTasks = tasks.sort((a, b) => (b as any).effectivePriority - (a as any).effectivePriority);
```

> 调度后仍可调用现有评分体系为 creep 选最优。

---

## 算法优势

| 优点 | 说明 |
| ---- | ---- |
| 公平性 | Aging 机制确保低优任务终会被处理，避免饥饿 |
| 灵活配置 | Aging/衰减函数及系数可在配置文件中调节，无需改动核心逻辑 |
| 全局最优 | 统一排序消除了独占/共享硬分段，调度更加平滑 |
| 易于落地 | 仅新增权重计算函数，对现有调度器改动小 |
| 可解释性 | 每个任务持有 `effectivePriority`，可打印日志直观观察 |

## 潜在缺点与对策

| 缺点 | 影响 | 对策 |
| ---- | ---- | ---- |
| 参数难调 | 系数不合理导致优先级极端波动 | 提供热更新接口 + 监控曲线实时调参 |
| 计算开销增加 | 每 tick 遍历任务重算优先级 | 任务量通常远小于 creep，实际影响可忽略；必要时做缓存 |
| 指数衰减过度 | 共享任务骤降导致无人可用 | 通过 \(k_2\)、选择线性衰减以平衡 |
| Aging 溢出 | 长期运行后权重过大 | 采用对数/根号函数并设置上限 |

---

## 与现有“两段式调度”对比

| 维度 | 旧方案 | 新方案 |
| ---- | ---- | ---- |
| 独占优先权 | 固定绝对优先 | 由 \(P_{eff}\) 决定，可被高权共享任务超越 |
| 低优任务饥饿 | 可能长期无法执行 | Aging 保证最终执行 |
| 资源利用率 | 可能造成浪费 | 饱和衰减鼓励资源均衡 |
| 代码复杂度 | 简单 | 略增，但封装良好 |

---

## 理论支撑

* **调度算法中的 Aging**：类 Unix `nice`/`CFS` 通过等待时间提升权重，防饿死。
* **负载均衡中的饱和衰减**：网络拥塞控制、数据库连接池均使用饱和折扣分配资源。
* **指数/对数增长曲线**：在控制理论中用于平滑响应、防止震荡与溢出。
* **边际效益递减定律**：经济学原理支撑共享任务人手饱和后收益递减，应降低资源倾斜。

---

## 参数调优指南

1. **\(k_1\)（Aging 系数）**
   * 值越大，低优任务翻盘越快。建议 `0.2~0.5` 之间。
2. **\(k_2\)（饱和衰减系数）**
   * 值越大，共享任务越快让位。建议 `0.8~1`。
3. **函数形态选择**
   * 对数适合长期运行；线性适合任务量少时快速响应；指数适合激进场景。
4. **实时监控**
   * 在 `StatsManager` 中记录 `effectivePriority` 分布，配合 Grafana 可视化。

---

## 未来改进方向

* **Deadline 支持**：对有时限任务引入倒数加速函数。
* **机器学习调参**：收集历史数据，用强化学习自动调整 \(k_1,k_2\)。
* **房间级别动态系数**：根据能量、RCL 等阶段性指标自适应参数。
* **优先级区间压缩**：防止高优任务彼此之间仍然差距巨大导致饱和。
