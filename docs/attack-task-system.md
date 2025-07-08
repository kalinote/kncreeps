# 攻击任务系统实现文档

## 概述

AttackTaskExecutor 是一个完整的攻击任务执行器，支持对敌对单位（creep和建筑）的智能攻击。系统集成了任务生成、分配、执行和清理的完整流程。

## 核心组件

### 1. AttackTaskExecutor 执行器

**位置**: `src/task/executors/AttackTaskExecutor.ts`

**主要功能**:
- 支持远程攻击（RANGED_ATTACK）和近战攻击（ATTACK）
- 自动选择最优攻击方式（优先远程攻击）
- 智能移动到攻击范围
- 目标摧毁检测
- Creep即将死亡时的任务转交机制

**能力要求**:
```typescript
[
  { bodyPart: RANGED_ATTACK, minCount: 1, weight: 10 },  // 远程攻击优先
  { bodyPart: ATTACK, minCount: 1, weight: 8 },          // 近战攻击次优
  { bodyPart: MOVE, minCount: 1, weight: 5 },            // 移动必需
  { bodyPart: TOUGH, minCount: 1, weight: 3 }            // 防御加分
]
```

### 2. 任务参数类型

**AttackTaskParams**:
```typescript
interface AttackTaskParams {
  targetId: string;                    // 攻击目标ID
  targetType: 'creep' | 'structure';  // 目标类型
  attackType?: 'ranged' | 'melee' | 'auto'; // 攻击类型，auto为自动选择
  maxRange?: number;                   // 最大攻击距离
}
```

### 3. 任务生成逻辑

**位置**: `src/task/TaskGenerator.ts` 中的 `generateAttackTasks` 方法

**防重复创建策略**:
1. 检查是否已有针对同一目标的攻击任务
2. 限制攻击任务数量不超过敌对单位数量
3. 根据我方战斗单位数量限制任务创建（最多1:1.5比例）
4. 防止攻击任务数量超过我方战斗单位的2倍

**优先级计算**:
- **敌对Creep**: 根据攻击、治疗、占领等部件数量计算威胁分数
- **敌对建筑**: Spawn > Tower > Extension/Storage > 其他

### 4. 角色映射

**位置**: `src/config/TaskRoleMapping.ts`

当前支持的角色:
- `shooter`: 包含RANGED_ATTACK组件（已实现）
- `fighter`: 包含ATTACK组件（待实现）
- `soldier`: 同时包含RANGED_ATTACK和ATTACK组件（待实现）

## 攻击逻辑

### 1. 目标验证
- 检查目标是否存在
- 验证目标是否还在同一房间
- 确认目标未被摧毁

### 2. 攻击方式选择
```typescript
// 自动选择逻辑
if (hasRangedAttack) {
  attackType = 'ranged';  // 优先远程攻击
} else if (hasMeleeAttack) {
  attackType = 'melee';   // 备选近战攻击
}
```

### 3. 距离管理
- **远程攻击**: 最大距离3格（可配置）
- **近战攻击**: 必须相邻（1格）
- 自动移动到合适的攻击位置

### 4. 完成条件
- 目标被摧毁（血量为0或不存在）
- 目标离开房间
- Creep即将死亡（生命值 < 50）

## 集成点

### 1. 任务执行器注册
**位置**: `src/task/TaskExecutorRegistry.ts`
```typescript
this.executors.set(TaskType.ATTACK, new AttackTaskExecutor());
```

### 2. 任务生成集成
**位置**: `src/task/TaskGenerator.ts`
```typescript
public generateTasksForRoom(room: Room): void {
  // ...
  this.generateAttackTasks(room);
  // ...
}
```

### 3. 类型系统集成
**位置**: `src/types/index.ts`
- 添加了 `AttackTaskParams` 接口
- 添加了 `AttackTask` 接口
- 更新了 `Task` 联合类型

## 调试工具

**位置**: `src/main.ts` 中的 `global.taskDebug.attackDebug`

