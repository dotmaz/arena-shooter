// ============================================================
// PixiJS Game Renderer
// ============================================================
import * as PIXI from 'pixi.js';
import {
  GameState, PlayerState, BulletState, PowerupEntity,
  ARENA_WIDTH, ARENA_HEIGHT, PLAYER_RADIUS, BULLET_RADIUS,
  POWERUP_RADIUS, OBSTACLES, WEAPONS, POWERUPS, WeaponType,
} from '../../../shared/game';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: number; size: number;
  alpha: number;
}

interface BulletTrail {
  x: number; y: number;
  alpha: number;
  color: number;
  size: number;
}

const TEAM_COLORS = [0x4488ff, 0xff4444];
const POWERUP_COLORS: Record<string, number> = {
  health: 0x44ff88, speed: 0x00ccff, damage: 0xff4444,
  shield: 0x8888ff, vampirism: 0xcc44ff, explosive: 0xff8800,
};

export class GameRenderer {
  app: PIXI.Application;
  private worldContainer!: PIXI.Container;
  private bgLayer!: PIXI.Container;
  private obstacleLayer!: PIXI.Container;
  private powerupLayer!: PIXI.Container;
  private bulletLayer!: PIXI.Container;
  private playerLayer!: PIXI.Container;
  private particleLayer!: PIXI.Container;
  private hudLayer!: PIXI.Container;

  private playerGfx: Map<string, PIXI.Container> = new Map();
  private bulletGfx: Map<string, PIXI.Container> = new Map();
  private powerupGfx: Map<string, PIXI.Container> = new Map();
  private particles: Particle[] = [];
  private bulletTrails: Map<string, BulletTrail[]> = new Map();

  private shakeX = 0;
  private shakeY = 0;
  private shakeDecay = 0;

  private minimapGfx!: PIXI.Graphics;
  private healthBar!: PIXI.Graphics;
  private healthText!: PIXI.Text;
  private killsText!: PIXI.Text;
  private timerText!: PIXI.Text;
  private weaponText!: PIXI.Text;
  private dashCooldownGfx!: PIXI.Graphics;
  private powerupIcons: PIXI.Text[] = [];

  private myId = '';
  private lastState: GameState | null = null;
  private tickRate = 60;

  constructor(canvas: HTMLCanvasElement) {
    this.app = new PIXI.Application();
    this.init(canvas);
  }

