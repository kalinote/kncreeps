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

export type ChartType = 'text' | 'progressBar' | 'lineChart' | 'barChart' | 'pieChart';

export interface TextBufferItem {
  type: 'text';
  data: {
    text: string;
  };
  offset?: {
    x: number;
    y: number;
  };
}

export interface ProgressBarBufferItem {
  type: 'progressBar';
  data: {
    progress: number;
    total: number;
    label: string;
    /**
     * 自定义宽度，如果设置自定义宽带，则在渲染时会使用该宽度作为进度条总长度
     * 如果为0或未定义，则使用默认宽度
     */
    width?: number;
  };
  offset?: {
    x: number;
    y: number;
  };
}

export interface LineChartBufferItem {
  type: 'lineChart';
  data: {
    xAxis: any[];
    datas: any[];
    label: string;
    width?: number;
  };
  offset?: {
    x: number;
    y: number;
  };
}

export type ChartBufferItem = TextBufferItem | ProgressBarBufferItem | LineChartBufferItem;

// 图表缓冲区，用于表示数据
export type ChartBuffer = ChartBufferItem[];
