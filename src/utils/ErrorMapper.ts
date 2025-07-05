import { SourceMapConsumer } from "source-map";

export class ErrorMapper {
  // 缓存消费者
  private static _consumer?: SourceMapConsumer;

  public static get consumer(): SourceMapConsumer {
    if (this._consumer == null) {
      this._consumer = new SourceMapConsumer(require("main.js.map"));
    }

    return this._consumer;
  }

  // 缓存之前映射的跟踪以提高性能
  public static cache: { [key: string]: string } = {};

  /**
   * 使用源映射生成原始符号名称的堆栈跟踪。
   *
   * 警告 - 重置后第一次调用的CPU成本极高 - >30 CPU！谨慎使用！
   * （重置后的连续调用更合理，约0.1 CPU/次）
   *
   * @param {Error | string} error 错误或原始堆栈跟踪
   * @returns {string} 源映射的堆栈跟踪
   */
  public static sourceMappedStackTrace(error: Error | string): string {
    const stack: string = error instanceof Error ? (error.stack as string) : error;
    if (Object.prototype.hasOwnProperty.call(this.cache, stack)) {
      return this.cache[stack];
    }

    // eslint-disable-next-line no-useless-escape
    const re = /^\s+at\s+(.+?\s+)?\(?([0-z._\-\\\/]+):(\d+):(\d+)\)?$/gm;
    let match: RegExpExecArray | null;
    let outStack = error.toString();

    while ((match = re.exec(stack))) {
      if (match[2] === "main") {
        const pos = this.consumer.originalPositionFor({
          column: parseInt(match[4], 10),
          line: parseInt(match[3], 10)
        });

        if (pos.line != null) {
          if (pos.name) {
            outStack += `\n    at ${pos.name} (${pos.source}:${pos.line}:${pos.column})`;
          } else {
            if (match[1]) {
              // 不知道原始源文件名 - 使用给定跟踪中的文件名
              outStack += `\n    at ${match[1]} (${pos.source}:${pos.line}:${pos.column})`;
            } else {
              // 不知道原始源文件名或在给定跟踪中 - 省略名称
              outStack += `\n    at ${pos.source}:${pos.line}:${pos.column}`;
            }
          }
        } else {
          // 没有已知位置
          break;
        }
      } else {
        // 没有更多可解析的行
        break;
      }
    }

    this.cache[stack] = outStack;
    return outStack;
  }

  public static wrapLoop(loop: () => void): () => void {
    return () => {
      try {
        loop();
      } catch (e) {
        if (e instanceof Error) {
          if ("sim" in Game.rooms) {
            const message = `源映射在模拟器中不起作用 - 显示原始错误`;
            console.log(`<span style='color:red'>${message}<br>${_.escape(e.stack)}</span>`);
          } else {
            console.log(`<span style='color:red'>${_.escape(this.sourceMappedStackTrace(e))}</span>`);
          }
        } else {
          // 无法处理
          throw e;
        }
      }
    };
  }
}
