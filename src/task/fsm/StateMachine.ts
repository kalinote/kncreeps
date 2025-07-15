import { ServiceContainer } from "../../core/ServiceContainer";
import { TaskFSMMemory, StateHandlers } from "../../types";

/**
 * 任务状态机基类
 * 负责管理任务的状态转换和内存持久化
 */
export abstract class TaskStateMachine<TState extends string> {
  protected memory: TaskFSMMemory<TState>;
  protected serviceContainer: ServiceContainer;

  constructor(memory: TaskFSMMemory<TState>, serviceContainer: ServiceContainer) {
    this.memory = memory;
    this.serviceContainer = serviceContainer;
  }

  /**
   * 每 tick 调用一次，执行当前状态的处理器
   * 由 TaskExecutionService 调用
   */
  public tick(creep: Creep): void {
    console.log(`[TaskStateMachine] creep: ${creep.name} 当前执行状态机: ${this.memory.currentState}`);
    const handlers = this.handlers();
    const currentState = this.memory.currentState;
    const handler = handlers[currentState];

    if (!handler) {
      console.log(`[TaskStateMachine] 未找到状态处理器: ${currentState}`);
      return;
    }

    try {
      const nextState = handler(creep);

      // 如果处理器返回了新状态，则进行状态转换
      if (nextState && nextState !== currentState) {
        this.memory.currentState = nextState;
        console.log(`[TaskStateMachine] creep: ${creep.name} 状态转换: ${currentState} -> ${nextState}`);
      }
    } catch (error) {
      console.log(`[TaskStateMachine] 状态处理器执行错误: ${currentState}`, error);
    }
  }

  /**
   * 获取当前状态
   */
  public getCurrentState(): TState {
    return this.memory.currentState;
  }

  /**
   * 设置当前状态
   */
  public setCurrentState(state: TState): void {
    this.memory.currentState = state;
  }

  /**
   * 获取任务内存
   */
  public getMemory(): TaskFSMMemory<TState> {
    return this.memory;
  }

  /**
   * 检查任务是否完成
   */
  public isFinished(): boolean {
    return this.memory.currentState === this.getFinishedState();
  }

  /**
   * 检查任务是否可中断
   */
  public isInterruptible(): boolean {
    return this.memory.interruptible;
  }

  /**
   * 设置中断标记
   */
  public setInterruptible(interruptible: boolean): void {
    this.memory.interruptible = interruptible;
  }

  /**
   * 获取上下文
   */
  public getContext(): Record<string, any> | undefined {
    return this.memory.context;
  }

  /**
   * 设置上下文
   */
  public setContext(context: Record<string, any>): void {
    this.memory.context = context;
  }

  /**
   * 获取组ID
   */
  public getGroupId(): string | undefined {
    return this.memory.groupId;
  }

  /**
   * 设置组ID
   */
  public setGroupId(groupId: string): void {
    this.memory.groupId = groupId;
  }

  /**
   * 子类必须实现：返回状态处理器映射
   */
  protected abstract handlers(): StateHandlers<TState>;

  /**
   * 子类必须实现：返回完成状态
   */
  protected abstract getFinishedState(): TState;
}
