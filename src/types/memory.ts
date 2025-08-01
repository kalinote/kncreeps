// 导入其他模块的类型
import {
  EventBusMemory,
  UnifiedMemoryCycleStructureMemory
} from './core';
import {
  CreepManagerMemory
} from './creep';
import { TaskManagerMemory } from './task';
import { VisualManagerMemory } from './visual';
import { ConstructionManagerMemory } from './construction';
import { LogisticsMemory } from './logistics';
import { RoomManagerMemory } from './room';
import { StatsManagerMemory } from './stats';

// 扩展全局Memory接口
declare global {
  interface Memory {
    // 系统相关的内存扩展
    // 精简内存，没有用到的字段不要实际添加，如果有后续可能有用的字段，可以先注释
    // uuid: number;
    // log: any;
    [key: string]: any;

    // creep管理系统
    creepManager?: CreepManagerMemory;

    // 建筑规划系统
    constructionManager?: ConstructionManagerMemory;

    // 后勤管理系统
    logisticsManager?: LogisticsMemory;

    // 协调管理系统
    coordinationManager?: ConstructionManagerMemory;

    // 可视化系统
    visualManager?: VisualManagerMemory;

    // 房间管理系统
    roomManager?: RoomManagerMemory;

    // 全局统计系统
    statsManager?: StatsManagerMemory;

    // 任务管理系统
    taskManager?: TaskManagerMemory;

    eventBus: EventBusMemory;

    gameEngine?: {
      initialized: boolean;
      lastTick: number;
      version?: string;
      startTime?: number;
    };
  }

  // 扩展CreepMemory接口
  interface CreepMemory {
    role: string;
    room: string;
    working: boolean;
    // 扩展creep内存
    targetId?: string;
    // targetSourceId?: string;    // 后续合并到task中
    // Defender专用内存(后续合并到task中)
    target?: string;           // 当前攻击目标ID
    patrolPoint?: { x: number; y: number; roomName: string }; // 巡逻点
    lastEnemySeen?: number;    // 最后发现敌人的时间
    enemyMemory?: { [enemyId: string]: number }; // 敌人记忆，存储最后见到的时间
    // 任务中断保护标志
    canBeInterrupted?: boolean; // 是否可以被中断，用于防止运输任务中途被打断
    // 采集位置分配
    assignedHarvestPos?: { x: number; y: number; roomName: string }; // 分配给creep的采集位置
  }

  // 扩展全局对象
  namespace NodeJS {
    interface Global {
      log: any;
      gameEngine?: any; // 避免循环引用，使用any类型
      serviceContainer?: any; // 服务容器引用
      taskDebug?: any; // 添加任务调试工具
      production?: { // 生产调试工具
        plan: (roomName?: string) => void;
        tasks: (roomName?: string) => void;
        queue: () => void;
        refresh: () => void;
        transport?: (roomName?: string) => void;
        debug?: (roomName?: string) => void;
      };
      visual?: { // 可视化调试工具
        showTaskTrack: (show: boolean) => void;
      };
    }
  }
}
