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
    CLEANUP: 50
  } as const;

  // 房间发展阶段
  public static readonly ROOM_PHASES = {
    BOOTSTRAP: 'bootstrap',
    GROWTH: 'growth',
    MATURE: 'mature',
    EXPANSION: 'expansion'
  } as const;
}
