// ============================================================
// Authoritative Game Session
// ============================================================
import { v4 as uuid } from 'uuid';
import {
  TICK_MS, ARENA_WIDTH, ARENA_HEIGHT, PLAYER_RADIUS,
  KILLS_TO_WIN, MATCH_DURATION_MS, TICK_RATE,
  DASH_COOLDOWN_MS, DASH_DURATION_MS, DASH_SPEED,
  RESPAWN_DELAY_MS, POWERUP_SPAWN_INTERVAL_MS, MAX_POWERUP_COUNT,
  WEAPONS, POWERUPS,
  GameState, PlayerState, BulletState, PowerupEntity, KillEvent,
  PlayerInput, WeaponType, PowerupType, ActivePowerup,
  GameEndMsg,
} from '../../shared/game';
import {
  resolvePlayerObstacles, bulletHitsObstacle, bulletHitsPlayer, playerPicksPowerup,
} from './physics';

type SendFn = (playerId: string, msg: object) => void;

const PLAYER_SPEED = 260; // px/s
const FRICTION = 0.82;
const ACCELERATION = 2200;
const SPAWN_POINTS: Array<{ x: number; y: number }> = [
  { x: 200, y: 600 },
  { x: 1400, y: 600 },
  { x: 800, y: 200 },
  { x: 800, y: 1000 },
];

const POWERUP_POSITIONS: Array<{ x: number; y: number }> = [
  { x: 800, y: 600 },
  { x: 400, y: 400 },
  { x: 1200, y: 400 },
  { x: 400, y: 800 },
  { x: 1200, y: 800 },
  { x: 700, y: 300 },
  { x: 900, y: 900 },
];

const POWERUP_TYPES: PowerupType[] = ['health', 'speed', 'damage', 'shield', 'vampirism', 'explosive'];

export class GameSession {
  readonly id: string;
  private state: GameState;
  private inputs: Map<string, PlayerInput> = new Map();
  private lastProcessedSeq: Map<string, number> = new Map();
  private interval: ReturnType<typeof setInterval> | null = null;
  private powerupSpawnTimer = 0;
  private send: SendFn;
  private onEnd: (sessionId: string) => void;
  private startTime = 0;

  constructor(playerIds: string[], playerNames: Map<string, string>, send: SendFn, onEnd: (id: string) => void) {
    this.id = uuid();
    this.send = send;
    this.onEnd = onEnd;

    const players: Record<string, PlayerState> = {};
    playerIds.forEach((id, i) => {
      const spawn = SPAWN_POINTS[i % SPAWN_POINTS.length];
      players[id] = {
        id,
        name: playerNames.get(id) ?? 'Player',
        x: spawn.x, y: spawn.y,
        vx: 0, vy: 0,
        angle: 0,
        hp: 100, maxHp: 100,
        kills: 0, deaths: 0,
        weapon: 'blaster',
        fireCooldownTicks: 0,
        dashCooldownTicks: 0,
        isDashing: false,
        dashTicks: 0,
        isDead: false,
        respawnTicks: 0,
        activePowerups: [],
        team: (i % 2) as 0 | 1,
      };
    });

    this.state = {
      tick: 0,
      phase: 'countdown',
      countdownTicks: TICK_RATE * 3,
      matchEndTick: 0,
      players,
      bullets: [],
      powerups: [],
      killFeed: [],
      winnerId: null,
    };
  }

  getPlayerIds(): string[] {
    return Object.keys(this.state.players);
  }

  applyInput(playerId: string, input: PlayerInput): void {
    this.inputs.set(playerId, input);
  }

