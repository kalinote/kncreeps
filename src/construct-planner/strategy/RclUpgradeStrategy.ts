import { BaseStrategy } from './BaseStrategy';
import { PlanningTaskMemory } from '../../types';
import { GameConfig } from 'config/GameConfig';

export class RclUpgradeStrategy extends BaseStrategy {
  public readonly name = 'RclUpgradeStrategy';

  public getSubscribedEvents(): string[] {
    return [GameConfig.EVENTS.ROOM_CONTROLLER_LEVEL_CHANGED];
  }

  public handleEvent(eventType: string, eventData: any): PlanningTaskMemory[] {
    if (eventType === GameConfig.EVENTS.ROOM_CONTROLLER_LEVEL_CHANGED) {
      const { roomName, newLevel } = eventData;
      const tasks: PlanningTaskMemory[] = [];

      // 1. 总是触发 Extension 规划
      tasks.push({
        plannerName: 'extension',
        context: {
          roomName: roomName,
          trigger: 'event',
          event: { type: eventType, data: eventData }
        }
      });

      // // 2. 当RCL达到3级时，额外触发 Tower 规划
      // if (newLevel === 3) {
      //   tasks.push({
      //     plannerName: 'tower', // 假设有一个 TowerPlanner
      //     context: {
      //       roomName: roomName,
      //       trigger: 'event',
      //       event: { type: eventType, data: eventData }
      //     }
      //   });
      // }

      // // 3. 当RCL达到4级时，额外触发 Storage 规划
      // if (newLevel === 4) {
      //   tasks.push({
      //     plannerName: 'storage', // 假设有一个 StoragePlanner
      //     context: {
      //       roomName: roomName,
      //       trigger: 'event',
      //       event: { type: eventType, data: eventData }
      //     }
      //   });
      // }

      return tasks;
    }
    return [];
  }
}
