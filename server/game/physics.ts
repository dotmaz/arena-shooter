// ============================================================
// Server-side physics & collision helpers
// ============================================================
import {
  ARENA_WIDTH, ARENA_HEIGHT, PLAYER_RADIUS, BULLET_RADIUS,
  POWERUP_RADIUS, OBSTACLES, Obstacle, Vec2, PlayerState, BulletState, PowerupEntity,
} from '../../shared/game';

export function rectCircleCollide(
  rx: number, ry: number, rw: number, rh: number,
  cx: number, cy: number, cr: number,
): boolean {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < cr * cr;
}

export function circleCircleCollide(
  ax: number, ay: number, ar: number,
  bx: number, by: number, br: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < (ar + br) * (ar + br);
}

export function resolvePlayerObstacles(p: PlayerState): void {
  for (const obs of OBSTACLES) {
    if (!rectCircleCollide(obs.x, obs.y, obs.w, obs.h, p.x, p.y, PLAYER_RADIUS)) continue;

    // Push player out of obstacle
    const nearX = Math.max(obs.x, Math.min(p.x, obs.x + obs.w));
    const nearY = Math.max(obs.y, Math.min(p.y, obs.y + obs.h));
    const dx = p.x - nearX;
    const dy = p.y - nearY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const overlap = PLAYER_RADIUS - dist;
    p.x += (dx / dist) * overlap;
    p.y += (dy / dist) * overlap;
  }
  // Arena boundary
  p.x = Math.max(PLAYER_RADIUS, Math.min(ARENA_WIDTH - PLAYER_RADIUS, p.x));
  p.y = Math.max(PLAYER_RADIUS, Math.min(ARENA_HEIGHT - PLAYER_RADIUS, p.y));
}

export function bulletHitsObstacle(b: BulletState): boolean {
  if (b.x < 0 || b.x > ARENA_WIDTH || b.y < 0 || b.y > ARENA_HEIGHT) return true;
  for (const obs of OBSTACLES) {
    if (rectCircleCollide(obs.x, obs.y, obs.w, obs.h, b.x, b.y, BULLET_RADIUS)) return true;
  }
  return false;
}

export function bulletHitsPlayer(b: BulletState, p: PlayerState): boolean {
  if (p.isDead) return false;
  if (b.ownerId === p.id) return false;
  if (b.hitPlayerIds.includes(p.id)) return false;
  return circleCircleCollide(b.x, b.y, BULLET_RADIUS, p.x, p.y, PLAYER_RADIUS);
}

export function playerPicksPowerup(p: PlayerState, pu: PowerupEntity): boolean {
  return circleCircleCollide(p.x, p.y, PLAYER_RADIUS, pu.x, pu.y, POWERUP_RADIUS);
}
