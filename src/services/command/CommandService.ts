import { BaseService } from "../BaseService";
import { CommandRegistry } from "../../command/CommandRegistry";
import { EventBus } from "../../core/EventBus";
import { CommandManager } from "../../managers/CommandManager";

export class CommandService extends BaseService {
  protected onUpdate(): void {}
  protected onCleanup(): void {}
  protected onReset(): void {}
  protected onInitialize(): void {}

  private _commandRegistry: CommandRegistry;

  public get commandRegistry(): CommandRegistry {
    return this._commandRegistry;
  }

  constructor(eventBus: EventBus, manager: CommandManager, memory: any) {
    super(eventBus, manager, memory);
    this._commandRegistry = new CommandRegistry();
  }
}
