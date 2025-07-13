import { EventBus } from "../core/EventBus";
import { GameConfig } from "../config/GameConfig";
import { TaskRoleMapping } from "../config/TaskConfig";
import { BodyBuilder } from "../utils/BodyBuilder";
import { ProductionNeed, Task, TaskType, TaskStatus, TaskAssignmentType } from "../types";
import { BaseService } from "./BaseService";
import { ServiceContainer } from "../core/ServiceContainer";

/**
 * Creep生产服务 - 基于任务需求的生产系统
 */
export class CreepProductionService extends BaseService {
  private lastProductionCheck: number = 0;
  private lastTaskAnalysis: number = 0;

  constructor(eventBus: EventBus, serviceContainer: ServiceContainer) {
    super(eventBus, serviceContainer);
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  protected setupEventListeners(): void {
    // 监听任务创建事件
    this.eventBus.on(GameConfig.EVENTS.TASK_CREATED, (task: Task) => {
      this.updateProductionDemands();
    });

    // 监听任务完成事件
    this.eventBus.on(GameConfig.EVENTS.TASK_COMPLETED, (task: Task) => {
      this.updateProductionDemands();
    });

    // 监听任务失败事件
    this.eventBus.on(GameConfig.EVENTS.TASK_FAILED, (task: Task) => {
      this.updateProductionDemands();
    });
  }

  /**
   * 发送事件
   */
  protected emit(eventType: string, data: any): void {
    this.eventBus.emit(eventType, data);
  }

  /**
   * 评估生产需求 - 基于任务需求的生产逻辑
   */
  public assessProductionNeeds(): void {
    // 使用配置的生产检查频率
    if (Game.time - this.lastProductionCheck < GameConfig.UPDATE_FREQUENCIES.CREEP_PRODUCTION) {
      return;
    }

    // 清理重复的生产需求
    this.cleanupDuplicateProductionNeeds();

    // 移除已完成的需求或不再需要的需求
    this.removeCompletedNeeds();

    this.lastProductionCheck = Game.time;

    // 检查是否需要处理开局生产
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room && room.controller?.my && GameConfig.isBootstrapPhase(room)) {
        if (!GameConfig.isBootstrapCompleted(room)) {
          this.handleBootstrapProduction(room);
          return; // 开局阶段优先处理，不执行任务驱动生产
        }
      }
    }

    // 基于任务需求更新生产需求
    this.updateProductionDemands();

