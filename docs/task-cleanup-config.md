# 任务清理配置文档

## 概述

任务系统现在使用统一的配置管理清理周期，所有清理相关的配置都在 `TaskConfig.ts` 中集中管理，便于调整和维护。

## 配置项说明

### 1. 清理周期配置 (TASK_CLEANUP_FREQUENCIES)

```typescript
public static readonly TASK_CLEANUP_FREQUENCIES = {
  MAIN_CLEANUP: 100,                    // 任务系统主要清理周期（ticks）
  DEAD_CREEP_CLEANUP: 50,              // 死亡creep任务分配清理周期
  COMPLETED_TASK_CLEANUP: 200,         // 已完成任务清理周期
  DUPLICATE_TASK_CLEANUP: 300,        // 重复任务检测和清理周期
  EXPIRED_TASK_CLEANUP: 500,           // 过期任务清理周期
  STATS_OUTPUT: 20,                    // 任务统计信息输出频率
  ASSIGNMENT_RETRY: 10,                // 任务分配重试周期
  EXECUTION_TIMEOUT_CHECK: 30          // 任务执行超时检查周期
} as const;
```

### 2. 清理配置参数 (TASK_CLEANUP_CONFIG)

```typescript
public static readonly TASK_CLEANUP_CONFIG = {
  COMPLETED_TASKS_TO_KEEP: 50,         // 保留的已完成任务数量
  TASK_EXECUTION_TIMEOUT: 1000,        // 任务执行超时时间（ticks）
  MAX_TASK_RETRIES: 3,                 // 任务重试次数
  DUPLICATE_DETECTION_THRESHOLD: 5,    // 重复任务检测阈值
  TASK_EXPIRATION_TIME: 2000           // 任务过期时间（ticks）
} as const;
```

## 使用方法

### 1. 检查是否应该执行清理

```typescript
import { TaskRoleMapping } from '../config/TaskConfig';

// 检查是否应该执行主要清理
if (TaskRoleMapping.shouldPerformCleanup(lastCleanupTime, 'MAIN_CLEANUP')) {
  // 执行清理逻辑
}

// 检查是否应该输出统计信息
if (TaskRoleMapping.shouldPerformCleanup(Game.time, 'STATS_OUTPUT')) {
  console.log('任务统计信息...');
}
```

### 2. 获取清理周期配置

```typescript
// 获取主要清理周期
const mainCleanupFreq = TaskRoleMapping.getCleanupFrequency('MAIN_CLEANUP');

// 获取保留的已完成任务数量
const completedTasksToKeep = TaskRoleMapping.getCleanupConfig('COMPLETED_TASKS_TO_KEEP');
```

### 3. 检查任务状态

```typescript
// 检查任务是否过期
if (TaskRoleMapping.isTaskExpired(task.createdAt)) {
  console.log('任务已过期');
}

// 检查任务执行是否超时
if (TaskRoleMapping.isTaskExecutionTimeout(task.startedAt)) {
  console.log('任务执行超时');
}
```

## 配置调整建议

### 1. 高性能配置（CPU充足）

```typescript
public static readonly TASK_CLEANUP_FREQUENCIES = {
  MAIN_CLEANUP: 50,                    // 更频繁的清理
  DEAD_CREEP_CLEANUP: 20,              // 快速清理死亡creep
  COMPLETED_TASK_CLEANUP: 100,         // 更频繁清理已完成任务
  DUPLICATE_TASK_CLEANUP: 150,        // 更频繁检测重复任务
  EXPIRED_TASK_CLEANUP: 200,           // 更频繁清理过期任务
  STATS_OUTPUT: 10,                    // 更频繁输出统计
  ASSIGNMENT_RETRY: 5,                 // 更频繁重试分配
  EXECUTION_TIMEOUT_CHECK: 15          // 更频繁检查超时
} as const;
```

### 2. 低性能配置（CPU紧张）

