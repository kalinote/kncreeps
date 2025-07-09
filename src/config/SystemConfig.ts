/**
 * 系统相关配置
 */
export class SystemConfig {
  // 系统配置
  public static readonly SYSTEM = {
    CREEP_LIFETIME: 1500,
    ERROR_RECOVERY_ATTEMPTS: 3,
    MAX_CONSTRUCTION_SITES: 5,
    MAX_REPAIR_TARGETS: 3
  } as const;

  // 更新频率（ticks）
  public static readonly UPDATE_FREQUENCIES = {
    CREEP_PRODUCTION: 5,
    ROOM_ANALYSIS: 10,
    INTELLIGENCE_GATHERING: 20,
    LONG_TERM_PLANNING: 100,
    CLEANUP: 50,
    SYSTEM_CLEANUP: 100,    // 系统清理频率
    STATS_UPDATE: 20,       // 统计更新频率
    COORDINATION_CHECK: 50, // 协调检查频率
    THREAT_CHECK: 10        // 威胁检查频率
  } as const;

  // 超时和过期时间（ticks）
  public static readonly TIMEOUTS = {
    PRODUCTION_NEED_EXPIRY: 100,    // 生产需求过期时间
    PERFORMANCE_DATA_EXPIRY: 1000,   // 性能数据过期时间
    ERROR_COUNT_RESET: 100,          // 错误计数重置阈值
    THREAT_PERSISTENT_REPORT: 50     // 持续威胁报告间隔
  } as const;

  // 房间发展阶段
  public static readonly ROOM_PHASES = {
    BOOTSTRAP: 'bootstrap',
    GROWTH: 'growth',
    MATURE: 'mature',
    EXPANSION: 'expansion'
  } as const;
}
