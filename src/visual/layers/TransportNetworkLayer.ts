import { BaseLayer } from "./BaseLayer";
import { LayerType } from "../../types";
import { VisualConfig } from "../../config/VisualConfig";
import { VisualLayoutService } from "../../services/visual/VisualLayoutService";
import { TransportService } from "../../services/logistics/TransportService";

/**
 * 运输网络图层
 */
export class TransportNetworkLayer extends BaseLayer {
  protected name: string = "TransportNetworkLayer";
  protected title: string = "运输网络";
  public layerType: LayerType = LayerType.MAP;

  protected get transportService(): TransportService {
    return this.service.transportService;
  }

  constructor(service: VisualLayoutService) {
    super(service);
    this.priority = VisualConfig.LAYER_DEFAULTS.TransportNetworkLayer.priority;
  }

  public render(room: Room): void {
    if (!this.transportService) {
      console.log('[TransportNetworkLayer] 未找到 TransportService');
      return;
    }

    this.renderRoomProvider(room);
    this.renderRoomConsumer(room);
  }

  private renderRoomProvider(room: Room): void {
    const providers = this.transportService.getProviders(room.name);
    if (providers.length === 0) {
      return;
    }

    const visual = new RoomVisual(room.name);
    for (const provider of providers) {
      this.drawIndicator(visual, provider.pos.x, provider.pos.y, '#0000FF', 0.5);
    }
  }

  private renderRoomConsumer(room: Room): void {
    const consumers = this.transportService.getConsumers(room.name);
    if (consumers.length === 0) {
      return;
    }

    const visual = new RoomVisual(room.name);
    for (const consumer of consumers) {
      this.drawIndicator(visual, consumer.pos.x, consumer.pos.y, '#FF0000', 0.5);
    }
  }
}
