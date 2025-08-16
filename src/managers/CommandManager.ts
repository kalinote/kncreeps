import { BaseManager } from "./BaseManager";
import { CommandService } from "../services/command/CommandService";
import { EventBus } from "../core/EventBus";
import { ManagerContainer } from "../core/ManagerContainer";

/**
 * 命令管理器 - 负责命令系统的生命周期管理
 */
export class CommandManager extends BaseManager {
  public get commandService(): CommandService {
    return this.services.get('commandService') as CommandService;
  }

  constructor(eventBus: EventBus, managerContainer: ManagerContainer) {
    super(eventBus, managerContainer, 'commandManager');
    this.registerServices("commandService", new CommandService(eventBus, this, this.memory));
  }

  protected onUpdate(): void {}
  protected onCleanup(): void {}
  protected onReset(): void {}
  protected onInitialize(): void {}
}
