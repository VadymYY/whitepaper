import { Event } from "@core/enums/event.enum";
import { OnEvent } from "@nestjs/event-emitter";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { SignatureDto } from "./dtos/signature.dto";
import { Server } from "socket.io";

@WebSocketGateway()
export class StakingGateway {
  @WebSocketServer()
    server!: Server;

  @OnEvent(Event.SIGNATURES_CACHED)
  async uptimeUpdate(map: Map<string, SignatureDto[]>) {
    for (const [addr, signatures] of map) {
      this.server.emit(`uptime.${addr}`, signatures);
    }
  }

  @OnEvent(Event.BLOCK_CACHED)
  async blockUpdate(addr: string, block: unknown) {
    this.server.emit(`proposed_block.${addr}`, block);
    this.server.emit(`proposed_block`, block);
  }
}
