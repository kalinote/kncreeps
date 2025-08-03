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
        // 任务一：规划道路
        {
          plannerName: 'road', // 指定 RoadPlanner
          context: {
            roomName: roomName,
            trigger: 'event',
            event: { type: eventType, data: eventData }
          }
        },
        // 任务二：规划矿点Container
        {
          plannerName: 'container', // 指定 ContainerPlanner
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
