/**
 * 可视化系统配置
 */
export class VisualConfig {
  // 可视化层配置
  public static readonly LAYERS = {
    // 房间基本信息
    ROOM_INFO: {
      enabled: true,
      priority: 1,
      updateFrequency: 5,
      style: { color: '#ffffff', fontSize: 12 }
    },
    // 自动化路径规划
    PATHFINDING: {
      enabled: false,
      priority: 2,
      updateFrequency: 10,
      style: { color: '#00ff00', lineStyle: 'dashed' }
    },
    // 自动化建筑建造规划
    CONSTRUCTION: {
      enabled: true,
      priority: 3,
      updateFrequency: 15,
      style: { color: '#ffff00', opacity: 0.8 }
    },
    // 自动化战斗规划
    COMBAT: {
      enabled: true,
      priority: 4,
      updateFrequency: 2,
      style: { color: '#ff0000', fontSize: 14 }
    },
    // 全局统计信息
    STATS: {
      enabled: true,
      priority: 5,
      updateFrequency: 20,
      style: { color: '#00ffff', fontSize: 10 }
    }
  } as const;

  // 性能控制
  public static readonly PERFORMANCE = {
    MAX_VISUAL_SIZE: 800000, // 800KB限制
    CLEAR_ON_OVERFLOW: true,
    ENABLE_CACHING: true
  } as const;
}
