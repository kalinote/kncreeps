import { assert } from 'chai';
import { SourceAnalyzer } from '../../src/utils/SourceAnalyzer';

describe('SourceAnalyzer', () => {
  // 模拟Room和Source对象
  const mockRoom = {
    name: 'W1N1',
    find: (type: any) => {
      if (type === FIND_SOURCES) {
        return [
          { id: 'source1', pos: { x: 10, y: 10 } },
          { id: 'source2', pos: { x: 40, y: 40 } }
        ];
      }
      return [];
    },
    lookForAt: (type: any, pos: any) => {
      // 模拟没有建筑阻挡
      return [];
    },
    getTerrain: () => ({
      get: (x: number, y: number) => {
        // 模拟平原地形
        return 0;
      }
    })
  } as any;

  const mockSource = {
    id: 'source1',
    pos: { x: 10, y: 10 },
    room: mockRoom
  } as any;

  beforeEach(() => {
    // 模拟Game.rooms
    (global as any).Game = {
      rooms: {
        'W1N1': mockRoom
      }
    };
  });

  describe('getHarvestPositions', () => {
    it('应该返回source周围的可采集位置', () => {
      const positions = SourceAnalyzer.getHarvestPositions(mockSource);

            // 一个source周围应该有8个位置（减去source本身）
      assert.isAbove(positions.length, 0);
      assert.isAtMost(positions.length, 8);

      // 检查所有位置都在source周围
      positions.forEach(pos => {
        const dx = Math.abs(pos.x - mockSource.pos.x);
        const dy = Math.abs(pos.y - mockSource.pos.y);
        assert.isAtMost(dx, 1);
        assert.isAtMost(dy, 1);
        assert.isAbove(dx + dy, 0); // 不能是source本身的位置
      });
    });
  });

  describe('getHarvestPositionCount', () => {
        it('应该返回可采集位置的数量', () => {
      const count = SourceAnalyzer.getHarvestPositionCount(mockSource);
      assert.isAtLeast(count, 0);
      assert.isAtMost(count, 8);
    });
  });

  describe('hasHarvestPositions', () => {
    it('应该正确判断是否有可采集位置', () => {
      const hasPositions = SourceAnalyzer.hasHarvestPositions(mockSource);
      assert.isTrue(typeof hasPositions === 'boolean');
    });
  });

  describe('getRoomSourceStats', () => {
    it('应该返回房间的source统计信息', () => {
      const stats = SourceAnalyzer.getRoomSourceStats(mockRoom);

      assert.property(stats, 'totalSources');
      assert.property(stats, 'totalHarvestPositions');
      assert.property(stats, 'sourceDetails');

      assert.equal(stats.totalSources, 2);
      assert.isAbove(stats.totalHarvestPositions, 0);
      assert.lengthOf(stats.sourceDetails, 2);

      stats.sourceDetails.forEach(detail => {
        assert.property(detail, 'sourceId');
        assert.property(detail, 'positionCount');
        assert.property(detail, 'positions');
        assert.isAtLeast(detail.positionCount, 0);
        assert.isAtMost(detail.positionCount, 8);
      });
    });
  });
});