```typescript
public static readonly TASK_CLEANUP_FREQUENCIES = {
  MAIN_CLEANUP: 200,                   // 减少清理频率
  DEAD_CREEP_CLEANUP: 100,             // 减少死亡creep清理频率
  COMPLETED_TASK_CLEANUP: 500,         // 减少已完成任务清理频率
  DUPLICATE_TASK_CLEANUP: 600,        // 减少重复任务检测频率
  EXPIRED_TASK_CLEANUP: 1000,          // 减少过期任务清理频率
  STATS_OUTPUT: 50,                    // 减少统计输出频率
  ASSIGNMENT_RETRY: 20,                // 减少重试频率
  EXECUTION_TIMEOUT_CHECK: 60          // 减少超时检查频率
} as const;
```

### 3. 平衡配置（推荐）

```typescript
public static readonly TASK_CLEANUP_FREQUENCIES = {
  MAIN_CLEANUP: 100,                   // 适中的主要清理周期
  DEAD_CREEP_CLEANUP: 50,              // 适中的死亡creep清理
  COMPLETED_TASK_CLEANUP: 200,         // 适中的已完成任务清理
  DUPLICATE_TASK_CLEANUP: 300,        // 适中的重复任务检测
  EXPIRED_TASK_CLEANUP: 500,           // 适中的过期任务清理
  STATS_OUTPUT: 20,                    // 适中的统计输出
  ASSIGNMENT_RETRY: 10,                // 适中的重试频率
  EXECUTION_TIMEOUT_CHECK: 30          // 适中的超时检查
} as const;
```

## 动态调整

你可以根据游戏状态动态调整清理周期：

```typescript
// 根据creep数量动态调整清理频率
public static getDynamicCleanupFrequency(): number {
  const creepCount = Object.keys(Game.creeps).length;

  if (creepCount > 20) {
    return 30; // 更多creep时更频繁清理
  } else if (creepCount > 10) {
    return 50; // 中等数量时适中清理
  } else {
    return 100; // 较少creep时减少清理频率
  }
}

// 根据CPU使用情况调整
public static getCPUAwareCleanupFrequency(): number {
  const cpuUsed = Game.cpu.getUsed();
  const cpuLimit = Game.cpu.limit;

  if (cpuUsed / cpuLimit > 0.8) {
    return 200; // CPU紧张时减少清理频率
  } else if (cpuUsed / cpuLimit > 0.5) {
    return 100; // CPU适中时正常清理
  } else {
    return 50;  // CPU充足时增加清理频率
  }
}
```

## 监控和调试

### 1. 启用详细日志

```typescript
// 在TaskManager中添加详细日志
if (TaskRoleMapping.shouldPerformCleanup(Memory.tasks.lastCleanup, 'MAIN_CLEANUP')) {
  console.log(`[TaskManager] 开始清理，当前时间: ${Game.time}`);
  console.log(`[TaskManager] 任务队列长度: ${Memory.tasks.taskQueue.length}`);
  console.log(`[TaskManager] 已完成任务数量: ${Memory.tasks.completedTasks.length}`);
}
```

### 2. 性能监控

```typescript
// 监控清理性能
const startTime = Game.cpu.getUsed();
this.performCleanup();
const cleanupTime = Game.cpu.getUsed() - startTime;

if (cleanupTime > 1.0) {
  console.log(`[TaskManager] 清理耗时过长: ${cleanupTime.toFixed(2)} CPU`);
}
```

## 注意事项

1. **清理频率过高**：会增加CPU消耗，影响游戏性能
2. **清理频率过低**：可能导致内存泄漏，影响系统稳定性
3. **配置一致性**：确保相关配置项之间的一致性
4. **测试验证**：修改配置后要在测试环境中验证效果

## 故障排除

### 1. 内存泄漏问题

如果发现内存使用过高，可以：
- 减少 `COMPLETED_TASKS_TO_KEEP` 的值
- 增加清理频率
- 减少 `TASK_EXPIRATION_TIME` 的值

### 2. CPU使用过高

如果CPU使用过高，可以：
- 增加清理周期
- 减少统计输出频率
- 减少超时检查频率

### 3. 任务丢失问题

如果发现任务意外丢失，可以：
- 增加 `TASK_EXPIRATION_TIME` 的值
- 增加 `TASK_EXECUTION_TIMEOUT` 的值
- 减少清理频率
