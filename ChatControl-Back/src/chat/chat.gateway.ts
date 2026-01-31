import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';

/** Payload del evento new_message (mismo formato que Message en el frontend) */
export interface NewMessagePayload {
  conversationId: string;
  message: {
    id: string;
    conversationId: string;
    fromUser: boolean;
    text: string;
    timestamp: number;
    fromAi?: boolean;
  };
  /** Para futura escalabilidad multi-empresa */
  companyId?: string;
}

/**
 * Gateway WebSocket (Socket.IO) para notificar mensajes nuevos en tiempo real.
 * El webhook de WhatsApp y el envío manual guardan en DB y luego emiten aquí;
 * el frontend escucha y actualiza sin polling.
 */
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' },
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  handleConnection() {
    this.logger.debug('Cliente WebSocket conectado');
  }

  handleDisconnect() {
    this.logger.debug('Cliente WebSocket desconectado');
  }

  /**
   * Emite new_message a todos los clientes conectados.
   * Opcionalmente por sala conversation:conversationId o company:companyId para escalar.
   */
  emitNewMessage(conversationId: string, message: NewMessagePayload['message'], companyId?: string): void {
    const payload: NewMessagePayload = { conversationId, message, companyId };
    this.server.emit('new_message', payload);
  }

  /** Eventos de mensajes masivos: el frontend muestra progreso y errores en tiempo real */
  emitBroadcastStarted(total: number): void {
    this.server.emit('broadcast_started', { total });
  }

  emitBroadcastMessageSent(conversationId: string, index: number): void {
    this.server.emit('broadcast_message_sent', { conversationId, index });
  }

  emitBroadcastMessageFailed(conversationId: string, index: number, errorMessage: string): void {
    this.server.emit('broadcast_message_failed', { conversationId, index, errorMessage });
  }
}
