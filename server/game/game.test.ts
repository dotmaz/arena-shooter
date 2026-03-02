import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  rectCircleCollide,
  circleCircleCollide,
  bulletHitsObstacle,
  bulletHitsPlayer,
  playerPicksPowerup,
  resolvePlayerObstacles,
} from './physics';
import {
  ARENA_WIDTH, ARENA_HEIGHT, PLAYER_RADIUS, BULLET_RADIUS,
  POWERUP_RADIUS, PlayerState, BulletState, PowerupEntity,
} from '../../shared/game';
import { Matchmaker } from './matchmaker';

// ── Physics Tests ──────────────────────────────────────────
describe('rectCircleCollide', () => {
  it('detects overlap when circle center is inside rect', () => {
    expect(rectCircleCollide(0, 0, 100, 100, 50, 50, 10)).toBe(true);
  });

  it('detects overlap when circle edge touches rect edge', () => {
    expect(rectCircleCollide(100, 0, 100, 100, 95, 50, 10)).toBe(true);
  });

  it('returns false when circle is clearly outside', () => {
    expect(rectCircleCollide(0, 0, 100, 100, 200, 200, 10)).toBe(false);
  });
});

describe('circleCircleCollide', () => {
  it('detects collision when circles overlap', () => {
    expect(circleCircleCollide(0, 0, 10, 15, 0, 10)).toBe(true);
  });

  it('returns false when circles are separated', () => {
    expect(circleCircleCollide(0, 0, 5, 20, 0, 5)).toBe(false);
  });
});

// ── Bullet Tests ───────────────────────────────────────────
function makeBullet(overrides: Partial<BulletState> = {}): BulletState {
  return {
    id: 'b1',
    ownerId: 'p1',
    x: 400, y: 400,
    vx: 100, vy: 0,
    weapon: 'blaster',
    lifeTicks: 30,
    piercing: false,
    hitPlayerIds: [],
    ...overrides,
  };
}

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p2',
    name: 'Test',
    x: 400, y: 400,
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
    team: 0,
    ...overrides,
  };
}

describe('bulletHitsObstacle', () => {
  it('returns true when bullet is out of arena bounds', () => {
    const b = makeBullet({ x: -10, y: 400 });
    expect(bulletHitsObstacle(b)).toBe(true);
  });

  it('returns false when bullet is in open arena space', () => {
    // Far from all obstacles and boundaries
    const b = makeBullet({ x: 100, y: 100 });
    expect(bulletHitsObstacle(b)).toBe(false);
  });

  it('returns true when bullet hits a known obstacle', () => {
    // Center pillar at x:750, y:550, w:100, h:100 — center is at 800,600
    const b = makeBullet({ x: 800, y: 600 });
    expect(bulletHitsObstacle(b)).toBe(true);
  });
});

describe('bulletHitsPlayer', () => {
  it('detects hit when bullet overlaps player', () => {
    const b = makeBullet({ x: 400, y: 400, ownerId: 'p1' });
    const p = makePlayer({ id: 'p2', x: 400, y: 400 });
    expect(bulletHitsPlayer(b, p)).toBe(true);
  });

  it('does not hit the bullet owner', () => {
    const b = makeBullet({ x: 400, y: 400, ownerId: 'p1' });
    const p = makePlayer({ id: 'p1', x: 400, y: 400 });
    expect(bulletHitsPlayer(b, p)).toBe(false);
  });

  it('does not hit dead players', () => {
    const b = makeBullet({ x: 400, y: 400, ownerId: 'p1' });
    const p = makePlayer({ id: 'p2', x: 400, y: 400, isDead: true });
    expect(bulletHitsPlayer(b, p)).toBe(false);
  });

  it('does not hit already-hit players for non-piercing bullets', () => {
    const b = makeBullet({ x: 400, y: 400, ownerId: 'p1', hitPlayerIds: ['p2'] });
    const p = makePlayer({ id: 'p2', x: 400, y: 400 });
    expect(bulletHitsPlayer(b, p)).toBe(false);
  });
});

describe('playerPicksPowerup', () => {
  it('detects pickup when player overlaps powerup', () => {
    const p = makePlayer({ x: 400, y: 400 });
    const pu: PowerupEntity = { id: 'pu1', type: 'health', x: 400, y: 400, spawnedAt: 0 };
    expect(playerPicksPowerup(p, pu)).toBe(true);
  });

  it('returns false when player is far from powerup', () => {
    const p = makePlayer({ x: 400, y: 400 });
    const pu: PowerupEntity = { id: 'pu1', type: 'health', x: 600, y: 600, spawnedAt: 0 };
    expect(playerPicksPowerup(p, pu)).toBe(false);
  });
});

describe('resolvePlayerObstacles', () => {
  it('clamps player to arena boundaries', () => {
    const p = makePlayer({ x: -100, y: -100 });
    resolvePlayerObstacles(p);
    expect(p.x).toBeGreaterThanOrEqual(PLAYER_RADIUS);
    expect(p.y).toBeGreaterThanOrEqual(PLAYER_RADIUS);
  });

  it('keeps player inside arena upper bound', () => {
    const p = makePlayer({ x: ARENA_WIDTH + 100, y: ARENA_HEIGHT + 100 });
    resolvePlayerObstacles(p);
    expect(p.x).toBeLessThanOrEqual(ARENA_WIDTH - PLAYER_RADIUS);
    expect(p.y).toBeLessThanOrEqual(ARENA_HEIGHT - PLAYER_RADIUS);
  });
});

// ── Matchmaker Tests ───────────────────────────────────────
describe('Matchmaker', () => {
  it('enqueues players and broadcasts queue status', () => {
    const messages: Array<{ id: string; msg: object }> = [];
    const send = (id: string, msg: object) => messages.push({ id, msg });
    const mm = new Matchmaker(send);

    mm.enqueue('p1', 'Alice');
    expect(messages.some(m => m.id === 'p1' && (m.msg as { type: string }).type === 'queue_status')).toBe(true);
  });

  it('starts a game when two players are queued', () => {
    const messages: Array<{ id: string; msg: object }> = [];
    const send = (id: string, msg: object) => messages.push({ id, msg });
    const mm = new Matchmaker(send);

    mm.enqueue('p1', 'Alice');
    mm.enqueue('p2', 'Bob');

    const gameStarts = messages.filter(m => (m.msg as { type: string }).type === 'game_start');
    expect(gameStarts).toHaveLength(2);
  });

  it('dequeues a player correctly', () => {
    const messages: Array<{ id: string; msg: object }> = [];
    const send = (id: string, msg: object) => messages.push({ id, msg });
    const mm = new Matchmaker(send);

    mm.enqueue('p1', 'Alice');
    mm.dequeue('p1');

    // After dequeue, no game_start should fire even if another player joins
    mm.enqueue('p2', 'Bob');
    const gameStarts = messages.filter(m => (m.msg as { type: string }).type === 'game_start');
    expect(gameStarts).toHaveLength(0);
  });
});
