// ============================================================
// Client-side Game Loop with prediction & reconciliation
// ============================================================
import {
  GameState, PlayerInput, PlayerState, TICK_MS, TICK_RATE,
  WEAPONS, WeaponType,
} from '../../../shared/game';
import { GameRenderer } from './GameRenderer';
import { InputManager } from './InputManager';

interface PendingInput {
  seq: number;
  input: PlayerInput;
  predictedX: number;
  predictedY: number;
  predictedVx: number;
  predictedVy: number;
}

export class GameLoop {
  private renderer: GameRenderer;
  private input: InputManager;
  private sendInput: (input: PlayerInput) => void;

  private myId = '';
  private seq = 0;
  private pendingInputs: PendingInput[] = [];
  private lastProcessedSeq = 0;

  // Interpolation
  private stateBuffer: Array<{ tick: number; state: GameState; ts: number }> = [];
  private renderDelay = 100; // ms behind server

  // Prediction state
  private predX = 0;
  private predY = 0;
  private predVx = 0;
  private predVy = 0;

  private lastBulletIds = new Set<string>();
  private lastPlayerHps = new Map<string, number>();

  private rafId: number | null = null;
  private lastFrameTs = 0;
  private inputInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    renderer: GameRenderer,
    input: InputManager,
    sendInput: (input: PlayerInput) => void,
  ) {
    this.renderer = renderer;
    this.input = input;
    this.sendInput = sendInput;
  }

  start(myId: string): void {
    this.myId = myId;
    this.rafId = requestAnimationFrame(this.frame);

    // Send inputs at tick rate
    this.inputInterval = setInterval(() => this.sendCurrentInput(), TICK_MS);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.inputInterval !== null) clearInterval(this.inputInterval);
    this.rafId = null;
    this.inputInterval = null;
  }

  receiveState(state: GameState, lastSeq: number): void {
    this.lastProcessedSeq = lastSeq;
    this.stateBuffer.push({ tick: state.tick, state, ts: Date.now() });
    if (this.stateBuffer.length > 30) this.stateBuffer.shift();

    // Reconcile prediction
    const me = state.players[this.myId];
    if (me) {
      // Remove acknowledged inputs
      this.pendingInputs = this.pendingInputs.filter(p => p.seq > lastSeq);

      // Re-apply unacknowledged inputs from server position
      this.predX = me.x;
      this.predY = me.y;
      this.predVx = me.vx;
      this.predVy = me.vy;

      for (const pending of this.pendingInputs) {
        this.applyPrediction(pending.input);
      }
    }

    // Detect hit effects
    this.detectHitEffects(state);
  }

  private detectHitEffects(state: GameState): void {
    // New bullets spawned = muzzle flash
    const currentBulletIds = new Set(state.bullets.map(b => b.id));
    for (const b of state.bullets) {
      if (!this.lastBulletIds.has(b.id) && b.ownerId === this.myId) {
        const me = state.players[this.myId];
        if (me) {
          const wDef = WEAPONS[b.weapon];
          this.renderer.spawnMuzzleFlash(b.x, b.y, me.angle, wDef.color);
        }
      }
    }
    this.lastBulletIds = currentBulletIds;

    // HP decrease = hit spark
    for (const p of Object.values(state.players)) {
      const prevHp = this.lastPlayerHps.get(p.id) ?? p.hp;
      if (p.hp < prevHp) {
        this.renderer.spawnParticles(p.x, p.y, 0xff4444, 6, 180);
        if (p.id === this.myId) this.renderer.shake(6);
      }
      if (p.isDead && prevHp > 0) {
        this.renderer.spawnParticles(p.x, p.y, 0xff8800, 20, 300);
        this.renderer.shake(12);
      }
      this.lastPlayerHps.set(p.id, p.hp);
    }
  }

  private sendCurrentInput(): void {
    const me = this.getMyPlayer();
    if (!me) return;

    const screenPos = this.renderer.getScreenPosition(me.x, me.y);
    const state = this.input.getState(screenPos.x, screenPos.y);

    const input: PlayerInput = {
      seq: ++this.seq,
      tick: 0,
      up: state.up,
      down: state.down,
      left: state.left,
      right: state.right,
      dash: state.dash,
      shooting: state.shooting,
      aimAngle: state.aimAngle,
      weapon: state.weapon,
    };

    // Store for reconciliation
    const before = { x: this.predX, y: this.predY, vx: this.predVx, vy: this.predVy };
    this.applyPrediction(input);
    this.pendingInputs.push({
      seq: input.seq,
      input,
      predictedX: this.predX,
      predictedY: this.predY,
      predictedVx: this.predVx,
      predictedVy: this.predVy,
    });

    this.sendInput(input);
  }

  private applyPrediction(input: PlayerInput): void {
    const dt = TICK_MS / 1000;
    const ACCELERATION = 2200;
    const FRICTION = 0.82;
    const PLAYER_SPEED = 260;

    let ax = 0, ay = 0;
    if (input.left)  ax -= ACCELERATION;
    if (input.right) ax += ACCELERATION;
    if (input.up)    ay -= ACCELERATION;
    if (input.down)  ay += ACCELERATION;
    if (ax !== 0 && ay !== 0) { ax *= 0.707; ay *= 0.707; }

    this.predVx = (this.predVx + ax * dt) * Math.pow(FRICTION, dt * 60);
    this.predVy = (this.predVy + ay * dt) * Math.pow(FRICTION, dt * 60);

    const spd = Math.sqrt(this.predVx ** 2 + this.predVy ** 2);
    if (spd > PLAYER_SPEED) {
      this.predVx = (this.predVx / spd) * PLAYER_SPEED;
      this.predVy = (this.predVy / spd) * PLAYER_SPEED;
    }

    this.predX += this.predVx * dt;
    this.predY += this.predVy * dt;
  }

  private frame = (ts: number): void => {
    this.rafId = requestAnimationFrame(this.frame);
    const dt = Math.min((ts - this.lastFrameTs) / 1000, 0.05);
    this.lastFrameTs = ts;

    const renderState = this.getInterpolatedState();
    if (!renderState) return;

    // Overlay prediction for local player
    const me = renderState.players[this.myId];
    if (me) {
      me.x = this.predX;
      me.y = this.predY;
    }

    this.renderer.render(renderState, this.myId, 0);
  };

  private getInterpolatedState(): GameState | null {
    if (this.stateBuffer.length === 0) return null;
    const renderTime = Date.now() - this.renderDelay;

    // Find two states to interpolate between
    let older: typeof this.stateBuffer[0] | null = null;
    let newer: typeof this.stateBuffer[0] | null = null;

    for (let i = 0; i < this.stateBuffer.length - 1; i++) {
      if (this.stateBuffer[i].ts <= renderTime && this.stateBuffer[i + 1].ts >= renderTime) {
        older = this.stateBuffer[i];
        newer = this.stateBuffer[i + 1];
        break;
      }
    }

    if (!older || !newer) {
      return this.stateBuffer[this.stateBuffer.length - 1].state;
    }

    const t = (renderTime - older.ts) / (newer.ts - older.ts);
    return this.interpolateStates(older.state, newer.state, t);
  }

  private interpolateStates(a: GameState, b: GameState, t: number): GameState {
    const result: GameState = { ...b, players: { ...b.players } };

    for (const id of Object.keys(b.players)) {
      if (id === this.myId) continue; // skip local player (use prediction)
      const pa = a.players[id];
      const pb = b.players[id];
      if (!pa || !pb) continue;

      result.players[id] = {
        ...pb,
        x: pa.x + (pb.x - pa.x) * t,
        y: pa.y + (pb.y - pa.y) * t,
        angle: pa.angle + this.lerpAngle(pa.angle, pb.angle, t),
      };
    }

    return result;
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff * t;
  }

  private getMyPlayer(): PlayerState | null {
    if (this.stateBuffer.length === 0) return null;
    return this.stateBuffer[this.stateBuffer.length - 1].state.players[this.myId] ?? null;
  }
}
