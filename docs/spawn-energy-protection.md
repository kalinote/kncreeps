# Spawn能量保护机制

## 概述

为了确保spawn始终有足够的能量来生成最基本的creep，我们实现了spawn能量保护机制。该机制确保：

1. **从spawn取用时**：保证spawn中最少有200能量
2. **从其他建筑取用时**：不需要限制
3. **取用后spawn剩余能量**：不应该少于200

## 实现方案

### 1. 配置管理

在 `src/config/EnergyConfig.ts` 中添加了spawn能量保留配置：

```typescript
public static readonly SPAWN_ENERGY_RESERVE = {
  MIN_RESERVE: 200,           // spawn最少保留200能量
  EMERGENCY_RESERVE: 150,     // 紧急情况下的最小保留
  CRITICAL_RESERVE: 100,      // 关键情况下的最小保留
  FULL_CAPACITY_THRESHOLD: 0.9 // spawn能量超过90%时允许所有角色获取
} as const;
```

### 2. 安全取用方法

在 `BaseTaskExecutor` 中添加了两个核心方法：

#### `withdrawEnergySafely(creep, structure, amount?)`
- 检查目标是否是spawn
- 如果是spawn，确保取用后剩余能量不少于200
- 如果spawn接近满能量（>90%），允许正常取用
- 如果取用后能量不足，自动调整取用量

#### `getEnergyFromStructures(creep, structures)`
- 优先从非spawn建筑获取能量
- 只有当非spawn建筑都没有能量时，才从spawn获取
- 使用安全取用方法确保spawn能量保护

### 3. TaskExecutor更新

所有需要获取能量的TaskExecutor都已更新：

- **TransportTaskExecutor**: 使用安全取用方法
- **BuildTaskExecutor**: 使用新的能量获取逻辑
- **UpgradeTaskExecutor**: 使用新的能量获取逻辑

## 工作流程

### 正常情况
1. Creep优先从extension、storage等非spawn建筑获取能量
2. 只有当其他建筑都没有能量时，才从spawn获取
3. 从spawn获取时，确保保留200能量

### 特殊情况
1. **Spawn接近满能量**：当spawn能量超过90%时，允许正常取用
2. **能量不足**：如果spawn能量少于200，拒绝取用
3. **部分取用**：如果取用后剩余能量不足，自动调整取用量

## 配置参数

| 参数 | 值 | 说明 |
|------|-----|------|
| MIN_RESERVE | 200 | spawn最少保留能量 |
| EMERGENCY_RESERVE | 150 | 紧急情况下的最小保留 |
| CRITICAL_RESERVE | 100 | 关键情况下的最小保留 |
| FULL_CAPACITY_THRESHOLD | 0.9 | spawn满能量阈值 |

## 使用示例

```typescript
// 在TaskExecutor中使用安全取用
const withdrawResult = this.withdrawEnergySafely(creep, spawn, 50);

// 从建筑列表中安全获取能量
const result = this.getEnergyFromStructures(creep, energyStructures);
if (result.success) {
  // 成功获取能量
  console.log(result.message);
}
```

## 优势

1. **自动保护**：无需手动管理，系统自动确保spawn能量安全
2. **灵活配置**：可以根据不同情况调整保留量
3. **优先级管理**：优先使用非spawn建筑的能量
4. **容错处理**：当能量不足时，自动调整或拒绝取用

## 注意事项

1. 该机制只影响能量取用，不影响其他资源
2. 当spawn接近满能量时，允许正常取用以避免能量浪费
3. 所有TaskExecutor都会自动使用这个保护机制
4. 配置参数可以根据实际需求调整
