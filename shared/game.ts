// ============================================================
// Shared Game Types — used by both client and server
// ============================================================

export const TICK_RATE = 60; // server ticks per second
export const TICK_MS = 1000 / TICK_RATE;
export const ARENA_WIDTH = 1600;
export const ARENA_HEIGHT = 1200;
export const PLAYER_RADIUS = 18;
export const BULLET_RADIUS = 5;
export const POWERUP_RADIUS = 20;
export const KILLS_TO_WIN = 10;
export const MATCH_DURATION_MS = 3 * 60 * 1000; // 3 minutes
export const DASH_COOLDOWN_MS = 1500;
export const DASH_DURATION_MS = 180;
export const DASH_SPEED = 900;
export const RESPAWN_DELAY_MS = 2000;
export const POWERUP_SPAWN_INTERVAL_MS = 8000;
export const MAX_POWERUP_COUNT = 4;

// ── Weapon definitions ─────────────────────────────────────
export type WeaponType = 'blaster' | 'shotgun' | 'railgun' | 'burst';

export interface WeaponDef {
  type: WeaponType;
  label: string;
  damage: number;
  fireRateTicks: number;   // ticks between shots
  bulletSpeed: number;
  bulletLifeTicks: number;
  spread: number;          // radians
  bulletsPerShot: number;
  reloadTicks: number;     // 0 = no reload
  maxAmmo: number;         // -1 = infinite
  piercing: boolean;
  color: number;           // hex color for bullet
}

export const WEAPONS: Record<WeaponType, WeaponDef> = {
  blaster: {
    type: 'blaster',
    label: 'Blaster',
    damage: 20,
    fireRateTicks: 8,
    bulletSpeed: 700,
    bulletLifeTicks: 60,
    spread: 0.04,
    bulletsPerShot: 1,
    reloadTicks: 0,
    maxAmmo: -1,
    piercing: false,
    color: 0x00d4ff,
  },
  shotgun: {
    type: 'shotgun',
    label: 'Shotgun',
    damage: 15,
    fireRateTicks: 30,
    bulletSpeed: 550,
    bulletLifeTicks: 30,
    spread: 0.35,
    bulletsPerShot: 6,
    reloadTicks: 0,
    maxAmmo: -1,
    piercing: false,
    color: 0xff8c00,
  },
  railgun: {
    type: 'railgun',
    label: 'Railgun',
    damage: 80,
    fireRateTicks: 90,
    bulletSpeed: 1400,
    bulletLifeTicks: 40,
    spread: 0,
    bulletsPerShot: 1,
    reloadTicks: 0,
    maxAmmo: -1,
    piercing: true,
    color: 0xff2266,
  },
  burst: {
    type: 'burst',
    label: 'Burst Rifle',
    damage: 18,
    fireRateTicks: 5,
    bulletSpeed: 650,
    bulletLifeTicks: 50,
    spread: 0.06,
    bulletsPerShot: 1,
    reloadTicks: 0,
    maxAmmo: -1,
    piercing: false,
    color: 0xaaff44,
  },
};

// ── Powerup definitions ────────────────────────────────────
export type PowerupType = 'health' | 'speed' | 'damage' | 'shield' | 'vampirism' | 'explosive';

export interface PowerupDef {
  type: PowerupType;
  label: string;
  durationMs: number; // 0 = instant
  color: number;
  icon: string;
}

export const POWERUPS: Record<PowerupType, PowerupDef> = {
  health:    { type: 'health',    label: 'Health Pack',       durationMs: 0,     color: 0x44ff88, icon: '❤' },
  speed:     { type: 'speed',     label: 'Speed Boost',       durationMs: 6000,  color: 0x00ccff, icon: '⚡' },
  damage:    { type: 'damage',    label: 'Double Damage',     durationMs: 8000,  color: 0xff4444, icon: '⚔' },
  shield:    { type: 'shield',    label: 'Shield',            durationMs: 5000,  color: 0x8888ff, icon: '🛡' },
  vampirism: { type: 'vampirism', label: 'Vampirism',         durationMs: 7000,  color: 0xcc44ff, icon: '🩸' },
  explosive: { type: 'explosive', label: 'Explosive Bullets', durationMs: 6000,  color: 0xff8800, icon: '💥' },
};

// ── Entity state ───────────────────────────────────────────
export interface Vec2 { x: number; y: number; }

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;       // radians, facing direction
  hp: number;
  maxHp: number;
  kills: number;
  deaths: number;
  weapon: WeaponType;
  fireCooldownTicks: number;
  dashCooldownTicks: number;
  isDashing: boolean;
  dashTicks: number;
  isDead: boolean;
  respawnTicks: number;
  activePowerups: ActivePowerup[];
  team: 0 | 1;
}

export interface ActivePowerup {
  type: PowerupType;
  remainingMs: number;
}

export interface BulletState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  weapon: WeaponType;
  lifeTicks: number;
  piercing: boolean;
  hitPlayerIds: string[];
}

export interface PowerupEntity {
  id: string;
  type: PowerupType;
  x: number;
  y: number;
  spawnedAt: number;
}

export interface KillEvent {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  weapon: WeaponType;
  tick: number;
}

export type GamePhase = 'waiting' | 'countdown' | 'playing' | 'ended';

export interface GameState {
  tick: number;
  phase: GamePhase;
  countdownTicks: number;
  matchEndTick: number;
  players: Record<string, PlayerState>;
  bullets: BulletState[];
  powerups: PowerupEntity[];
  killFeed: KillEvent[];
  winnerId: string | null;
}

// ── Obstacles ──────────────────────────────────────────────
export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const OBSTACLES: Obstacle[] = [
  // Center pillar
  { x: 750, y: 550, w: 100, h: 100 },
  // Four corner pillars
  { x: 200, y: 200, w: 80, h: 80 },
  { x: 1320, y: 200, w: 80, h: 80 },
  { x: 200, y: 920, w: 80, h: 80 },
  { x: 1320, y: 920, w: 80, h: 80 },
  // Mid-lane barriers
  { x: 500, y: 350, w: 120, h: 30 },
  { x: 980, y: 350, w: 120, h: 30 },
  { x: 500, y: 820, w: 120, h: 30 },
  { x: 980, y: 820, w: 120, h: 30 },
  // Side walls
  { x: 340, y: 560, w: 30, h: 80 },
  { x: 1230, y: 560, w: 30, h: 80 },
];

// ── WebSocket message protocol ─────────────────────────────
export type ClientMsgType =
  | 'join_queue'
  | 'leave_queue'
  | 'player_input'
  | 'request_rematch'
  | 'ping';

export type ServerMsgType =
  | 'queue_status'
  | 'game_start'
  | 'game_state'
  | 'game_end'
  | 'kill_event'
  | 'player_joined'
  | 'player_left'
  | 'pong'
  | 'error'
  | 'connected';

export interface PlayerInput {
  seq: number;         // client sequence number for reconciliation
  tick: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  dash: boolean;
  shooting: boolean;
  aimAngle: number;    // radians
  weapon: WeaponType;
}

export interface ClientMsg {
  type: ClientMsgType;
  payload?: unknown;
}

export interface ServerMsg {
  type: ServerMsgType;
  payload?: unknown;
}

export interface GameStateMsg {
  state: GameState;
  yourId: string;
  lastProcessedSeq: number;
}

export interface QueueStatusMsg {
  position: number;
  total: number;
}

export interface GameEndMsg {
  winnerId: string;
  winnerName: string;
  players: Array<{ id: string; name: string; kills: number; deaths: number }>;
}