  start(): void {
    this.startTime = Date.now();
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  private tick(): void {
    const s = this.state;
    s.tick++;

    if (s.phase === 'countdown') {
      s.countdownTicks--;
      if (s.countdownTicks <= 0) {
        s.phase = 'playing';
        s.matchEndTick = s.tick + Math.floor(MATCH_DURATION_MS / TICK_MS);
      }
    } else if (s.phase === 'playing') {
      this.simulatePlaying();
    }

    // Broadcast state
    const playerIds = Object.keys(s.players);
    for (const pid of playerIds) {
      this.send(pid, {
        type: 'game_state',
        payload: {
          state: s,
          yourId: pid,
          lastProcessedSeq: this.lastProcessedSeq.get(pid) ?? 0,
        },
      });
    }

    // Trim kill feed
    if (s.killFeed.length > 5) s.killFeed = s.killFeed.slice(-5);
  }

  private simulatePlaying(): void {
    const s = this.state;
    const dt = TICK_MS / 1000;

    // Check time limit
    if (s.tick >= s.matchEndTick) {
      this.endGame();
      return;
    }

    // Spawn powerups
    this.powerupSpawnTimer += TICK_MS;
    if (this.powerupSpawnTimer >= POWERUP_SPAWN_INTERVAL_MS && s.powerups.length < MAX_POWERUP_COUNT) {
      this.powerupSpawnTimer = 0;
      this.spawnPowerup();
    }

    // Process players
    for (const p of Object.values(s.players)) {
      if (p.isDead) {
        p.respawnTicks--;
        if (p.respawnTicks <= 0) this.respawnPlayer(p);
        continue;
      }

      const input = this.inputs.get(p.id);
      if (input) {
        this.lastProcessedSeq.set(p.id, input.seq);
        this.processPlayerInput(p, input, dt);
      }

      // Update powerup timers
      p.activePowerups = p.activePowerups.filter(ap => {
        ap.remainingMs -= TICK_MS;
        return ap.remainingMs > 0;
      });

      // Cooldowns
      if (p.fireCooldownTicks > 0) p.fireCooldownTicks--;
      if (p.dashCooldownTicks > 0) p.dashCooldownTicks--;
      if (p.isDashing) {
        p.dashTicks--;
        if (p.dashTicks <= 0) p.isDashing = false;
      }
    }

    // Simulate bullets
    s.bullets = s.bullets.filter(b => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.lifeTicks--;

      if (b.lifeTicks <= 0 || bulletHitsObstacle(b)) return false;

      for (const p of Object.values(s.players)) {
        if (bulletHitsPlayer(b, p)) {
          this.applyDamage(b, p);
          if (!b.piercing) return false;
          b.hitPlayerIds.push(p.id);
        }
      }
      return true;
    });

    // Powerup pickup
    for (const p of Object.values(s.players)) {
      if (p.isDead) continue;
      for (let i = s.powerups.length - 1; i >= 0; i--) {
        const pu = s.powerups[i];
        if (playerPicksPowerup(p, pu)) {
          this.applyPowerup(p, pu.type);
          s.powerups.splice(i, 1);
        }
      }
    }

    // Check win condition
    for (const p of Object.values(s.players)) {
      if (p.kills >= KILLS_TO_WIN) {
        this.endGame(p.id);
        return;
      }
    }
  }

