import { BaseStrategy } from './BaseStrategy';
import { PlanningTaskMemory } from '../../types';
import { GameConfig } from 'config/GameConfig';

export class InitialRoomSetupStrategy extends BaseStrategy {
  public readonly name = 'InitialRoomSetupStrategy';

  public getSubscribedEvents(): string[] {
    // 房间初始化完成后触发
    return [GameConfig.EVENTS.ROOM_INITIALIZED];
  }

  public handleEvent(eventType: string, eventData: any): PlanningTaskMemory[] {
    if (eventType === GameConfig.EVENTS.ROOM_INITIALIZED) {
      const roomName = eventData.roomName;
      console.log(`[InitialRoomSetupStrategy] 触发了 ${roomName} 的初始设置规划。`);

      // 创建一个任务列表，包含多个规划任务
      const tasks: PlanningTaskMemory[] = [
        {
          plannerName: 'extension',
          context: {
            roomName: roomName,
            trigger: 'event',
            event: { type: eventType, data: eventData }
          }
        },
        // 规划Container
        {
          plannerName: 'container',
          context: {
            roomName: roomName,
            trigger: 'event',
            event: { type: eventType, data: eventData }
          }
        },
        // 规划道路
        {
          plannerName: 'road',
          context: {
            roomName: roomName,
            trigger: 'event',
            event: { type: eventType, data: eventData }
          }
        }
      ];
      return tasks;
    }

    return [];
  }
}