    // 处理紧急情况（如房间受到攻击）
    this.handleEmergencySituations();
  }

  /**
   * 处理开局生产逻辑
   */
  private handleBootstrapProduction(room: Room): void {
    // console.log(`🚀 [Bootstrap] 房间 ${room.name} 处于开局阶段，使用开局生产策略`);

    const availableEnergy = room.energyAvailable;
    const spawns = room.find(FIND_MY_SPAWNS);

    if (spawns.length === 0) {
      // console.log(`[Bootstrap] 房间 ${room.name} 没有spawn`);
      return;
    }

    const spawn = spawns[0];
    if (spawn.spawning) {
      // console.log(`[Bootstrap] spawn正在生产: ${spawn.spawning.name}`);
      return;
    }

    // 获取当前角色数量
    const workerCount = Object.values(Game.creeps).filter(creep =>
      creep.room.name === room.name && creep.memory.role === GameConfig.ROLES.WORKER
    ).length;
    const transporterCount = Object.values(Game.creeps).filter(creep =>
      creep.room.name === room.name && creep.memory.role === GameConfig.ROLES.TRANSPORTER
    ).length;

    // console.log(`[Bootstrap] 当前数量: worker=${workerCount}, transporter=${transporterCount}`);

    // 按开局生产顺序处理
    for (const role of GameConfig.BOOTSTRAP_CONFIG.PRODUCTION_ORDER) {
      const config = GameConfig.getBootstrapConfig(role);
      if (!config) continue;

      const currentCount = role === GameConfig.ROLES.WORKER ? workerCount : transporterCount;
      const minRequired = role === GameConfig.ROLES.WORKER ?
        GameConfig.BOOTSTRAP_CONFIG.COMPLETION_CONDITIONS.MIN_WORKER_COUNT :
        GameConfig.BOOTSTRAP_CONFIG.COMPLETION_CONDITIONS.MIN_TRANSPORTER_COUNT;

      if (currentCount < minRequired && availableEnergy >= config.cost) {
        // console.log(`[Bootstrap] 生产开局${role}: 需要${minRequired}, 当前${currentCount}, 成本${config.cost}`);

        // 生成creep名称
        const creepName = this.generateCreepName(role);

        // 尝试生产creep
        const result = spawn.spawnCreep([...config.body], creepName, {
          memory: { role: role, state: 'idle', room: room.name, working: false }
        });

        if (result === OK) {
          console.log(`[Bootstrap] 成功生产开局${role}: ${creepName}`);

          // 发送事件
          this.emit(GameConfig.EVENTS.CREEP_SPAWNED, {
            creepName,
            role: role,
            roomName: room.name,
            cost: config.cost
          });

          return; // 每次只生产一个
        } else {
          console.log(`[Bootstrap] 生产开局${role}失败: ${result}`);
        }
      }
    }

    // console.log(`[Bootstrap] 开局生产完成或无法生产`);
  }

  /**
   * 更新生产需求 - 基于当前任务状态
   */
  private updateProductionDemands(): void {
    // 获取所有待分配的任务
    const pendingTasks = this.getPendingTasks();

    // 按房间分组任务
    const tasksByRoom = this.groupTasksByRoom(pendingTasks);

    // 为每个房间计算生产需求
    for (const [roomName, tasks] of tasksByRoom) {
      this.calculateRoomProductionDemands(roomName, tasks);
    }

    // 额外检查：确保每个房间都达到RCL最小配置要求
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room && room.controller?.my) {
        this.ensureMinimumRoleRequirements(room);
      }
    }
  }

  /**
   * 确保房间达到RCL最小角色配置要求
   */
  private ensureMinimumRoleRequirements(room: Room): void {
    const controllerLevel = room.controller?.level || 1;
    const roomName = room.name;
    const currentRoleCounts = this.getRoleCountsInRoom(roomName);
    const totalCreepsInRoom = this.getCreepCountInRoom(roomName);

    // 检查每种角色是否达到最小配置要求
    for (const role of [GameConfig.ROLES.WORKER, GameConfig.ROLES.TRANSPORTER]) {
      const currentCount = currentRoleCounts[role] || 0;
      const limits = GameConfig.getRoleLimits(controllerLevel, role);

      if (limits && currentCount < limits.min) {
        // 检查是否可以生产更多
        if (GameConfig.canProduceMoreCreeps(controllerLevel, role, currentCount, totalCreepsInRoom)) {
          console.log(`[ensureMinimumRoleRequirements] 房间 ${roomName} ${role} 未达到最小配置: ${currentCount}/${limits.min}`);

          this.addProductionNeed(
            roomName,
            role,
            GameConfig.PRIORITIES.HIGH,
            room.energyAvailable,
            undefined,
            undefined,
            undefined,
            `Min role requirement: ${role} (${currentCount}/${limits.min})`
          );
        }
      }
    }
  }

  /**
   * 按房间分组任务
   */
  private groupTasksByRoom(tasks: Task[]): Map<string, Task[]> {
    const tasksByRoom = new Map<string, Task[]>();

    for (const task of tasks) {
      if (!tasksByRoom.has(task.roomName)) {
        tasksByRoom.set(task.roomName, []);
      }
      tasksByRoom.get(task.roomName)!.push(task);
    }

    return tasksByRoom;
  }

  /**
   * 计算房间的生产需求
   */
  private calculateRoomProductionDemands(roomName: string, tasks: Task[]): void {
    const room = Game.rooms[roomName];
    if (!room || !room.controller?.my) {
      return;
    }

    if (tasks.length === 0) {
      return; // 没有任务就不需要生产
    }

    // 按任务类型分组
    const tasksByType = this.groupTasksByType(tasks);

    // 获取当前角色数量和分配状态
    const currentRoleCounts = this.getRoleCountsInRoom(roomName);
    const controllerLevel = room.controller.level || 1;
    const totalCreepsInRoom = this.getCreepCountInRoom(roomName);

    // 为每种任务类型计算需要的角色
    for (const [taskType, taskList] of tasksByType) {
      const roles = TaskRoleMapping.getRolesForTask(taskType);

      for (const role of roles) {
        const totalCount = currentRoleCounts[role] || 0;
        const maxAllowed = this.getRoleLimit(controllerLevel, role);

        // 获取当前执行相同任务类型的creep数量
        const busyCount = this.getCreepsAssignedToTaskType(roomName, role, taskType);
        // 获取空闲的creep数量
        const availableCount = this.getAvailableCreepsOfRole(roomName, role);

        // 计算实际需要的数量
        const neededCount = this.calculateNeededCount(taskList, role, busyCount, availableCount);

        // 修改条件：基于实际需求而不是总数
        // 如果需要的数量大于当前忙于此类任务的数量 + 空闲数量，且未达到上限
        const effectiveAvailable = busyCount + availableCount;
        if (neededCount > effectiveAvailable && totalCount < maxAllowed) {
          const priority = TaskRoleMapping.calculateTaskPriority(taskType, taskList.length);

          this.addProductionNeed(
            roomName,
            role,
            priority,
            room.energyAvailable,
            undefined,
            taskType,
            taskList.length,
            `Task demand: ${taskType} (${taskList.length} tasks, need ${neededCount}, available ${effectiveAvailable})`
          );
        }
      }
    }
  }

  /**
   * 按任务类型分组
   */
  private groupTasksByType(tasks: Task[]): Map<TaskType, Task[]> {
    const tasksByType = new Map<TaskType, Task[]>();

    for (const task of tasks) {
      if (!tasksByType.has(task.type)) {
        tasksByType.set(task.type, []);
      }
      tasksByType.get(task.type)!.push(task);
    }

    return tasksByType;
  }

  /**
   * 计算需要的角色数量 - 增强版，考虑当前分配状态
   */
  private calculateNeededCount(tasks: Task[], role: string, busyCount: number, availableCount: number): number {
    if (tasks.length === 0) return 0;

    // 分析任务状态
    const pendingTasks = tasks.filter(task => task.status === TaskStatus.PENDING);
    const activeTasks = tasks.filter(task =>
      task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.ASSIGNED
    );

    let needed = 0;

    // 根据角色类型和任务状态计算需求
    switch (role) {
      case GameConfig.ROLES.WORKER:
        // Worker可以执行多种任务类型
        // 对于pending任务，需要额外的worker
        if (pendingTasks.length > 0) {
          // 至少需要能处理所有pending任务的worker数量
          needed = Math.max(pendingTasks.length, busyCount + Math.ceil(pendingTasks.length * 0.8));
        } else {
          // 如果没有pending任务，当前busy的数量应该够用
          needed = busyCount;
        }
        break;

      case GameConfig.ROLES.TRANSPORTER:
        // Transporter专门处理transport任务
        if (tasks.length > 0 && tasks[0].type === TaskType.TRANSPORT) {
          needed = this.calculateTransporterNeeds(tasks, busyCount, availableCount);
        } else {
          needed = Math.max(busyCount, Math.ceil(tasks.length * 0.8));
        }
        break;

      case GameConfig.ROLES.SHOOTER:
        // Shooter专门处理战斗任务，通常1对1
        needed = Math.max(busyCount, tasks.length);
        break;

      default:
        // 其他角色
        needed = Math.max(busyCount, Math.ceil(tasks.length * 0.7));
        break;
    }

    // 确保合理的范围
    const maxReasonable = Math.min(tasks.length * 2, 12);
    return Math.max(1, Math.min(needed, maxReasonable));
  }

  /**
   * 计算transporter需求 - 考虑当前状态
   */
  private calculateTransporterNeeds(tasks: Task[], busyCount: number, availableCount: number): number {
    if (tasks.length === 0) return 0;

    // 分析任务状态
    const pendingTasks = tasks.filter(task => task.status === TaskStatus.PENDING);
    const activeTasks = tasks.filter(task =>
      task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.ASSIGNED
    );

    // 对于transport任务，每个任务代表一个需要处理的资源堆
    // 如果有很多pending任务，说明地面资源积累，需要更多transporter
    let needed = busyCount; // 至少需要维持当前忙碌的数量

    if (pendingTasks.length > 0) {
      // 有pending任务说明资源在积累，需要更多transporter
      needed += Math.ceil(pendingTasks.length * 0.8); // 不需要1:1，因为transporter移动速度较快
    }

    // 考虑transport任务的特殊性：运输效率
    // 如果有很多小的transport任务（资源量少），可能需要更多transporter
    const totalResourceAmount = tasks.reduce((sum, task) => {
      if (task.type === TaskType.TRANSPORT) {
        return sum + (task.params.amount || 50); // 假设默认50能量
      }
      return sum + 50; // 其他任务类型默认50
    }, 0);

    const averageResourcePerTask = totalResourceAmount / tasks.length;
    if (averageResourcePerTask < 25) {
      // 小资源堆需要更多transporter频繁来回
      needed = Math.ceil(needed * 1.2);
    }

    return Math.max(1, Math.min(needed, 8)); // 限制在合理范围内
  }

  /**
   * 获取角色限制
   */
  private getRoleLimit(roomLevel: number, role: string): number {
    const limits = GameConfig.getRoleLimits(roomLevel, role);
    return limits ? limits.max : 0;
  }

  /**
   * 处理紧急情况
   */
  private handleEmergencySituations(): void {
    // 检查房间是否受到攻击
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room && room.controller?.my) {
        const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
        if (hostileCreeps.length > 0) {
          this.handleRoomUnderAttack(roomName, hostileCreeps.length);
        }
      }
    }

    // 检查需要替换的creep
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      if (creep.ticksToLive && creep.ticksToLive < GameConfig.THRESHOLDS.CREEP_REPLACEMENT_TIME) {
        this.addProductionNeed(
          creep.room.name,
          creep.memory.role,
          GameConfig.PRIORITIES.HIGH,
          creep.room.energyAvailable,
          undefined,
          undefined,
          undefined,
          `Creep replacement: ${creep.name}`
        );
      }
    }
  }

  /**
   * 获取待分配的任务 - 包含需要生产creep的任务
   */
  private getPendingTasks(): Task[] {
    if (!Memory.tasks) return [];

    return Memory.tasks.taskQueue.filter(task => {
      // 对于transport任务，需要特殊处理
      if (task.type === TaskType.TRANSPORT) {
        // transport任务是EXCLUSIVE类型，一旦分配就变为IN_PROGRESS
        // 但如果地面上还有更多资源，可能需要更多transporter
        // 所以transport任务只要是活跃状态就计入需求
        return task.status === TaskStatus.PENDING ||
          task.status === TaskStatus.ASSIGNED ||
          task.status === TaskStatus.IN_PROGRESS;
      }

      // 其他任务类型只考虑PENDING状态
      return task.status === TaskStatus.PENDING;
    });
  }

  /**
   * 添加生产需求
   */
  public addProductionNeed(
    roomName: string,
    role: string,
    priority: number,
    availableEnergy: number,
    energyBudget?: number,
    taskType?: TaskType,
    taskCount?: number,
    reason?: string
  ): void {
    // 检查是否已存在相同的生产需求
    const existingNeed = this.productionQueue.find(need =>
      need.roomName === roomName && need.role === role
    );

    if (existingNeed) {
      // 如果已存在，比较优先级，保留优先级更高的
      if (priority > existingNeed.priority) {
        existingNeed.priority = priority;
        existingNeed.urgency = priority >= GameConfig.PRIORITIES.CRITICAL ? 'critical' : 'normal';
        existingNeed.taskType = taskType;
        existingNeed.taskCount = taskCount;
        existingNeed.reason = reason;
        // console.log(`[addProductionNeed] 更新生产需求: ${role} (房间: ${roomName}, 优先级: ${priority})`);
      }
      return;
    }

    const need: ProductionNeed = {
      roomName,
      role,
      priority,
      urgency: priority >= GameConfig.PRIORITIES.CRITICAL ? 'critical' : 'normal',
      energyBudget: energyBudget !== undefined ? energyBudget : availableEnergy,
      timestamp: Game.time,
      taskType,
      taskCount,
      reason
    };

    this.productionQueue.push(need);
    // console.log(`[addProductionNeed] 添加生产需求: ${role} (房间: ${roomName}, 优先级: ${priority}, 原因: ${reason})`);
  }

  /**
   * 执行生产
   */
  public executeProduction(): void {
    if (this.productionQueue.length === 0) {
      return;
    }

    // console.log(`[executeProduction] 生产队列长度: ${this.productionQueue.length}`);

    // 按优先级排序
    this.productionQueue.sort((a, b) => b.priority - a.priority);

    // 处理队列中的第一个需求
    const need = this.productionQueue[0];
    const room = Game.rooms[need.roomName];

    // console.log(`[executeProduction] 处理生产需求: ${need.role} (房间: ${need.roomName}, 优先级: ${need.priority})`);

    if (!room) {
      // console.log(`[executeProduction] 房间不存在: ${need.roomName}`);
      this.productionQueue.shift();
      return;
    }

    // 最终数量检查 - 确保不超过限制
    const controllerLevel = room.controller?.level || 1;
    const currentRoleCount = this.getCreepCountInRoom(need.roomName, need.role);
    const totalCreepsInRoom = this.getCreepCountInRoom(need.roomName);

    // 检查是否仍然需要生产这个角色
    if (!GameConfig.canProduceMoreCreeps(controllerLevel, need.role, currentRoleCount, totalCreepsInRoom)) {
      // console.log(`[executeProduction] 角色 ${need.role} 已达到限制，跳过生产 (当前: ${currentRoleCount}, 总数: ${totalCreepsInRoom})`);
      this.productionQueue.shift();
      return;
    }

    const spawns = room.find(FIND_MY_SPAWNS);
    if (spawns.length === 0) {
      // console.log(`[executeProduction] 房间 ${need.roomName} 没有spawn`);
      return;
    }

    const spawn = spawns[0];

    if (spawn.spawning) {
      // console.log(`[executeProduction] spawn正在生产: ${spawn.spawning.name}`);
      return;
    }

    // 生成身体配置
    const body = BodyBuilder.generateOptimalBody(
      need.role,
      need.energyBudget !== undefined ? need.energyBudget : room.energyAvailable,
      GameConfig.THRESHOLDS.MAX_CREEP_BODY_SIZE,
      room
    );

    const cost = BodyBuilder.getBodyCost(body);
    // console.log(`[executeProduction] 生成身体配置: ${JSON.stringify(body)}, 成本: ${cost}`);

    // 检查是否有足够能量
    if (room.energyAvailable < cost) {
      // console.log(`[executeProduction] 能量不足: 需要${cost}, 当前${room.energyAvailable}`);
      return;
    }

    // 生成creep名称
    const creepName = this.generateCreepName(need.role);

    // console.log(`[executeProduction] 开始生产: ${creepName} (${need.role})`);

    // 尝试生产creep
    const result = spawn.spawnCreep(body, creepName, {
      memory: { role: need.role, state: 'idle', room: need.roomName, working: false }
    });

    if (result === OK) {
      // console.log(`[executeProduction] 成功生产: ${creepName}`);
      this.productionQueue.shift();

      // 发送事件
      this.emit(GameConfig.EVENTS.CREEP_SPAWNED, {
        creepName,
        role: need.role,
        roomName: need.roomName,
        cost
      });
    } else {
      // console.log(`[executeProduction] 生产失败: ${creepName}, 错误: ${result}`);
      // 生产失败时不移除队列项，下次再试
    }
  }

  /**
   * 处理房间受到攻击时的生产需求
   */
  public handleRoomUnderAttack(roomName: string, hostileCount: number): void {
    // console.log(`🛡️ [CreepProductionService] 房间 ${roomName} 受到攻击! 敌对单位: ${hostileCount}个`);

    const room = Game.rooms[roomName];
    if (!room || !room.controller?.my) {
      return;
    }

    // 检查当前shooter数量
    const controllerLevel = room.controller.level || 1;
    const currentShooterCount = this.getCreepCountInRoom(roomName, GameConfig.ROLES.SHOOTER);
    const totalCreepsInRoom = this.getCreepCountInRoom(roomName);

    // console.log(`🛡️ [CreepProductionService] 房间 ${roomName} 当前shooter数量: ${currentShooterCount}`);

    // 检查是否可以生产更多shooter
    if (GameConfig.canProduceMoreCreeps(controllerLevel, GameConfig.ROLES.SHOOTER, currentShooterCount, totalCreepsInRoom)) {
      const availableEnergy = room.energyAvailable;
      if (availableEnergy >= GameConfig.THRESHOLDS.MIN_ENERGY_FOR_SHOOTER) {
        // console.log(`🛡️ [CreepProductionService] 添加紧急shooter生产需求`);
        this.addProductionNeed(
          roomName,
          GameConfig.ROLES.SHOOTER,
          GameConfig.PRIORITIES.HIGH,
          availableEnergy,
          undefined,
          TaskType.ATTACK,
          hostileCount,
          `Emergency defense: ${hostileCount} hostiles`
        );
      } else {
        // console.log(`🛡️ [CreepProductionService] 能量不足，无法生产shooter (需要: ${GameConfig.THRESHOLDS.MIN_ENERGY_FOR_SHOOTER}, 当前: ${availableEnergy})`);
      }
    } else {
      // console.log(`🛡️ [CreepProductionService] shooter数量已达上限，无法生产更多`);
    }
  }

  /**
   * 获取生产队列（从Memory中获取）
   */
  private get productionQueue(): ProductionNeed[] {
    if (!Memory.creepProduction) {
      Memory.creepProduction = {
        queue: [],
        lastProduction: Game.time,
        energyBudget: 0
      };
    }
    return Memory.creepProduction.queue;
  }

  /**
   * 设置生产队列（保存到Memory中）
   */
  private set productionQueue(queue: ProductionNeed[]) {
    if (!Memory.creepProduction) {
      Memory.creepProduction = {
        queue: [],
        lastProduction: Game.time,
        energyBudget: 0
      };
    }
    Memory.creepProduction.queue = queue;
  }

  /**
   * 获取生产队列（公共接口）
   */
  public getProductionQueue(): ProductionNeed[] {
    return [...this.productionQueue];
  }

  /**
   * 重置时的清理工作
   */
  public onReset(): void {
    this.productionQueue = [];
    this.lastProductionCheck = 0;
    this.lastTaskAnalysis = 0;
  }

  /**
   * 清理重复的生产需求
   */
  private cleanupDuplicateProductionNeeds(): void {
    const uniqueNeeds = new Map<string, ProductionNeed>();

    // 遍历生产队列，保留每个房间-角色组合的最高优先级需求
    for (const need of this.productionQueue) {
      const key = `${need.roomName}-${need.role}`;

      if (!uniqueNeeds.has(key)) {
        uniqueNeeds.set(key, need);
      } else {
        // 如果已存在相同的需求，比较优先级，保留优先级更高的
        const existingNeed = uniqueNeeds.get(key)!;
        if (need.priority > existingNeed.priority) {
          uniqueNeeds.set(key, need);
        }
      }
    }

    const originalLength = this.productionQueue.length;
    this.productionQueue = Array.from(uniqueNeeds.values());

    if (originalLength > this.productionQueue.length) {
      // console.log(`[cleanupDuplicateProductionNeeds] 清理重复需求: ${originalLength} -> ${this.productionQueue.length}`);
    }
  }

  /**
   * 移除已完成的需求或不再需要的需求
   */
  private removeCompletedNeeds(): void {
    const originalLength = this.productionQueue.length;

    this.productionQueue = this.productionQueue.filter(need => {
      const room = Game.rooms[need.roomName];
      if (!room || !room.controller?.my) {
        // 房间不存在或不再属于我们，移除需求
        return false;
      }

      // 检查是否仍然需要这个角色
      const controllerLevel = room.controller.level || 1;
      const currentRoleCount = this.getCreepCountInRoom(need.roomName, need.role);
      const totalCreepsInRoom = this.getCreepCountInRoom(need.roomName);

      // 如果已经达到最大值，移除需求
      if (!GameConfig.canProduceMoreCreeps(controllerLevel, need.role, currentRoleCount, totalCreepsInRoom)) {
        return false;
      }

      // 检查需求是否过期
      if (need.timestamp && Game.time - need.timestamp > GameConfig.TIMEOUTS.PRODUCTION_NEED_EXPIRY) {
        return false;
      }

      return true;
    });

    if (originalLength > this.productionQueue.length) {
      // console.log(`[removeCompletedNeeds] 清理需求: ${originalLength} -> ${this.productionQueue.length}`);
    }
  }

  /**
   * 获取房间内指定角色的creep数量（统一的统计方法）
   */
  private getCreepCountInRoom(roomName: string, role?: string): number {
    return Object.values(Game.creeps).filter(creep => {
      // 检查creep是否属于这个房间（优先使用memory.room，回退到当前位置）
      const creepRoom = creep.memory.room || creep.room.name;
      if (creepRoom !== roomName) {
        return false;
      }

      // 如果指定了角色，检查角色匹配
      if (role && creep.memory.role !== role) {
        return false;
      }

      return true;
    }).length;
  }

  /**
   * 获取房间内所有角色的数量统计
   */
  private getRoleCountsInRoom(roomName: string): { [role: string]: number } {
    const roleCounts: { [role: string]: number } = {};

    Object.values(Game.creeps).forEach(creep => {
      // 检查creep是否属于这个房间
      const creepRoom = creep.memory.room || creep.room.name;
      if (creepRoom === roomName) {
        const role = creep.memory.role;
        roleCounts[role] = (roleCounts[role] || 0) + 1;
      }
    });

    return roleCounts;
  }

  /**
   * 生成creep名称
   */
  private generateCreepName(role: string): string {
    const timestamp = Game.time;
    const randomSuffix = Math.floor(Math.random() * 1000);
    return `${role}_${timestamp}_${randomSuffix}`;
  }

  /**
   * 获取正在执行特定任务类型的指定角色creep数量
   */
  private getCreepsAssignedToTaskType(roomName: string, role: string, taskType: TaskType): number {
    if (!Memory.tasks || !Memory.tasks.creepTasks) return 0;

    let count = 0;
    for (const creepName in Memory.tasks.creepTasks) {
      const creep = Game.creeps[creepName];
      if (!creep) continue;

      // 检查房间和角色
      const creepRoom = creep.memory.room || creep.room.name;
      if (creepRoom !== roomName || creep.memory.role !== role) continue;

      // 检查任务类型
      const taskId = Memory.tasks.creepTasks[creepName];
      const task = Memory.tasks.taskQueue.find(t => t.id === taskId);
      if (task && task.type === taskType) {
        count++;
      }
    }

    return count;
  }

  /**
   * 获取指定角色的空闲creep数量
   */
  private getAvailableCreepsOfRole(roomName: string, role: string): number {
    let count = 0;
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName];
      if (creep.spawning) continue;

      // 检查房间和角色
      const creepRoom = creep.memory.room || creep.room.name;
      if (creepRoom !== roomName || creep.memory.role !== role) continue;

      // 检查是否有任务分配
      const hasTask = Memory.tasks && Memory.tasks.creepTasks && Memory.tasks.creepTasks[creepName];
      if (!hasTask) {
        count++;
      }
    }

    return count;
  }

  /**
   * 调试生产需求计算
   */
  public debugProductionCalculation(roomName?: string): void {
    console.log("=== 生产需求计算调试报告 ===");
    console.log(`当前 Tick: ${Game.time}`);
    console.log("");

    const rooms = roomName ? [roomName] : Object.keys(Game.rooms);

    for (const room of rooms) {
      if (!Game.rooms[room] || !Game.rooms[room].controller?.my) continue;

      console.log(`🏢 房间: ${room} (RCL ${Game.rooms[room].controller?.level || 1})`);
      const tasks = this.getPendingTasks().filter(task => task.roomName === room);

      console.log(`  📋 获取pending任务:`);
      console.log(`    总任务数: ${Memory.tasks?.taskQueue.length || 0}, pending任务数: ${tasks.length}`);

      if (tasks.length > 0) {
        const tasksByType = this.groupTasksByType(tasks);
        console.log(`    按类型分组:`);
        for (const [taskType, taskList] of tasksByType) {
          console.log(`      ${taskType}: ${taskList.length} 个`);
        }

        console.log(`  👥 当前角色数量:`);
        const currentRoleCounts = this.getRoleCountsInRoom(room);
        const controllerLevel = Game.rooms[room].controller?.level || 1;
        const roomRoleConfig = GameConfig.getRoomRoleConfig(controllerLevel);
        for (const role of Object.keys(currentRoleCounts)) {
          const maxAllowed = this.getRoleLimit(controllerLevel, role);
          const roleConfig = roomRoleConfig[role];
          const configStr = roleConfig ? `${roleConfig.min}-${maxAllowed}` : 'N/A';
          console.log(`    ${role}: ${currentRoleCounts[role]} (配置: ${configStr})`);
        }

        console.log(`  🧮 需求计算过程:`);
        for (const [taskType, taskList] of tasksByType) {
          console.log(`    任务类型: ${taskType} (${taskList.length} 个任务)`);
          const roles = TaskRoleMapping.getRolesForTask(taskType);

          for (const role of roles) {
            const totalCount = currentRoleCounts[role] || 0;
            const maxAllowed = this.getRoleLimit(controllerLevel, role);
            const busyCount = this.getCreepsAssignedToTaskType(room, role, taskType);
            const availableCount = this.getAvailableCreepsOfRole(room, role);
            const neededCount = this.calculateNeededCount(taskList, role, busyCount, availableCount);

            console.log(`      ${role}: 总数${totalCount}, 忙于此类任务${busyCount}, 空闲${availableCount}, 需要${neededCount}, 上限${maxAllowed}`);

            const effectiveAvailable = busyCount + availableCount;
            const shouldProduce = neededCount > effectiveAvailable && totalCount < maxAllowed;

            console.log(`        条件检查: ${neededCount} > ${effectiveAvailable} && ${totalCount} < ${maxAllowed} = ${shouldProduce}`);

            if (shouldProduce) {
              console.log(`        ✅ 应该产生生产需求！`);
            } else {
              console.log(`        ❌ 不会产生生产需求`);
              if (neededCount <= effectiveAvailable) {
                console.log(`          原因: 需要${neededCount}个，可用${effectiveAvailable}个`);
              }
              if (totalCount >= maxAllowed) {
                console.log(`          原因: 已达到数量上限`);
              }
            }
          }
        }
      }

      console.log(`  🏭 实际生产队列:`);
      const roomQueue = this.productionQueue.filter(need => need.roomName === room);
      if (roomQueue.length === 0) {
        console.log(`    ✅ 生产队列为空`);
      } else {
        for (const need of roomQueue) {
          console.log(`    📦 ${need.role} (优先级: ${need.priority}, 原因: ${need.reason})`);
        }
      }
      console.log("");
    }
    console.log("=== 调试报告结束 ===");
  }
}
