/**
 * 建筑规划模块的配置
 */
export const ConstructionConfig = {
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
  ] as BuildableStructureConstant[],
};
