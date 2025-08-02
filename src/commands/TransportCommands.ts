import { BaseCommand, CommandArgs, CommandResult } from "./BaseCommand";

/**
 * 运输状态命令 - 诊断transport任务问题
 */
export class TransportStatusCommand extends BaseCommand {
  getName(): string {
    return "transportStatus";
  }

  getDescription(): string {
    return "诊断transport任务问题";
  }

  getUsage(): string {
    return "transportStatus [roomName?]";
  }

  execute(args?: CommandArgs): CommandResult {
    const roomName = args?.roomName as string;

    this.log('=== TRANSPORT 任务诊断报告 ===');
    this.log(`当前 Tick: ${Game.time}`);
    this.log('');

    const rooms = roomName ? [Game.rooms[roomName]] : Object.values(Game.rooms);

    for (const room of rooms) {
      if (!room || !room.controller?.my) continue;

      this.log(`🏢 房间: ${room.name}`);

      // 1. 检查地面资源
      this.checkDroppedResources(room);

      // 1.5 检查存储设施状态
      this.checkStorageFacilities(room);

      // 2. 检查transport任务状态
      this.checkTransportTasks(room);

      // 3. 检查运输网络状态
      this.checkTransportNetwork(room);

      this.log('');
    }

    this.log('=== 诊断报告结束 ===');

    return {
      success: true,
      message: "运输状态诊断报告已生成"
    };
  }

  private checkDroppedResources(room: Room): void {
    const droppedResources = room.find(FIND_DROPPED_RESOURCES, {
      filter: r => r.amount > 50
    });
    this.log(`  📦 地面资源: ${droppedResources.length} 个`);
    if (droppedResources.length > 0) {
      droppedResources.forEach((resource, index) => {
        this.log(`    ${index + 1}. ${resource.resourceType} x${resource.amount} 位置(${resource.pos.x},${resource.pos.y})`);
      });
    }
  }

  private checkStorageFacilities(room: Room): void {
    this.log(`  🏪 存储设施状态:`);

    // 检查storage
    const storages = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_STORAGE
    });
    this.log(`    Storage: ${storages.length} 个`);
    if (storages.length > 0) {
      storages.forEach((storage, index) => {
        const store = (storage as any).store;
        const freeCapacity = store.getFreeCapacity();
        const totalCapacity = store.getCapacity();
        this.log(`      ${index + 1}. 剩余空间: ${freeCapacity}/${totalCapacity}`);
      });
    }

    // 检查container
    const containers = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER
    });
    this.log(`    Container: ${containers.length} 个`);
    if (containers.length > 0) {
      containers.forEach((container, index) => {
        const store = (container as any).store;
        const freeCapacity = store.getFreeCapacity();
        const totalCapacity = store.getCapacity();
        this.log(`      ${index + 1}. 剩余空间: ${freeCapacity}/${totalCapacity}`);
      });
    }

    // 检查能量建筑
    const energyStructures = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN
    });
    this.log(`    能量建筑: ${energyStructures.length} 个`);
    if (energyStructures.length > 0) {
      let totalEnergy = 0;
      let totalCapacity = 0;
      energyStructures.forEach((structure) => {
        const store = (structure as any).store;
        totalEnergy += store.getUsedCapacity(RESOURCE_ENERGY);
        totalCapacity += store.getCapacity(RESOURCE_ENERGY);
      });
      this.log(`      总能量: ${totalEnergy}/${totalCapacity}`);
    }
  }

  private checkTransportTasks(room: Room): void {
    this.log(`  🚚 Transport任务状态:`);
    const transportCreeps = room.find(FIND_MY_CREEPS, {
      filter: c => c.memory.role === 'transporter'
    });
    this.log(`    Transporter数量: ${transportCreeps.length}`);

    transportCreeps.forEach((creep, index) => {
      const taskId = creep.memory.targetId;
      this.log(`    ${index + 1}. ${creep.name}:`);
      this.log(`      任务: ${taskId || '无'}`);
      this.log(`      携带: ${creep.store.getUsedCapacity()}/${creep.store.getCapacity()}`);

      if (taskId) {
        // 尝试获取任务详情
        try {
          const taskManager = this.getService<any>('taskManager');
          if (taskManager) {
            const task = taskManager.getTask(taskId);
            if (task) {
              this.log(`      任务类型: ${task.type}`);
              this.log(`      任务状态: ${task.status}`);
              if (task.params) {
                this.log(`      源ID: ${task.params.sourceId || '无'}`);
                this.log(`      目标ID: ${task.params.targetId || '无'}`);
                this.log(`      资源类型: ${task.params.resourceType || '无'}`);
              }
            }
          }
        } catch (error) {
          this.log(`      获取任务详情失败: ${error}`);
        }
      }
    });
  }

  private checkTransportNetwork(room: Room): void {
    // TODO 重构命令
    console.log("该模块尚未重构完成");
    // this.log(`  🌐 运输网络状态:`);
    // if (room.memory.logistics?.transportNetwork) {
    //   const network = room.memory.logistics.transportNetwork;
    //   this.log(`    提供者: ${Object.keys(network.providers).length} 个`);
    //   this.log(`    消费者: ${Object.keys(network.consumers).length} 个`);
    //   this.log(`    最后更新: Tick ${network.lastUpdated}`);

    //   // 显示具体的提供者和消费者
    //   for (const [id, provider] of Object.entries(network.providers)) {
    //     const obj = Game.getObjectById(id as Id<AnyStructure | Resource>);
    //     if (obj) {
    //       const amount = obj instanceof Resource ? obj.amount : (obj as any).store?.getUsedCapacity(provider.resourceType) || 0;
    //       this.log(`      提供者 ${id}: ${provider.type} - ${provider.resourceType} x${amount}`);
    //     }
    //   }

    //   for (const [id, consumer] of Object.entries(network.consumers)) {
    //     const obj = Game.getObjectById(id as Id<AnyStructure>);
    //     if (obj) {
    //       const needs = (obj as any).store?.getFreeCapacity(consumer.resourceType) || 0;
    //       this.log(`      消费者 ${id}: ${consumer.type} - 需要 ${consumer.resourceType} x${needs}`);
    //     }
    //   }
    // } else {
    //   this.log(`    运输网络未初始化`);
    // }
  }
}
