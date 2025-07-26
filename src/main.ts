import { ErrorMapper } from "utils/ErrorMapper";
import { GameEngine } from "core/GameEngine";
import { GameConfig } from "config/GameConfig";
import { TaskStatus, TaskType, ProductionNeed } from "./types";
import { MapSpatialAnalyzer } from "./utils/MapSpatialAnalyzer";

// 导入类型定义
import "./types";

// 游戏引擎实例 - 只在模块加载时创建一次
// const gameEngine = new GameEngine();
console.log(`游戏引擎已创建 - Tick: ${Game.time}`);

declare var WebAssembly: any;

// 当将TS编译为JS并使用rollup打包时，错误消息中的行号和文件名会发生变化
// 此实用工具使用源映射来获取原始TS源代码的行号和文件名
export const loop = ErrorMapper.wrapLoop(async () => {
  // 运行游戏引擎
  // gameEngine.run();

  // 仅测试
  const { bestLocation, candidates } = MapSpatialAnalyzer.analyze("sim");
  if (bestLocation) {
    const visual = new RoomVisual("sim");
    console.log("找到的最佳位置信息:");
    console.log(`- 坐标: { r: ${bestLocation.coord.r}, c: ${bestLocation.coord.c} }`);
    console.log(`- 最终得分: ${bestLocation.score.toFixed(3)}`);
    console.log(`  - 开阔度 (距离值): ${bestLocation.openness.toFixed(2)}`);
    console.log(`  - 估算面积: ${bestLocation.area}`);
    console.log(`  - 中心性 (0-1): ${bestLocation.centrality.toFixed(2)}`);

    console.log("\n所有候选空间 (按得分排序):");
    candidates.forEach((cand, i) => {
      console.log(`${i + 1}. 中心点坐标: (${cand.coord.r},${cand.coord.c}), 得分: ${cand.score.toFixed(2)}, 估算面积: ${cand.area}, 开阔度: ${cand.openness.toFixed(2)}`);
      visual.circle(cand.coord.r, cand.coord.c, {
        fill: i === 0 ? "red" : "blue",
        radius: 0.5
      });
      visual.text(i === 0 ? "最佳位置" : `候选坐标[${i + 1}]`, cand.coord.r, cand.coord.c + 1);
    });

  } else {
    console.log("在地图上未找到有效位置。");
  }
});
