import { RoleConfig } from "./RoleConfig";

/**
 * 阈值相关配置
 */
export class ThresholdConfig {
  // 阈值配置
  public static readonly THRESHOLDS = {
    ENERGY_RESERVE: 200,
    CREEP_REPLACEMENT_THRESHOLD: 0.3,
    ROOM_EXPANSION_THRESHOLD: 0.8,
    MAX_CREEP_BODY_SIZE: 50,
    MIN_CREEP_BODY_SIZE: 3,
    EMERGENCY_ENERGY_LEVEL: 100,

    // 修复阈值
    REPAIR_THRESHOLD: 0.8, // 建筑物血量低于80%时需要修复
    EMERGENCY_REPAIR_THRESHOLD: 0.5, // 紧急修复阈值

    // 能量门槛
    MIN_ENERGY_FOR_TRANSPORT: 100,
    MIN_ENERGY_FOR_WORKER: 250,
    MIN_ENERGY_FOR_SECOND_WORKER: 300,
    MIN_ENERGY_FOR_SHOOTER: 300, // 战斗单位最小能量需求

    // 替换时间门槛
    CREEP_REPLACEMENT_TIME: 300, // creep剩余生命值低于300时需要替换

    // 效率和模式切换阈值
    EFFICIENCY_PENALTY_NO_MOVE: 0.5,
    EFFICIENCY_PENALTY_NO_TOOL: 0.3,
    HARVESTER_PROFESSIONAL_MODE_THRESHOLD: 1, // 搬运工数量达到1时切换专业模式

    // 防御相关阈值
    DEFENDER_PATROL_RANGE: 5, // 防御者巡逻范围
    DEFENDER_ENGAGEMENT_RANGE: 3, // 防御者交战范围
    DEFENDER_RETREAT_HEALTH: 0.3, // 防御者撤退血量比例
    ENEMY_MEMORY_DURATION: 50, // 敌人记忆持续时间（ticks）

    // 预算配置
    BODY_BUDGET_RATIO: 0.8, // 身体预算占房间总能量的比例

    // Spawn能量保留配置（按RCL等级）
    SPAWN_ENERGY_RESERVE_BY_RCL: {
      1: 200,  // RCL1: 保留200能量（可生成基础worker和transporter）
      2: 250,  // RCL2: 保留250能量
      3: 300,  // RCL3: 保留300能量
      4: 350,  // RCL4: 保留350能量
      5: 400,  // RCL5: 保留400能量
      6: 450,  // RCL6: 保留450能量
      7: 500,  // RCL7: 保留500能量
      8: 550   // RCL8: 保留550能量
    },

    // 紧急情况下的最小保留能量
    SPAWN_EMERGENCY_RESERVE: 150,

    // 当房间没有基础creep时的严格保留
    SPAWN_CRITICAL_RESERVE: 100,
  } as const;

  /**
   * 获取spawn应该保留的能量数量
   */
  public static getSpawnEnergyReserve(roomLevel: number, roomState: 'normal' | 'emergency' | 'critical' = 'normal'): number {
    if (roomState === 'critical') {
      return ThresholdConfig.THRESHOLDS.SPAWN_CRITICAL_RESERVE;
    }

    if (roomState === 'emergency') {
      return ThresholdConfig.THRESHOLDS.SPAWN_EMERGENCY_RESERVE;
    }

    const reserves = ThresholdConfig.THRESHOLDS.SPAWN_ENERGY_RESERVE_BY_RCL;
    return reserves[roomLevel as keyof typeof reserves] || reserves[1];
  }

  /**
   * 检查spawn是否有足够的保留能量供非关键角色使用
   */
  public static canUseSpawnEnergy(room: Room, requestingRole: string): boolean {
    const spawns = room.find(FIND_MY_STRUCTURES, {
      filter: (s) => s.structureType === STRUCTURE_SPAWN
    }) as StructureSpawn[];

    if (spawns.length === 0) {
      console.log(`[canUseSpawnEnergy] 房间 ${room.name} 没有spawn`);
      return false;
    }

    const roomLevel = room.controller?.level || 1;
    const spawn = spawns[0];
    const spawnEnergy = spawn.store.getUsedCapacity(RESOURCE_ENERGY);
    const spawnCapacity = spawn.store.getCapacity(RESOURCE_ENERGY);

    // 检查房间状态
    const roomState = ThresholdConfig.assessRoomEnergyState(room);
    const reserveAmount = ThresholdConfig.getSpawnEnergyReserve(roomLevel, roomState);

    console.log(`[canUseSpawnEnergy] 角色: ${requestingRole}, 房间状态: ${roomState}, RCL: ${roomLevel}, spawn能量: ${spawnEnergy}/${spawnCapacity}, 保留阈值: ${reserveAmount}`);

    // 特殊情况：当spawn满能量时，允许所有角色获取能量
    if (spawnEnergy >= spawnCapacity) {
      console.log(`[canUseSpawnEnergy] spawn满能量，允许所有角色获取`);
      return true;
    }

    // 关键角色（worker, transporter）可以使用更多能量
    if (requestingRole === RoleConfig.ROLES.WORKER ||
        requestingRole === RoleConfig.ROLES.TRANSPORTER) {
      const canUse = spawnEnergy > ThresholdConfig.THRESHOLDS.SPAWN_CRITICAL_RESERVE;
      console.log(`[canUseSpawnEnergy] 关键角色，需要 > ${ThresholdConfig.THRESHOLDS.SPAWN_CRITICAL_RESERVE}，结果: ${canUse}`);
      return canUse;
    }

    // 非关键角色需要更多保留
    const canUse = spawnEnergy > reserveAmount;
    console.log(`[canUseSpawnEnergy] 非关键角色，需要 > ${reserveAmount}，结果: ${canUse}`);
    return canUse;
  }

  /**
   * 评估房间能量状态
   */
  public static assessRoomEnergyState(room: Room): 'normal' | 'emergency' | 'critical' {
    const creeps = Object.values(Game.creeps).filter(c => c.room.name === room.name);
    const workerCount = creeps.filter(c => c.memory.role === RoleConfig.ROLES.WORKER).length;
    const transporterCount = creeps.filter(c => c.memory.role === RoleConfig.ROLES.TRANSPORTER).length;
    const roomLevel = room.controller?.level || 1;

    console.log(`[assessRoomEnergyState] 房间 ${room.name}, RCL: ${roomLevel}, worker: ${workerCount}, transporter: ${transporterCount}`);

    // 关键状态：缺少基础creep
    if (workerCount === 0 || (roomLevel >= 2 && transporterCount === 0)) {
      console.log(`[assessRoomEnergyState] 房间状态: critical (缺少基础creep)`);
      return 'critical';
    }

    // 紧急状态：基础creep数量不足
    if (workerCount === 1 && transporterCount === 0) {
      console.log(`[assessRoomEnergyState] 房间状态: emergency (基础creep数量不足)`);
      return 'emergency';
    }

    console.log(`[assessRoomEnergyState] 房间状态: normal`);
    return 'normal';
  }
}
