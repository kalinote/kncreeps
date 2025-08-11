import { BaseManager } from "./BaseManager";
import { CommandService } from "../services/command/CommandService";
import { EventBus } from "../core/EventBus";
import { ManagerContainer } from "../core/ManagerContainer";


/**
 * 命令管理器 - 负责管理命令系统
 */
export class CommandManager extends BaseManager {
  protected onUpdate(): void {}
  protected onCleanup(): void {}
  protected onReset(): void {}
  protected onInitialize(): void {}

  constructor(eventBus: EventBus, managerContainer: ManagerContainer) {
    super(eventBus, managerContainer, 'commandManager');

    this.registerServices("commandService", new CommandService(eventBus, this, this.memory));
  }

}
