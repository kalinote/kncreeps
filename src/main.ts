import { ErrorMapper } from "utils/ErrorMapper";
import { GameEngine } from "core/GameEngine";

// 导入类型定义
import "./types";

// 游戏引擎实例 - 只在模块加载时创建一次
const gameEngine = new GameEngine();
console.log(`游戏引擎已初始化 - 模块加载时`);

// 当将TS编译为JS并使用rollup打包时，错误消息中的行号和文件名会发生变化
// 此实用工具使用源映射来获取原始TS源代码的行号和文件名
export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`当前游戏tick是 ${Game.time}`);

  // 自动删除缺失creep的内存（现在由StateManager处理，但保留作为备用）
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }

  // 运行游戏引擎
  gameEngine.run();
});
