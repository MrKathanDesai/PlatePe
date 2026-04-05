import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  },
  namespace: '/kds',
})
export class KDSGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(KDSGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`KDS client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`KDS client disconnected: ${client.id}`);
  }

  /**
   * Emit a new or addon ticket.
   * The ticket payload includes { station: 'KITCHEN' | 'BREWBAR' }
   * so each screen can filter on the client side.
   */
  emitNewTicket(ticket: unknown) {
    this.server.emit('order:new', ticket);
  }

  emitAddonTicket(ticket: unknown) {
    this.server.emit('order:addon', ticket);
  }

  emitCancelSignal(data: { orderId: string; itemIds: string[] }) {
    this.server.emit('order:cancel', data);
  }

  /** Broadcast 86 (sold-out) signal — all screens listen */
  emit86Signal(product: { id: string; name: string }) {
    this.server.emit('item:86', product);
  }

  /** Stage advance — payload includes station for client filtering */
  emitStageUpdate(ticket: unknown) {
    this.server.emit('ticket:stage', ticket);
  }

  /** Emitted when an order is fully paid — dashboard/reporting should re-fetch */
  emitOrderPaid(data: { orderId: string; total: number }) {
    this.server.emit('order:paid', data);
  }

  emitTableAttention(data: {
    tableId: string;
    orderId: string;
    type: 'PAYMENT_CASH' | 'PAYMENT_CARD';
  }) {
    this.server.emit('table:attention', data);
  }

  emitTableAttentionCleared(data: { tableId: string; orderId: string }) {
    this.server.emit('table:attention-cleared', data);
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { event: 'pong', data: 'pong' };
  }
}
