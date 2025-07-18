// 导入其他模块的类型
import {
  SystemMemory,
  StatsMemory,
  CoordinationMemory,
  EventBusMemory
} from './core';
import {
  CreepState,
  IntelligenceMemory,
  CreepProductionMemory
} from './creep';
import { TaskSystemMemory } from './task';
import { VisualsMemory } from './visual';
import { ConstructionPlannerMemory } from './construction';
import { LogisticsMemory } from './logistics';

// 扩展全局Memory接口
declare global {
  interface Memory {
    uuid: number;
    log: any;
    // 系统相关的内存扩展
    rooms: { [roomName: string]: RoomMemory };
    creepProduction: CreepProductionMemory;
    intelligence: IntelligenceMemory;
    creepStates: { [creepName: string]: CreepState };

    eventBus: EventBusMemory;
    tasks?: TaskSystemMemory;
    gameEngine?: {
      initialized: boolean;
      lastTick: number;
      version?: string;
      startTime?: number;
    };
    system?: SystemMemory;
    stats?: StatsMemory;
    coordination?: CoordinationMemory;
    visuals?: VisualsMemory;
    constructPlanner?: ConstructionPlannerMemory;
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

  // 扩展RoomMemory接口
  interface RoomMemory {
    energyAvailable: number;
    energyCapacity: number;
    activeConstructionStrategy?: string | null;
    planningAttemptedAt?: number;
    needsAttention: boolean;
    lastEnemyActivity?: number; // 最近敌人活动时间
    // 统一后的新字段
    creepCounts: { [role: string]: number };
    threatLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
    lastUpdated: number;
    logistics?: LogisticsMemory;
    bootstrapStatus: {
      // 后面把各服务的初始化信息全部放到这里
      logistics: boolean;
    }
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
