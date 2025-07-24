/**
 * 可视化配置
 */
export const VisualConfig = {
  // 样式定义
  STYLES: {
    // 房间信息
    ROOM_INFO_STYLE: {
      color: '#FFFFFF',
      font: 0.8,
      align: 'left' as 'left' | 'center' | 'right',
    },
    // 全局信息
    GLOBAL_INFO_STYLE: {
      color: '#FFFFFF',
      font: 0.8,
      align: 'left' as 'left' | 'center' | 'right',
    },
    // 任务分配
    TASK_ASSIGNMENT_STYLE: {
      color: '#FFFFFF',
      font: 0.8,
      align: 'left' as 'left' | 'center' | 'right',
    },
    // 路径
    PATH_STYLE: {
      stroke: '#FF0000',
      strokeWidth: 0.1,
      opacity: 0.5
    },
    // 建筑
    STRUCTURE_STYLE: {
      fill: 'transparent',
      stroke: '#00FFFF',
      strokeWidth: 0.1
    },
    // 任务路径跟踪
    TASK_TRACK_STYLE: {
      stroke: '#8888FF',
      strokeWidth: 0.07,
      opacity: 0.7,
      font: 0.5,
      color: '#8888FF'
    },
    // 未建造的道路
    ROAD_PLAN_STYLE: {
      color: '#FFD700',
      width: 0.1,
      opacity: 0.7
    },
    // 建造中的道路
    ROAD_UNDER_CONSTRUCTION_STYLE: {
      color: '#00FF00',
      width: 0.1,
      opacity: 0.8
    },
    // 已完成的道路
    ROAD_COMPLETED_STYLE: {
      color: '#888888',
      width: 0.05,
      opacity: 0.3
    },
    // 已规划的容器
    CONTAINER_PLAN_STYLE: {
      fill: 'transparent',
      stroke: '#FFD700',
      strokeWidth: 0.15,
      opacity: 0.8
    },
    // 建造中的容器
    CONTAINER_UNDER_CONSTRUCTION_STYLE: {
      fill: 'transparent',
      stroke: '#00FF00',
      strokeWidth: 0.15,
      opacity: 0.9
    },
    // 已完成的容器
    CONTAINER_COMPLETED_STYLE: {
      fill: 'transparent',
      stroke: '#888888',
      strokeWidth: 0.1,
      opacity: 0.4
    }
  },

  // 任务类型颜色配置
  TASK_COLORS: {
    HARVEST: {
      stroke: '#FFD700', // 金色 - 采集任务
      color: '#FFD700',
      strokeWidth: 0.07,
      opacity: 0.8,
      font: 0.5
    },
    TRANSPORT: {
      stroke: '#00FF00', // 绿色 - 运输任务
      color: '#00FF00',
      strokeWidth: 0.07,
      opacity: 0.8,
      font: 0.5
    },
    BUILD: {
      stroke: '#FF6B35', // 橙色 - 建造任务
      color: '#FF6B35',
      strokeWidth: 0.07,
      opacity: 0.8,
      font: 0.5
    },
    UPGRADE: {
      stroke: '#9370DB', // 紫色 - 升级任务
      color: '#9370DB',
      strokeWidth: 0.07,
      opacity: 0.8,
      font: 0.5
    },
    ATTACK: {
      stroke: '#FF0000', // 红色 - 攻击任务
      color: '#FF0000',
      strokeWidth: 0.07,
      opacity: 0.8,
      font: 0.5
    }
  },

  // 性能控制
  PERFORMANCE: {
    MAX_VISUAL_SIZE: 1024 * 500 // 500KB
  },

  // 可视化更新频率
  UPDATE_INTERVAL: 0,

  LAYER_DEFAULTS: {
    // 定义每个图层的默认设置
    ['GlobalInfoLayer']: {
      enabled: true,
      priority: 5
    },
    ['RoomInfoLayer']: {
      enabled: true, // 默认是否启用
      priority: 10 // 渲染优先级，数字越小越先渲染
    },
    ['TaskAssignmentLayer']: {
      enabled: true,
      priority: 15
    },
    ['TaskTrackLayer']: {
      enabled: true,
      priority: 50
    },
    ['ConstructionPlannerLayer']: {
      enabled: true,
      priority: 55
    }
  }
};


/**
 * 屏幕锚点定义
 * 定义了数据类图层可以停靠的屏幕位置。
 */
export const ANCHORS = {
  TOP_LEFT: { x: 0, y: 0 },
  TOP_CENTER: { x: 0.5, y: 0 },
  TOP_RIGHT: { x: 1, y: 0 },
  MIDDLE_LEFT: { x: 0, y: 0.5 },
  MIDDLE_CENTER: { x: 0.5, y: 0.5 },
  MIDDLE_RIGHT: { x: 1, y: 0.5 },
  BOTTOM_LEFT: { x: 0, y: 1 },
  BOTTOM_CENTER: { x: 0.5, y: 1 },
  BOTTOM_RIGHT: { x: 1, y: 1 }
};

/**
 * 数据类图层的布局配置
 */
export const DATA_LAYER_LAYOUTS: { [layerName: string]: any } = {
  GlobalInfoLayer: {
    anchor: ANCHORS.TOP_LEFT,
    order: 1,
    padding: { x: 0.5, y: 0.5 }
  },
  RoomInfoLayer: {
    anchor: ANCHORS.TOP_LEFT,
    order: 2,
    padding: { x: 0.5, y: 0.5 }
  },
  TaskAssignmentLayer: {
    anchor: ANCHORS.TOP_LEFT,
    order: 3,
    padding: { x: 0.5, y: 0.5 }
  }
};
