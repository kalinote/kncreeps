// 可视化图层类型
export enum LayerType {
  DATA = 'data', // 在屏幕固定位置显示文本信息
  MAP = 'map'    // 在游戏世界地图上绘制图形
}

// 用于存储可视化系统相关数据
export interface VisualsMemory {
  cache: string | null; // 缓存的视觉数据
  lastUpdateTime: number; // 上次更新的 tick
  layerSettings: {
    [layerName: string]: {
      enabled: boolean;
    };
  };
}