  private processPlayerInput(p: PlayerState, input: PlayerInput, dt: number): void {
    p.angle = input.aimAngle;
    p.weapon = input.weapon;

    const speedMult = this.getPowerupMult(p, 'speed');
    const speed = PLAYER_SPEED * speedMult;

    // Dash
    if (input.dash && p.dashCooldownTicks <= 0 && !p.isDashing) {
      p.isDashing = true;
      p.dashTicks = Math.floor(DASH_DURATION_MS / TICK_MS);
      p.dashCooldownTicks = Math.floor(DASH_COOLDOWN_MS / TICK_MS);
      const dashDir = Math.atan2(
        (input.down ? 1 : 0) - (input.up ? 1 : 0),
        (input.right ? 1 : 0) - (input.left ? 1 : 0),
      ) || p.angle;
      p.vx = Math.cos(dashDir) * DASH_SPEED;
      p.vy = Math.sin(dashDir) * DASH_SPEED;
    }

    if (!p.isDashing) {
      let ax = 0, ay = 0;
      if (input.left)  ax -= ACCELERATION;
      if (input.right) ax += ACCELERATION;
      if (input.up)    ay -= ACCELERATION;
      if (input.down)  ay += ACCELERATION;

      // Normalize diagonal
      if (ax !== 0 && ay !== 0) { ax *= 0.707; ay *= 0.707; }

      p.vx = (p.vx + ax * dt) * Math.pow(FRICTION, dt * 60);
      p.vy = (p.vy + ay * dt) * Math.pow(FRICTION, dt * 60);

      // Clamp speed
      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (spd > speed) { p.vx = (p.vx / spd) * speed; p.vy = (p.vy / spd) * speed; }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    resolvePlayerObstacles(p);

    // Shooting
    if (input.shooting && p.fireCooldownTicks <= 0) {
      this.fireWeapon(p);
    }
  }

  private fireWeapon(p: PlayerState): void {
    const wDef = WEAPONS[p.weapon];
    const damageMult = this.getPowerupMult(p, 'damage');
    const explosive = this.hasPowerup(p, 'explosive');

    for (let i = 0; i < wDef.bulletsPerShot; i++) {
      const spread = (Math.random() - 0.5) * wDef.spread;
      const angle = p.angle + spread;
      const b: BulletState = {
        id: uuid(),
        ownerId: p.id,
        x: p.x + Math.cos(angle) * (PLAYER_RADIUS + 6),
        y: p.y + Math.sin(angle) * (PLAYER_RADIUS + 6),
        vx: Math.cos(angle) * wDef.bulletSpeed,
        vy: Math.sin(angle) * wDef.bulletSpeed,
        weapon: p.weapon,
        lifeTicks: wDef.bulletLifeTicks,
        piercing: wDef.piercing,
        hitPlayerIds: [],
      };
      this.state.bullets.push(b);
    }
    p.fireCooldownTicks = wDef.fireRateTicks;
  }

  private applyDamage(b: BulletState, p: PlayerState): void {
    const wDef = WEAPONS[b.weapon];
    const shooter = this.state.players[b.ownerId];
    let dmg = wDef.damage;

    if (shooter) {
      dmg *= this.getPowerupMult(shooter, 'damage');
      if (this.hasPowerup(shooter, 'explosive')) dmg *= 1.3;
    }

    const shielded = this.hasPowerup(p, 'shield');
    if (shielded) dmg *= 0.2;

    p.hp = Math.max(0, p.hp - dmg);

    // Vampirism heal
    if (shooter && this.hasPowerup(shooter, 'vampirism')) {
      shooter.hp = Math.min(shooter.maxHp, shooter.hp + dmg * 0.3);
    }

    if (p.hp <= 0) this.killPlayer(p, b.ownerId);
  }

  private killPlayer(p: PlayerState, killerId: string): void {
    const killer = this.state.players[killerId];
    if (killer && killerId !== p.id) killer.kills++;
    p.deaths++;
    p.isDead = true;
    p.respawnTicks = Math.floor(RESPAWN_DELAY_MS / TICK_MS);
    p.activePowerups = [];

    const event: KillEvent = {
      killerId,
      killerName: killer?.name ?? 'Environment',
      victimId: p.id,
      victimName: p.name,
      weapon: this.state.bullets.find(b => b.ownerId === killerId)?.weapon ?? 'blaster',
      tick: this.state.tick,
    };
    this.state.killFeed.push(event);

    // Broadcast kill event
    for (const pid of Object.keys(this.state.players)) {
      this.send(pid, { type: 'kill_event', payload: event });
    }
  }

  private respawnPlayer(p: PlayerState): void {
    const spawn = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
    p.x = spawn.x; p.y = spawn.y;
    p.vx = 0; p.vy = 0;
    p.hp = p.maxHp;
    p.isDead = false;
    p.respawnTicks = 0;
    p.weapon = 'blaster';
  }

  private spawnPowerup(): void {
    const used = new Set(this.state.powerups.map(p => `${p.x},${p.y}`));
    const available = POWERUP_POSITIONS.filter(pos => !used.has(`${pos.x},${pos.y}`));
    if (available.length === 0) return;
    const pos = available[Math.floor(Math.random() * available.length)];
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    this.state.powerups.push({ id: uuid(), type, x: pos.x, y: pos.y, spawnedAt: Date.now() });
  }

  private applyPowerup(p: PlayerState, type: PowerupType): void {
    const def = POWERUPS[type];
    if (type === 'health') {
      p.hp = Math.min(p.maxHp, p.hp + 40);
      return;
    }
    // Remove existing same powerup
    p.activePowerups = p.activePowerups.filter(ap => ap.type !== type);
    p.activePowerups.push({ type, remainingMs: def.durationMs });
  }

  private getPowerupMult(p: PlayerState, type: 'speed' | 'damage'): number {
    const has = p.activePowerups.some(ap => ap.type === type);
    if (!has) return 1;
    return type === 'speed' ? 1.6 : 2.0;
  }

  private hasPowerup(p: PlayerState, type: PowerupType): boolean {
    return p.activePowerups.some(ap => ap.type === type);
  }

  private endGame(winnerId?: string): void {
    const s = this.state;
    s.phase = 'ended';
    s.winnerId = winnerId ?? this.getLeadingPlayer();

    const winner = winnerId ? s.players[winnerId] : null;
    const endMsg: GameEndMsg = {
      winnerId: s.winnerId ?? '',
      winnerName: winner?.name ?? 'Draw',
      players: Object.values(s.players).map(p => ({
        id: p.id, name: p.name, kills: p.kills, deaths: p.deaths,
      })),
    };

    for (const pid of Object.keys(s.players)) {
      this.send(pid, { type: 'game_end', payload: endMsg });
    }

    this.stop();
    setTimeout(() => this.onEnd(this.id), 5000);
  }

  private getLeadingPlayer(): string | null {
    let best: PlayerState | null = null;
    for (const p of Object.values(this.state.players)) {
      if (!best || p.kills > best.kills) best = p;
    }
    return best?.id ?? null;
  }
}
