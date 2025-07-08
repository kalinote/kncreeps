# Harvest任务系统优化文档

## 概述

本次优化主要针对harvest任务创建系统，解决了原有系统中每个source只能分配一个worker的问题。通过分析每个source周围的可采集位置，为每个位置创建独立的任务，从而允许多个worker同时采集同一个source。

## 优化内容

### 1. 新增SourceAnalyzer工具类

**位置**: `src/utils/SourceAnalyzer.ts`

**主要功能**:
- `getHarvestPositions(source)`: 获取source周围的可采集位置
- `isPositionWalkable(pos)`: 检查位置是否可通行
- `getHarvestPositionCount(source)`: 获取可采集位置数量
- `getRoomSourceStats(room)`: 获取房间内所有source的统计信息

**可采集位置判断逻辑**:
1. 扫描source周围8个位置
2. 检查位置是否在房间范围内
3. 检查是否有建筑阻挡（墙壁阻挡，道路可通行）
4. 检查地形类型（平原和沼泽可通行，墙壁不能通行）

### 2. 扩展HarvestTaskParams接口

**位置**: `src/types/index.ts`

**新增字段**:
```typescript
export interface HarvestTaskParams {
  sourceId: string;
  harvestPosition?: { x: number; y: number; roomName: string }; // 指定的采集位置
  targetId?: string;  // 存储目标，为空则丢在地上
  targetPos?: { x: number; y: number; roomName: string }; // 目标位置
}
```

### 3. 优化TaskGenerator.generateHarvestTasks方法

**位置**: `src/task/TaskGenerator.ts`

**主要改进**:
1. 使用SourceAnalyzer分析每个source的可采集位置
2. 为每个可采集位置创建独立的任务
3. 支持向后兼容（旧版本任务没有harvestPosition字段）
4. 提供详细的统计信息输出

**任务创建逻辑**:
```typescript
// 为每个source的每个可采集位置创建任务
for (let sourceIndex = 0; sourceIndex < sourceStats.sourceDetails.length; sourceIndex++) {
  const sourceDetail = sourceStats.sourceDetails[sourceIndex];
  const source = sources[sourceIndex];

  // 为每个可采集位置创建任务
  for (let posIndex = 0; posIndex < sourceDetail.positions.length; posIndex++) {
    const harvestPosition = sourceDetail.positions[posIndex];

    // 检查是否已有针对此source和位置的任务
    const hasTask = existingHarvestTasks.some(task => {
      const harvestTask = task as HarvestTask;
      if (harvestTask.params.sourceId !== source.id) return false;

      // 如果没有指定harvestPosition，说明是旧版本的任务，需要检查
      if (!harvestTask.params.harvestPosition) return true;

      // 检查位置是否匹配
      return harvestTask.params.harvestPosition.x === harvestPosition.x &&
             harvestTask.params.harvestPosition.y === harvestPosition.y &&
             harvestTask.params.harvestPosition.roomName === harvestPosition.roomName;
    });

    if (!hasTask) {
      // 创建新任务
      const taskId = this.taskManager.createTask({
        type: TaskType.HARVEST,
        priority: priority,
        roomName: room.name,
        maxRetries: 3,
        params: {
          sourceId: source.id,
          harvestPosition: {
            x: harvestPosition.x,
            y: harvestPosition.y,
            roomName: harvestPosition.roomName
          }
        }
      });
    }
  }
}
```

### 4. 更新HarvestTaskExecutor执行逻辑

**位置**: `src/task/executors/HarvestTaskExecutor.ts`

**主要改进**:
1. 支持移动到指定的采集位置
2. 在采集前检查并移动到指定位置
3. 处理位置被占用的情况
4. 保持向后兼容性

**执行流程**:
```typescript
// 检查是否需要移动到指定的采集位置
if (task.params.harvestPosition) {
  const targetPos = new RoomPosition(
    task.params.harvestPosition.x,
    task.params.harvestPosition.y,
    task.params.harvestPosition.roomName
  );

  // 如果不在指定位置，先移动到指定位置
  if (!creep.pos.isEqualTo(targetPos)) {
    const moveResult = creep.moveTo(targetPos);
    if (moveResult === OK || moveResult === ERR_TIRED) {
      return { success: true, completed: false, message: '移动到指定采集位置' };
    } else {
      return { success: false, completed: false, message: `移动到采集位置失败: ${moveResult}` };
    }
  }
}

// 执行采集
const harvestResult = creep.harvest(source);
```

## 优化效果

### 1. 提高采集效率
- 每个source现在可以支持多个worker同时采集
- 充分利用source周围的可用空间
- 减少worker之间的竞争和等待

### 2. 更好的资源利用
- 根据地形和建筑情况智能分配采集位置
- 避免在不可通行位置创建任务
- 支持道路等特殊地形的采集

### 3. 向后兼容
- 旧版本的任务仍然可以正常工作
- 新版本任务包含更精确的位置信息
- 平滑升级，无需重置现有任务

### 4. 详细的统计信息
- 显示每个房间的source数量和可采集位置总数
- 提供每个source的详细位置信息
- 便于监控和调试

## 使用示例

### 查看房间source统计
```typescript
import { SourceAnalyzer } from '../utils/SourceAnalyzer';

const room = Game.rooms['W1N1'];
const stats = SourceAnalyzer.getRoomSourceStats(room);

console.log(`房间 ${room.name}:`);
console.log(`- 总source数量: ${stats.totalSources}`);
console.log(`- 总可采集位置: ${stats.totalHarvestPositions}`);

stats.sourceDetails.forEach(detail => {
  console.log(`- Source ${detail.sourceId}: ${detail.positionCount} 个可采集位置`);
});
```

### 获取特定source的可采集位置
```typescript
const source = Game.getObjectById<Source>('sourceId');
const positions = SourceAnalyzer.getHarvestPositions(source);

console.log(`Source ${source.id} 的可采集位置:`);
positions.forEach((pos, index) => {
  console.log(`  ${index + 1}. (${pos.x}, ${pos.y})`);
});
```

## 测试

项目包含了完整的单元测试来验证SourceAnalyzer的功能：

**位置**: `test/unit/source-analyzer.test.ts`

**测试覆盖**:
- 可采集位置获取
- 位置数量统计
- 位置有效性检查
- 房间统计信息
- 边界条件处理

## 注意事项

1. **性能考虑**: SourceAnalyzer的扫描操作相对轻量，但建议在房间状态变化时才重新扫描
2. **内存使用**: 新增的harvestPosition字段会增加任务的内存占用，但影响很小
3. **兼容性**: 系统完全向后兼容，现有任务可以继续正常工作
4. **调试**: 可以通过控制台输出查看详细的统计信息和任务创建过程

## 未来扩展

1. **动态位置分配**: 根据worker数量和source状态动态调整任务数量
2. **优先级优化**: 根据位置距离和地形类型调整任务优先级
3. **缓存机制**: 缓存source分析结果，减少重复计算
4. **可视化工具**: 提供source和可采集位置的可视化界面
