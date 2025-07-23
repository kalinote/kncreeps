/**
 * 建筑规划模块的配置
 */
export const ConstructionConfig = {
  /**
   * 规划延迟（ticks）
   * 在房间被控制后，延迟多少个tick开始执行自动规划，以避开CPU高峰。
   */
  PLANNING_DELAY: 25,

  /**
   * 定义【计算蓝图】的逻辑顺序
   * ConstructionManager 将会按照这个数组中定义的规划器名称来分步执行规划。
   */
  PLANNING_ORDER: [
    'extension',
    'container',
    'road',
    // 'tower',
    // ...
  ],

  /**
   * 定义【建造工地】的战略优先级顺序
   * 当蓝图规划完成后，ConstructionManager 会按照这个顺序来决定优先建造什么。
   */
  BUILD_PRIORITY_ORDER: [
    // 'spawn',
    // 'tower',
    'extension',
    'container',
    'road'
  ],

  /**
   * 定义建筑之间的依赖关系
   * key: 建筑类型, value: 依赖的前置建筑类型
   * 例如：{ 'extension': 'road' } 表示建造 extension 前必须先完成所有 road 的建造。
   */
  CONSTRUCTION_DEPS: {},

  /**
   * 定义紧急情况应对策略
   */
  EMERGENCY_STRATEGIES: {
    UNDER_ATTACK: {
      name: 'Under Attack Defense',
      // 当受攻击时，优先规划并建造这些建筑
      priorityPlanners: ['tower', 'rampart'],
      // 是否需要立即触发一次快速规划
      triggerPlanner: true
    }
  }
};
