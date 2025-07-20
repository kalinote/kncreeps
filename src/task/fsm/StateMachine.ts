import { TaskManager } from "../../managers/TaskManager";
import { ServiceContainer } from "../../core/ServiceContainer";
import { TaskFSMMemory, StateHandlers, CreepFSMState, Task, TaskType } from "../../types";
import { CreepMoveService } from "../../services/CreepMoveService";

/**
 * 任务状态机基类
 * 负责管理任务的状态转换和内存持久化
 */
export abstract class TaskStateMachine<TState extends string> {
  protected moveService: CreepMoveService;
  protected taskMemory: TaskFSMMemory<TState>;
  protected creepState: CreepFSMState<TState>;
  protected serviceContainer: ServiceContainer;
  protected creep: Creep;

  constructor(taskMemory: TaskFSMMemory<TState>, creep: Creep, serviceContainer: ServiceContainer) {
    this.taskMemory = taskMemory;
    this.creep = creep;
    this.serviceContainer = serviceContainer;
    this.moveService = this.serviceContainer.get('creepMoveService');

    // 获取或初始化该creep的执行状态
    if (!taskMemory.creepStates[creep.name]) {
      taskMemory.creepStates[creep.name] = {
        currentState: this.getInitialState(),
        interruptible: true,
        context: {}
      };
    }
    this.creepState = taskMemory.creepStates[creep.name];
  }

  /**
   * 每 tick 调用一次，执行当前状态的处理器
   * 由 TaskExecutionService 调用
   */
  public tick(): void {
    // console.log(`[TaskStateMachine] creep: ${this.creep.name} 当前执行状态机: ${this.creepState.currentState}`);
    const handlers = this.handlers();
    const currentState = this.creepState.currentState;
    const handler = handlers[currentState];

    if (!handler) {
      console.log(`[TaskStateMachine] 未找到状态处理器: ${currentState}`);
      return;
    }

    try {
      const nextState = handler(this.creep);

      // 如果处理器返回了新状态，则进行状态转换
      if (nextState && nextState !== currentState) {
        this.creepState.currentState = nextState;
        // console.log(`[TaskStateMachine] creep: ${this.creep.name} 状态转换: ${currentState} -> ${nextState}`);
      }
    } catch (error) {
      console.log(`[TaskStateMachine] 状态处理器执行错误: ${currentState}`, error);
    }
  }

  /**
   * 获取当前状态
   */
  public getCurrentState(): TState {
    return this.creepState.currentState;
  }

  /**
   * 设置当前状态
   */
  public setCurrentState(state: TState): void {
    this.creepState.currentState = state;
  }

  /**
   * 获取任务内存
   */
  public getTaskMemory(): TaskFSMMemory<TState> {
    return this.taskMemory;
  }

  /**
   * 获取该creep的执行状态
   */
  public getCreepState(): CreepFSMState<TState> {
    return this.creepState;
  }

  /**
   * 检查该creep的任务是否完成
   */
  public isFinished(): boolean {
    return this.creepState.currentState === this.getFinishedState();
  }

  /**
   * 检查任务是否整体完成（所有creep都完成）
   */
  public isTaskFinished(): boolean {
    const allCreepStates = Object.values(this.taskMemory.creepStates);
    return allCreepStates.every(state => state.currentState === this.getFinishedState());
  }

  /**
   * 检查该creep是否可中断
   */
  public isInterruptible(): boolean {
    return this.creepState.interruptible;
  }

  /**
   * 设置该creep的中断标记
   */
  public setInterruptible(interruptible: boolean): void {
    this.creepState.interruptible = interruptible;
  }

  /**
   * 获取该creep的上下文
   */
  public getContext(): Record<string, any> | undefined {
    return this.creepState.context;
  }

  /**
   * 设置该creep的上下文
   */
  public setContext(context: Record<string, any>): void {
    this.creepState.context = context;
  }

  /**
   * 获取任务级别的共享上下文
   */
  public getGlobalContext(): Record<string, any> | undefined {
    return this.taskMemory.context;
  }

  /**
   * 设置任务级别的共享上下文
   */
  public setGlobalContext(context: Record<string, any>): void {
    this.taskMemory.context = context;
  }

  /**
   * 获取任务状态
   */
  public getTaskState(): TState {
    return this.taskMemory.taskState;
  }

  /**
   * 设置任务状态
   */
  public setTaskState(state: TState): void {
    this.taskMemory.taskState = state;
  }

  /**
   * 获取组ID
   */
  public getGroupId(): string | undefined {
    return this.taskMemory.groupId;
  }

  /**
   * 设置组ID
   */
  public setGroupId(groupId: string): void {
    this.taskMemory.groupId = groupId;
  }

  /**
   * 获取creep引用
   */
  public getCreep(): Creep {
    return this.creep;
  }

  /**
   * 获取任务对象
   */
  protected getTask<T extends Task>(creep: Creep): T | null {
    const taskManager: TaskManager = this.serviceContainer.get('taskManager');
    const task = taskManager.getCreepTask(creep.name);

    if (task && task.type === this.getExpectedTaskType()) {
      return task as T;
    }
    return null;
  }

  /**
   * 检查creep是否即将死亡
   */
  protected isCreepDying(creep: Creep, threshold: number = 50): boolean {
    return creep.ticksToLive !== undefined && creep.ticksToLive < threshold;
  }

  /**
   * 返回期望的任务类型
   */
  protected abstract getExpectedTaskType(): TaskType;

  /**
   * 返回状态处理器映射
   */
  protected abstract handlers(): StateHandlers<TState>;

  /**
   * 返回完成状态
   */
  protected abstract getFinishedState(): TState;

  /**
   * 返回初始状态
   */
  protected abstract getInitialState(): TState;
}
