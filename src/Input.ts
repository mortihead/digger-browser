import { Digger } from "./Digger.ts";

/**
 * Состояние ввода: направление диггера, огонь, служебные клавиши.
 * Порт org.digger.app.Input. Привязка к браузерным событиям keydown/keyup
 * выполняется в точке входа.
 */
export class Input {
  private readonly dig: Digger;

  leftPressed = false;
  rightPressed = false;
  upPressed = false;
  downPressed = false;
  f1Pressed = false;
  firePressed = false;
  plusPressed = false;
  minusPressed = false;
  escape = false;

  lastKeyCode = 0;
  lastAsciiKeyCode = 0;
  dynamicDir = -1;
  staticDir = -1;
  keyDir = 0;
  firePressedFlag = false;
  joyFlag = false;

  constructor(d: Digger) {
    this.dig = d;
  }

  checkKeyboard(): void {
    if (this.plusPressed) {
      if (this.dig.frametime > Digger.MIN_RATE) this.dig.frametime -= 5;
      this.plusPressed = false;
    }
    if (this.minusPressed) {
      if (this.dig.frametime < Digger.MAX_RATE) this.dig.frametime += 5;
      this.minusPressed = false;
    }
  }

  detectJoystick(): void {
    this.joyFlag = false;
    this.staticDir = this.dynamicDir = -1;
  }

  getAsciiKey(make: number): number {
    const c = " ".charCodeAt(0);
    if (
      make === c ||
      (make >= 97 && make <= 122) || // a-z
      (make >= 65 && make <= 90) || // A-Z
      (make >= 48 && make <= 57) // 0-9
    )
      return make;
    return 0;
  }

  getDirection(): number {
    return this.keyDir;
  }

  initKeyboard(): void {}

  keyDownPressed(): void {
    this.downPressed = true;
    this.dynamicDir = this.staticDir = 6;
  }

  keyDownReleased(): void {
    this.downPressed = false;
    if (this.dynamicDir === 6) this.setDirection();
  }

  keyF1Pressed(): void {
    this.firePressed = true;
    this.f1Pressed = true;
  }

  keyF1Released(): void {
    this.f1Pressed = false;
  }

  keyLeftPressed(): void {
    this.leftPressed = true;
    this.dynamicDir = this.staticDir = 4;
  }

  keyLeftReleased(): void {
    this.leftPressed = false;
    if (this.dynamicDir === 4) this.setDirection();
  }

  keyRightPressed(): void {
    this.rightPressed = true;
    this.dynamicDir = this.staticDir = 0;
  }

  keyRightReleased(): void {
    this.rightPressed = false;
    if (this.dynamicDir === 0) this.setDirection();
  }

  keyUpPressed(): void {
    this.upPressed = true;
    this.dynamicDir = this.staticDir = 2;
  }

  keyUpReleased(): void {
    this.upPressed = false;
    if (this.dynamicDir === 2) this.setDirection();
  }

  processKey(key: number): void {
    this.lastKeyCode = key;
    this.lastAsciiKeyCode = key;
  }

  /**
   * Читает текущее направление из состояния ввода. Направление сохраняется,
   * пока клавиша удерживается, даже если диггер ещё не может повернуть.
   */
  readDirection(): void {
    if (this.dynamicDir !== -1) this.keyDir = this.dynamicDir;
    else {
      if (this.upPressed) this.keyDir = 2;
      else if (this.downPressed) this.keyDir = 6;
      else if (this.leftPressed) this.keyDir = 4;
      else if (this.rightPressed) this.keyDir = 0;
      else this.keyDir = -1;
    }
    this.firePressedFlag = this.f1Pressed || this.firePressed;
    this.firePressed = false;
  }

  setDirection(): void {
    this.dynamicDir = -1;
    if (this.upPressed) this.dynamicDir = this.staticDir = 2;
    if (this.downPressed) this.dynamicDir = this.staticDir = 6;
    if (this.leftPressed) this.dynamicDir = this.staticDir = 4;
    if (this.rightPressed) this.dynamicDir = this.staticDir = 0;
  }

  testStart(): boolean {
    if (this.lastKeyCode !== 0 && (this.lastKeyCode & 0x80) === 0 && this.lastKeyCode !== 27) {
      this.joyFlag = false;
      this.lastKeyCode = 0;
      return true;
    }
    return false;
  }
}
