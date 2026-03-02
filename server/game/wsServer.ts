// ============================================================
// WebSocket Game Server
// ============================================================
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { v4 as uuid } from 'uuid';
import { Matchmaker } from './matchmaker';
import { ClientMsg } from '../../shared/game';

interface GameClient {
  id: string;
  name: string;
  ws: WebSocket;
  lastPing: number;
}

export function createGameWsServer(httpServer: Server): void {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<string, GameClient>();

  const send = (playerId: string, msg: object): void => {
    const client = clients.get(playerId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(msg));
      } catch {
        // ignore send errors
      }
    }
  };

  const matchmaker = new Matchmaker(send);

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const playerId = uuid();
    const client: GameClient = { id: playerId, name: 'Player', ws, lastPing: Date.now() };
    clients.set(playerId, client);

    console.log(`[WS] Player connected: ${playerId}`);

    ws.on('message', (raw: Buffer) => {
      try {
        const msg: ClientMsg = JSON.parse(raw.toString());
        handleMessage(client, msg);
      } catch (e) {
        console.warn('[WS] Bad message:', e);
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Player disconnected: ${playerId}`);
      matchmaker.removePlayer(playerId);
      clients.delete(playerId);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error for ${playerId}:`, err.message);
    });

    // Send welcome
    send(playerId, { type: 'connected', payload: { playerId } });
  });

  function handleMessage(client: GameClient, msg: ClientMsg): void {
    switch (msg.type) {
      case 'join_queue': {
        const payload = msg.payload as { name?: string } | undefined;
        client.name = (payload?.name ?? 'Player').slice(0, 20);
        matchmaker.enqueue(client.id, client.name);
        break;
      }
      case 'leave_queue': {
        matchmaker.dequeue(client.id);
        break;
      }
      case 'player_input': {
        matchmaker.applyInput(client.id, msg.payload);
        break;
      }
      case 'ping': {
        send(client.id, { type: 'pong', payload: { ts: Date.now() } });
        client.lastPing = Date.now();
        break;
      }
      default:
        break;
    }
  }

  // Heartbeat — drop stale connections
  setInterval(() => {
    const now = Date.now();
    for (const [id, client] of Array.from(clients)) {
      if (now - client.lastPing > 30000) {
        client.ws.terminate();
        clients.delete(id);
        matchmaker.removePlayer(id);
      }
    }
  }, 10000);

  console.log('[WS] Game WebSocket server ready on /ws');
}
