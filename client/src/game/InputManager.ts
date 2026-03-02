// ============================================================
// Input Manager — keyboard + mouse
// ============================================================
import { WeaponType } from '../../../shared/game';

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  dash: boolean;
  shooting: boolean;
  aimAngle: number;
  weapon: WeaponType;
  mouseX: number;
  mouseY: number;
}

export class InputManager {
  private keys = new Set<string>();
  private mouseDown = false;
  private mouseX = 0;
  private mouseY = 0;
  private weapon: WeaponType = 'blaster';
  private dashPressed = false;
  private canvas: HTMLCanvasElement | null = null;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('contextmenu', e => e.preventDefault());
  }

  attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
  }

  setWeapon(w: WeaponType): void { this.weapon = w; }

  consumeDash(): boolean {
    const v = this.dashPressed;
    this.dashPressed = false;
    return v;
  }

  getState(playerScreenX: number, playerScreenY: number): InputState {
    const aimAngle = Math.atan2(this.mouseY - playerScreenY, this.mouseX - playerScreenX);
    return {
      up: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
      down: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
      left: this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
      right: this.keys.has('KeyD') || this.keys.has('ArrowRight'),
      dash: this.consumeDash(),
      shooting: this.mouseDown,
      aimAngle,
      weapon: this.weapon,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
    };
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (e.code === 'Space') { e.preventDefault(); this.dashPressed = true; }
    if (e.code === 'Digit1') this.weapon = 'blaster';
    if (e.code === 'Digit2') this.weapon = 'shotgun';
    if (e.code === 'Digit3') this.weapon = 'railgun';
    if (e.code === 'Digit4') this.weapon = 'burst';
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = true;
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  };
}
