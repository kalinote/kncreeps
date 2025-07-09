/**
 * 可视化配置
 */
export const VisualConfig = {
  // 样式定义
  STYLES: {
    // ... (保留现有的样式)
    ROOM_INFO_STYLE: {
      color: '#FFFFFF',
      font: 0.8,
      align: 'left'
    },
    PATH_STYLE: {
      stroke: '#FF0000',
      strokeWidth: 0.1,
      opacity: 0.5
    },
    STRUCTURE_STYLE: {
      fill: 'transparent',
      stroke: '#00FFFF',
      strokeWidth: 0.1
    }
  },

  // 性能控制
  PERFORMANCE: {
    MAX_VISUAL_SIZE: 1024 * 500 // 500KB
  },

  // 可视化更新频率
  UPDATE_INTERVAL: 5,

  LAYERS: {
    // 定义所有图层的名称常量
    ROOM_INFO: 'RoomInfoLayer'
  },

  LAYER_DEFAULTS: {
    // 定义每个图层的默认设置
    [('RoomInfoLayer')]: {
      enabled: true, // 默认是否启用
      priority: 10 // 渲染优先级，数字越小越先渲染
    }
  }
};
