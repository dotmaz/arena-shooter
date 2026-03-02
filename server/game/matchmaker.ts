// ============================================================
// Matchmaking Manager
// ============================================================
import { GameSession } from './session';

const PLAYERS_PER_MATCH = 2;

type SendFn = (playerId: string, msg: object) => void;

export class Matchmaker {
  private queue: Array<{ id: string; name: string }> = [];
  private sessions: Map<string, GameSession> = new Map();
  private playerToSession: Map<string, string> = new Map();
  private send: SendFn;

  constructor(send: SendFn) {
    this.send = send;
  }

  enqueue(playerId: string, playerName: string): void {
    if (this.queue.some(p => p.id === playerId)) return;
    if (this.playerToSession.has(playerId)) return;
    this.queue.push({ id: playerId, name: playerName });
    this.broadcastQueueStatus();
    this.tryMatch();
  }

  dequeue(playerId: string): void {
    this.queue = this.queue.filter(p => p.id !== playerId);
    this.broadcastQueueStatus();
  }

  applyInput(playerId: string, input: unknown): void {
    const sessionId = this.playerToSession.get(playerId);
    if (!sessionId) return;
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.applyInput(playerId, input as Parameters<GameSession['applyInput']>[1]);
  }

  removePlayer(playerId: string): void {
    this.dequeue(playerId);
    const sessionId = this.playerToSession.get(playerId);
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        // Notify others in session
        for (const pid of session.getPlayerIds()) {
          if (pid !== playerId) {
            this.send(pid, { type: 'player_left', payload: { playerId } });
          }
        }
      }
      this.playerToSession.delete(playerId);
    }
  }

  getSessionForPlayer(playerId: string): GameSession | undefined {
    const sid = this.playerToSession.get(playerId);
    return sid ? this.sessions.get(sid) : undefined;
  }

  private tryMatch(): void {
    while (this.queue.length >= PLAYERS_PER_MATCH) {
      const players = this.queue.splice(0, PLAYERS_PER_MATCH);
      const names = new Map(players.map(p => [p.id, p.name]));
      const playerIds = players.map(p => p.id);

      const session = new GameSession(
        playerIds,
        names,
        this.send,
        (sid) => this.cleanupSession(sid),
      );

      this.sessions.set(session.id, session);
      for (const pid of playerIds) {
        this.playerToSession.set(pid, session.id);
      }

      // Notify players
      for (const pid of playerIds) {
        this.send(pid, {
          type: 'game_start',
          payload: { sessionId: session.id, playerIds, names: Object.fromEntries(names) },
        });
      }

      session.start();
      this.broadcastQueueStatus();
    }
  }

  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    for (const pid of session.getPlayerIds()) {
      this.playerToSession.delete(pid);
    }
    this.sessions.delete(sessionId);
  }

  private broadcastQueueStatus(): void {
    this.queue.forEach((p, i) => {
      this.send(p.id, {
        type: 'queue_status',
        payload: { position: i + 1, total: this.queue.length },
      });
    });
  }
}
