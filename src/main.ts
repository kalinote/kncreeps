import { ErrorMapper } from "utils/ErrorMapper";
import { GameEngine } from "core/GameEngine";
import { MapSpatialAnalyzer } from "./utils/MapSpatialAnalyzer";

// 导入类型定义
import "./types";

// 游戏引擎实例 - 只在模块加载时创建一次
const gameEngine = new GameEngine();
console.log(`游戏引擎已创建 - Tick: ${Game.time}`);

// 当将TS编译为JS并使用rollup打包时，错误消息中的行号和文件名会发生变化
// 此实用工具使用源映射来获取原始TS源代码的行号和文件名
export const loop = ErrorMapper.wrapLoop(async () => {
  // 运行游戏引擎
  gameEngine.run();
});