  private async init(canvas: HTMLCanvasElement): Promise<void> {
    await this.app.init({
      canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x0a0a14,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.buildScene();
    this.buildHUD();
    this.app.ticker.add(this.onTick);

    window.addEventListener('resize', this.onResize);
  }

  private buildScene(): void {
    this.worldContainer = new PIXI.Container();
    this.app.stage.addChild(this.worldContainer);

    this.bgLayer = new PIXI.Container();
    this.obstacleLayer = new PIXI.Container();
    this.powerupLayer = new PIXI.Container();
    this.bulletLayer = new PIXI.Container();
    this.playerLayer = new PIXI.Container();
    this.particleLayer = new PIXI.Container();
    this.hudLayer = new PIXI.Container();

    this.worldContainer.addChild(this.bgLayer);
    this.worldContainer.addChild(this.obstacleLayer);
    this.worldContainer.addChild(this.powerupLayer);
    this.worldContainer.addChild(this.bulletLayer);
    this.worldContainer.addChild(this.playerLayer);
    this.worldContainer.addChild(this.particleLayer);
    this.app.stage.addChild(this.hudLayer);

    this.drawArena();
  }

  private drawArena(): void {
    // Floor
    const floor = new PIXI.Graphics();
    floor.rect(0, 0, ARENA_WIDTH, ARENA_HEIGHT).fill({ color: 0x0d1117 });
    this.bgLayer.addChild(floor);

    // Grid lines
    const grid = new PIXI.Graphics();
    grid.setStrokeStyle({ width: 1, color: 0x1a2030, alpha: 0.6 });
    for (let x = 0; x <= ARENA_WIDTH; x += 80) {
      grid.moveTo(x, 0).lineTo(x, ARENA_HEIGHT);
    }
    for (let y = 0; y <= ARENA_HEIGHT; y += 80) {
      grid.moveTo(0, y).lineTo(ARENA_WIDTH, y);
    }
    grid.stroke();
    this.bgLayer.addChild(grid);

    // Sacred geometry overlay — golden ratio circles
    const geo = new PIXI.Graphics();
    geo.setStrokeStyle({ width: 1, color: 0xc8a84b, alpha: 0.08 });
    const cx = ARENA_WIDTH / 2, cy = ARENA_HEIGHT / 2;
    for (let r = 80; r <= 600; r += 80) {
      geo.circle(cx, cy, r).stroke();
    }
    // Intersecting circles
    geo.circle(cx - 200, cy, 300).stroke();
    geo.circle(cx + 200, cy, 300).stroke();
    geo.circle(cx, cy - 150, 300).stroke();
    geo.circle(cx, cy + 150, 300).stroke();
    this.bgLayer.addChild(geo);

    // Arena border
    const border = new PIXI.Graphics();
    border.setStrokeStyle({ width: 4, color: 0xc8a84b, alpha: 0.5 });
    border.rect(0, 0, ARENA_WIDTH, ARENA_HEIGHT).stroke();
    this.bgLayer.addChild(border);

    // Obstacles
    for (const obs of OBSTACLES) {
      const g = new PIXI.Graphics();
      // Shadow
      g.rect(obs.x + 4, obs.y + 4, obs.w, obs.h).fill({ color: 0x000000, alpha: 0.4 });
      // Body
      g.rect(obs.x, obs.y, obs.w, obs.h).fill({ color: 0x1c2840 });
      // Border
      g.setStrokeStyle({ width: 2, color: 0xc8a84b, alpha: 0.6 });
      g.rect(obs.x, obs.y, obs.w, obs.h).stroke();
      // Inner detail
      g.setStrokeStyle({ width: 1, color: 0xc8a84b, alpha: 0.2 });
      g.rect(obs.x + 4, obs.y + 4, obs.w - 8, obs.h - 8).stroke();
      this.obstacleLayer.addChild(g);
    }
  }

  private buildHUD(): void {
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // Health bar background
    const hbBg = new PIXI.Graphics();
    hbBg.roundRect(20, H - 60, 200, 20, 4).fill({ color: 0x111111 });
    hbBg.setStrokeStyle({ width: 1, color: 0xc8a84b, alpha: 0.5 });
    hbBg.roundRect(20, H - 60, 200, 20, 4).stroke();
    this.hudLayer.addChild(hbBg);

    this.healthBar = new PIXI.Graphics();
    this.hudLayer.addChild(this.healthBar);

    this.healthText = new PIXI.Text({ text: '100 HP', style: { fill: 0xffffff, fontSize: 12, fontFamily: 'Inter, sans-serif' } });
    this.healthText.position.set(24, H - 58);
    this.hudLayer.addChild(this.healthText);

    this.killsText = new PIXI.Text({ text: 'K: 0  D: 0', style: { fill: 0xc8a84b, fontSize: 14, fontFamily: 'Inter, sans-serif', fontWeight: 'bold' } });
    this.killsText.position.set(240, H - 62);
    this.hudLayer.addChild(this.killsText);

    this.timerText = new PIXI.Text({ text: '3:00', style: { fill: 0xffffff, fontSize: 22, fontFamily: 'Inter, sans-serif', fontWeight: 'bold' } });
    this.timerText.anchor.set(0.5, 0);
    this.timerText.position.set(W / 2, 16);
    this.hudLayer.addChild(this.timerText);

    this.weaponText = new PIXI.Text({ text: 'BLASTER', style: { fill: 0x00d4ff, fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 'bold' } });
    this.weaponText.position.set(20, H - 85);
    this.hudLayer.addChild(this.weaponText);

    this.dashCooldownGfx = new PIXI.Graphics();
    this.hudLayer.addChild(this.dashCooldownGfx);

    // Minimap
    this.minimapGfx = new PIXI.Graphics();
    this.minimapGfx.position.set(W - 170, H - 140);
    this.hudLayer.addChild(this.minimapGfx);
  }

  private onResize = (): void => {
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
    this.hudLayer.removeChildren();
    this.buildHUD();
  };

  setMyId(id: string): void { this.myId = id; }

  shake(intensity = 8): void {
    this.shakeX = (Math.random() - 0.5) * intensity;
    this.shakeY = (Math.random() - 0.5) * intensity;
    this.shakeDecay = 0.85;
  }

  spawnParticles(x: number, y: number, color: number, count = 8, speed = 200): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 1, maxLife: 1,
        color, size: 2 + Math.random() * 4,
        alpha: 1,
      });
    }
  }

  spawnMuzzleFlash(x: number, y: number, angle: number, color: number): void {
    for (let i = 0; i < 5; i++) {
      const spread = (Math.random() - 0.5) * 0.6;
      const spd = 300 + Math.random() * 200;
      this.particles.push({
        x, y,
        vx: Math.cos(angle + spread) * spd,
        vy: Math.sin(angle + spread) * spd,
        life: 0.3, maxLife: 0.3,
        color, size: 3 + Math.random() * 3,
        alpha: 1,
      });
    }
  }

  render(state: GameState, myId: string, interpolation: number): void {
    this.myId = myId;
    this.lastState = state;
    this.updatePlayers(state, interpolation);
    this.updateBullets(state);
    this.updatePowerups(state);
    this.updateHUD(state, myId);
    this.updateCamera(state, myId);
  }

  private updatePlayers(state: GameState, interp: number): void {
    const activeIds = new Set(Object.keys(state.players));

    // Remove stale
    for (const [id, gfx] of Array.from(this.playerGfx)) {
      if (!activeIds.has(id)) { this.playerLayer.removeChild(gfx); this.playerGfx.delete(id); }
    }

    for (const p of Object.values(state.players)) {
      if (p.isDead) {
        if (this.playerGfx.has(p.id)) {
          const g = this.playerGfx.get(p.id)!;
          g.alpha = 0;
        }
        continue;
      }

      let container = this.playerGfx.get(p.id);
      if (!container) {
        container = this.createPlayerSprite(p);
        this.playerLayer.addChild(container);
        this.playerGfx.set(p.id, container);
      }

      container.alpha = 1;
      container.x = p.x;
      container.y = p.y;
      container.rotation = p.angle;

      // Update color based on powerups
      const bodyGfx = container.getChildAt(0) as PIXI.Graphics;
      const isMe = p.id === this.myId;
      const baseColor = isMe ? 0xffffff : TEAM_COLORS[p.team];
      const shieldActive = p.activePowerups.some(ap => ap.type === 'shield');
      const damageActive = p.activePowerups.some(ap => ap.type === 'damage');

      // Shield ring
      const shieldRing = container.getChildAt(container.children.length - 1) as PIXI.Graphics;
      shieldRing.alpha = shieldActive ? 0.5 + Math.sin(Date.now() / 200) * 0.3 : 0;
    }
  }

  private createPlayerSprite(p: PlayerState): PIXI.Container {
    const container = new PIXI.Container();
    const isMe = p.id === this.myId;
    const color = isMe ? 0xffffff : TEAM_COLORS[p.team];

    // Body
    const body = new PIXI.Graphics();
    // Main body hexagon
    body.poly([
      -PLAYER_RADIUS, -PLAYER_RADIUS * 0.6,
      0, -PLAYER_RADIUS,
      PLAYER_RADIUS, -PLAYER_RADIUS * 0.6,
      PLAYER_RADIUS, PLAYER_RADIUS * 0.6,
      0, PLAYER_RADIUS,
      -PLAYER_RADIUS, PLAYER_RADIUS * 0.6,
    ]).fill({ color });
    // Inner detail
    body.setStrokeStyle({ width: 1.5, color: 0x000000, alpha: 0.4 });
    body.poly([
      -PLAYER_RADIUS * 0.5, -PLAYER_RADIUS * 0.3,
      0, -PLAYER_RADIUS * 0.5,
      PLAYER_RADIUS * 0.5, -PLAYER_RADIUS * 0.3,
      PLAYER_RADIUS * 0.5, PLAYER_RADIUS * 0.3,
      0, PLAYER_RADIUS * 0.5,
      -PLAYER_RADIUS * 0.5, PLAYER_RADIUS * 0.3,
    ]).stroke();
    container.addChild(body);

    // Gun barrel
    const gun = new PIXI.Graphics();
    gun.rect(PLAYER_RADIUS - 2, -3, 14, 6).fill({ color: 0x888888 });
    gun.rect(PLAYER_RADIUS + 10, -2, 4, 4).fill({ color: 0x555555 });
    container.addChild(gun);

    // Name label
    const label = new PIXI.Text({
      text: p.name,
      style: { fill: 0xffffff, fontSize: 11, fontFamily: 'Inter, sans-serif', dropShadow: { color: 0x000000, distance: 2, blur: 2 } }
    });
    label.anchor.set(0.5, 1);
    label.position.set(0, -PLAYER_RADIUS - 6);
    container.addChild(label);

    // HP bar
    const hpBg = new PIXI.Graphics();
    hpBg.rect(-PLAYER_RADIUS, PLAYER_RADIUS + 4, PLAYER_RADIUS * 2, 4).fill({ color: 0x333333 });
    container.addChild(hpBg);

    const hpBar = new PIXI.Graphics();
    hpBar.rect(-PLAYER_RADIUS, PLAYER_RADIUS + 4, PLAYER_RADIUS * 2 * (p.hp / p.maxHp), 4).fill({ color: 0x44ff88 });
    hpBar.name = 'hpBar';
    container.addChild(hpBar);

    // Shield ring
    const shieldRing = new PIXI.Graphics();
    shieldRing.setStrokeStyle({ width: 3, color: 0x8888ff });
    shieldRing.circle(0, 0, PLAYER_RADIUS + 6).stroke();
    shieldRing.alpha = 0;
    container.addChild(shieldRing);

    return container;
  }

  private updateBullets(state: GameState): void {
    const activeIds = new Set(state.bullets.map(b => b.id));

    for (const [id, gfx] of Array.from(this.bulletGfx)) {
      if (!activeIds.has(id)) { this.bulletLayer.removeChild(gfx); this.bulletGfx.delete(id); }
    }

    for (const b of state.bullets) {
      let container = this.bulletGfx.get(b.id);
      if (!container) {
        container = this.createBulletSprite(b);
        this.bulletLayer.addChild(container);
        this.bulletGfx.set(b.id, container);
      }
      container.x = b.x;
      container.y = b.y;
      container.rotation = Math.atan2(b.vy, b.vx);
    }
  }

  private createBulletSprite(b: BulletState): PIXI.Container {
    const container = new PIXI.Container();
    const wDef = WEAPONS[b.weapon];
    const color = wDef.color;

    const gfx = new PIXI.Graphics();

    if (b.weapon === 'railgun') {
      // Long piercing beam
      gfx.rect(-20, -2, 40, 4).fill({ color });
      gfx.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.5 });
      gfx.rect(-20, -2, 40, 4).stroke();
    } else if (b.weapon === 'shotgun') {
      gfx.circle(0, 0, 4).fill({ color });
    } else {
      gfx.rect(-6, -2, 12, 4).fill({ color });
      // Glow
      gfx.setStrokeStyle({ width: 2, color, alpha: 0.4 });
      gfx.rect(-6, -2, 12, 4).stroke();
    }
    container.addChild(gfx);
    return container;
  }

  private updatePowerups(state: GameState): void {
    const activeIds = new Set(state.powerups.map(p => p.id));

    for (const [id, gfx] of Array.from(this.powerupGfx)) {
      if (!activeIds.has(id)) { this.powerupLayer.removeChild(gfx); this.powerupGfx.delete(id); }
    }

    for (const pu of state.powerups) {
      let container = this.powerupGfx.get(pu.id);
      if (!container) {
        container = this.createPowerupSprite(pu);
        this.powerupLayer.addChild(container);
        this.powerupGfx.set(pu.id, container);
      }
      container.x = pu.x;
      container.y = pu.y;
      // Floating animation
      container.y += Math.sin(Date.now() / 600 + pu.x) * 4;
      container.rotation = Date.now() / 2000;
    }
  }

  private createPowerupSprite(pu: PowerupEntity): PIXI.Container {
    const container = new PIXI.Container();
    const color = POWERUP_COLORS[pu.type] ?? 0xffffff;

    const gfx = new PIXI.Graphics();
    // Outer ring
    gfx.setStrokeStyle({ width: 2, color, alpha: 0.8 });
    gfx.circle(0, 0, POWERUP_RADIUS).stroke();
    // Inner fill
    gfx.circle(0, 0, POWERUP_RADIUS - 4).fill({ color, alpha: 0.3 });
    // Diamond shape
    gfx.poly([0, -10, 10, 0, 0, 10, -10, 0]).fill({ color });
    container.addChild(gfx);

    const label = new PIXI.Text({
      text: POWERUPS[pu.type].icon,
      style: { fontSize: 14, fontFamily: 'sans-serif' }
    });
    label.anchor.set(0.5);
    container.addChild(label);

    return container;
  }

  private updateHUD(state: GameState, myId: string): void {
    const me = state.players[myId];
    if (!me) return;

    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // Health bar
    this.healthBar.clear();
    const hpPct = me.hp / me.maxHp;
    const hpColor = hpPct > 0.5 ? 0x44ff88 : hpPct > 0.25 ? 0xffaa00 : 0xff3333;
    this.healthBar.roundRect(20, H - 60, 200 * hpPct, 20, 4).fill({ color: hpColor });
    this.healthText.text = `${Math.ceil(me.hp)} HP`;
    this.healthText.position.set(24, H - 58);

    // Kills/Deaths
    this.killsText.text = `K: ${me.kills}  D: ${me.deaths}`;
    this.killsText.position.set(240, H - 62);

    // Timer
    const ticksLeft = Math.max(0, state.matchEndTick - state.tick);
    const secsLeft = Math.ceil(ticksLeft / 60);
    const mins = Math.floor(secsLeft / 60);
    const secs = secsLeft % 60;
    this.timerText.text = `${mins}:${secs.toString().padStart(2, '0')}`;
    this.timerText.position.set(W / 2, 16);

    // Weapon
    this.weaponText.text = me.weapon.toUpperCase();
    this.weaponText.style.fill = WEAPONS[me.weapon].color;
    this.weaponText.position.set(20, H - 85);

    // Dash cooldown arc
    this.dashCooldownGfx.clear();
    const dashPct = 1 - me.dashCooldownTicks / 90;
    this.dashCooldownGfx.setStrokeStyle({ width: 3, color: 0x00ccff, alpha: 0.8 });
    this.dashCooldownGfx.arc(350, H - 50, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dashPct);
    this.dashCooldownGfx.stroke();
    this.dashCooldownGfx.setStrokeStyle({ width: 1, color: 0x333333 });
    this.dashCooldownGfx.circle(350, H - 50, 14).stroke();

    // Minimap
    this.drawMinimap(state, myId);
  }

  private drawMinimap(state: GameState, myId: string): void {
    const g = this.minimapGfx;
    g.clear();
    const W = this.app.screen.width;
    const H = this.app.screen.height;
    const mmW = 150, mmH = 110;
    const scaleX = mmW / ARENA_WIDTH;
    const scaleY = mmH / ARENA_HEIGHT;

    g.position.set(W - mmW - 20, H - mmH - 20);

    // Background
    g.rect(0, 0, mmW, mmH).fill({ color: 0x0a0a14, alpha: 0.8 });
    g.setStrokeStyle({ width: 1, color: 0xc8a84b, alpha: 0.5 });
    g.rect(0, 0, mmW, mmH).stroke();

    // Obstacles
    for (const obs of OBSTACLES) {
      g.rect(obs.x * scaleX, obs.y * scaleY, obs.w * scaleX, obs.h * scaleY).fill({ color: 0x1c2840 });
    }

    // Players
    for (const p of Object.values(state.players)) {
      if (p.isDead) continue;
      const isMe = p.id === myId;
      const color = isMe ? 0xffffff : TEAM_COLORS[p.team];
      g.circle(p.x * scaleX, p.y * scaleY, isMe ? 4 : 3).fill({ color });
    }

    // Powerups
    for (const pu of state.powerups) {
      const color = POWERUP_COLORS[pu.type] ?? 0xffffff;
      g.circle(pu.x * scaleX, pu.y * scaleY, 3).fill({ color });
    }
  }

  private updateCamera(state: GameState, myId: string): void {
    const me = state.players[myId];
    if (!me) return;

    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // Screen shake
    if (Math.abs(this.shakeX) > 0.1) {
      this.shakeX *= this.shakeDecay;
      this.shakeY *= this.shakeDecay;
    } else {
      this.shakeX = 0; this.shakeY = 0;
    }

    const targetX = W / 2 - me.x + this.shakeX;
    const targetY = H / 2 - me.y + this.shakeY;

    // Clamp camera
    const minX = W - ARENA_WIDTH;
    const minY = H - ARENA_HEIGHT;
    this.worldContainer.x = Math.max(minX, Math.min(0, targetX));
    this.worldContainer.y = Math.max(minY, Math.min(0, targetY));
  }

  private onTick = (ticker: PIXI.Ticker): void => {
    const dt = ticker.deltaMS / 1000;
    this.updateParticles(dt);
  };

  private updateParticles(dt: number): void {
    const gfx = new PIXI.Graphics();
    this.particleLayer.removeChildren();

    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
      p.alpha = p.life / p.maxLife;
      return p.life > 0;
    });

    for (const p of this.particles) {
      gfx.circle(p.x, p.y, p.size * p.alpha).fill({ color: p.color, alpha: p.alpha });
    }
    gfx.stroke();
    this.particleLayer.addChild(gfx);
  }

  getWorldPosition(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: screenX - this.worldContainer.x,
      y: screenY - this.worldContainer.y,
    };
  }

  getScreenPosition(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX + this.worldContainer.x,
      y: worldY + this.worldContainer.y,
    };
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.app.destroy();
  }
}