### 可用命令:
```javascript
// 显示攻击任务和战斗单位状态
taskDebug.attackDebug.status()

// 扫描所有房间的敌对单位
taskDebug.attackDebug.enemies()

// 强制创建攻击任务
taskDebug.attackDebug.createAttackTask(targetId?)

// 测试攻击执行器能力
taskDebug.attackDebug.testExecutor()

// 测试单个creep的攻击能力
taskDebug.attackDebug.testCreep('creep名称')
```

## 协同作战机制

### 1. 集火策略
- 多个creep可以攻击同一目标
- 任务生成时会检查现有攻击任务，避免过度分配
- 基于威胁评分的目标优先级系统

### 2. 数量控制
```typescript
// 战斗单位与敌对单位的比例控制
const maxFighters = Math.min(totalHostiles * 1.5, 5);
if (myFighters.length >= maxFighters) {
  return false; // 不创建新任务
}
```

### 3. 任务分配平衡
- 攻击任务数量不超过敌对单位数量
- 考虑现有战斗单位的数量和能力
- 防止在每个tick创建重复任务

## 扩展计划

### 1. 新角色类型
- **Fighter**: 近战专精角色
- **Soldier**: 全能战斗角色

### 2. 高级战斗策略
- 治疗任务集成（由CreepManager管理）
- 撤退机制
- 动态目标切换
- 编队作战

### 3. 性能优化
- 攻击任务的批量处理
- 目标优先级缓存
- 战场态势评估

## 使用示例

### 1. 自动攻击
当房间检测到敌对单位时，系统会自动：
1. 生成对应的攻击任务
2. 分配给合适的战斗单位
3. 执行攻击直到目标被摧毁或离开

### 2. 手动创建攻击任务
```javascript
// 在游戏控制台中
taskDebug.attackDebug.createAttackTask("目标ID")
```

### 3. 监控攻击状态
```javascript
// 查看当前攻击任务状态
taskDebug.attackDebug.status()

// 查看敌对单位情况
taskDebug.attackDebug.enemies()
```

## 注意事项

1. **任务清理**: 已完成的攻击任务会自动清理，保留最近50个用于统计
2. **能力检查**: 只有具备攻击能力的creep才能执行攻击任务
3. **房间限制**: 攻击任务只在目标所在房间有效
4. **重试机制**: 攻击任务最多重试3次

## 测试建议

1. 使用调试工具验证系统各组件功能
2. 在有敌对单位的环境中测试自动任务生成
3. 验证多creep协同攻击的效果
4. 测试各种攻击类型（远程、近战、自动选择）

## 问题修复记录

### 任务分配问题修复 (v1.1)

**问题**: 攻击任务创建成功但无法分配给shooter creep，一直处于pending状态。

**原因**: 原始的能力检查逻辑要求creep同时具备RANGED_ATTACK和ATTACK能力，但shooter只有RANGED_ATTACK。

**修复**:
1. 修改`canExecute`方法，改为检查creep是否具备**至少一种**攻击能力
2. 重写`calculateCapabilityScore`方法，正确计算攻击能力评分
3. 简化`getRequiredCapabilities`，只保留必需的MOVE能力

**验证**: 使用`taskDebug.attackDebug.testExecutor()`和`taskDebug.attackDebug.testCreep('creep名称')`进行测试

### 评分计算错误修复 (v1.2)

**问题**: TaskScheduler中的`calculateCreepScore`方法对于没有存储能力的creep（如shooter）返回`NaN`，导致任务分配失败。

**原因**: 当creep没有CARRY部件时，`creep.store.getCapacity()`返回0，导致`loadScore`计算时出现除零错误。

**修复**: 在`TaskScheduler.calculateCreepScore`方法中添加容量检查，对于没有存储能力的creep使用默认评分0.5。

**代码变更**:
```typescript
// 修复前
const loadScore = creep.store.getFreeCapacity() / creep.store.getCapacity();

// 修复后
const totalCapacity = creep.store.getCapacity();
let loadScore = 0.5; // 默认评分，适用于没有存储能力的creep
if (totalCapacity > 0) {
  loadScore = creep.store.getFreeCapacity() / totalCapacity;
}
```
