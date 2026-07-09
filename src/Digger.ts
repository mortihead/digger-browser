import { CgaDisplay } from "./CgaDisplay.ts";
import { SpriteEngine } from "./SpriteEngine.ts";
import { Drawing } from "./Drawing.ts";
import { Main } from "./Main.ts";
import { Bags } from "./Bags.ts";
import { Monster } from "./Monster.ts";
import { Scores } from "./Scores.ts";
import { Sound } from "./Sound.ts";
import { Input } from "./Input.ts";

/**
 * Главный класс игры: игровой цикл, логика диггера, огонь, бонус-режим,
 * поле изумрудов и вывод на CGA-дисплей. Порт org.digger.app.Digger.
 *
 * Отличия от Java-версии: убрана AWT-обвязка окна (Frame, Canvas, BufferStrategy,
 * Preferences, потоки). Игровой цикл построен на async/await: newFrame() ожидает
 * следующего кадра через requestAnimationFrame с учётом frametime, сохраняя
 * блокирующую структуру оригинального кода.
 */
export class Digger {
  static readonly MAX_RATE = 200;
  static readonly MIN_RATE = 40;

  readonly width = 320;
  readonly height = 200;
  frametime = 66;

  running = false;

  readonly display: CgaDisplay;
  readonly sprite: SpriteEngine;
  readonly drawing: Drawing;
  readonly main: Main;
  readonly bags: Bags;
  readonly monster: Monster;
  readonly scores: Scores;
  readonly sound: Sound;
  readonly input: Input;

  // ----- Состояние диггера -----
  diggerx = 0;
  diggery = 0;
  diggerh = 0;
  diggerv = 0;
  diggerrx = 0;
  diggerry = 0;
  digmdir = 0;
  digdir = 0;
  digtime = 0;
  rechargetime = 0;
  firex = 0;
  firey = 0;
  firedir = 0;
  expsn = 0;
  deathstage = 0;
  deathbag = 0;
  deathani = 0;
  deathtime = 0;
  startbonustimeleft = 0;
  bonustimeleft = 0;
  monsterEatMultiplier = 0;
  emocttime = 0;

  emmask = 0;
  emfield = new Uint8Array(150);

  digOnScreen = false;
  notFiring = false;
  bonusVisible = false;
  bonusMode = false;
  diggerVisible = false;

  time = 0;
  ftime = 50;

  /** Смещения хит-бокса сбора изумруда по направлениям. */
  private readonly embox = [8, 12, 12, 9, 16, 12, 6, 9];
  /** Высоты дуги анимации смерти диггера (стадия 5). */
  private readonly deatharc = [3, 5, 6, 6, 5, 3, 0];

  constructor(canvas: HTMLCanvasElement) {
    this.display = new CgaDisplay(canvas);
    this.sprite = new SpriteEngine(this);
    this.drawing = new Drawing(this);
    this.main = new Main(this);
    this.bags = new Bags(this);
    this.monster = new Monster(this);
    this.scores = new Scores(this);
    this.sound = new Sound(this);
    this.input = new Input(this);
  }

  /** Запускает игру: восстанавливает частоту кадров и стартует главный цикл. */
  async start(): Promise<void> {
    this.running = true;
    await this.main.main();
  }

  isDiggerUnderBag(h: number, v: number): boolean {
    if (this.digmdir === 2 || this.digmdir === 6)
      if (Math.trunc((this.diggerx - 12) / 20) === h)
        if (
          Math.trunc((this.diggery - 18) / 18) === v ||
          Math.trunc((this.diggery - 18) / 18) + 1 === v
        )
          return true;
    return false;
  }

  countEmeralds(): number {
    let n = 0;
    for (let x = 0; x < 15; x++)
      for (let y = 0; y < 10; y++) if ((this.emfield[y * 15 + x] & this.emmask) !== 0) n++;
    return n;
  }

  createbonus(): void {
    this.bonusVisible = true;
    this.drawing.drawBonus(292, 18);
  }

  diggerdie(): void {
    let clbits: number;
    switch (this.deathstage) {
      case 1:
        if (this.bags.bagy(this.deathbag) + 6 > this.diggery) this.diggery = this.bags.bagy(this.deathbag) + 6;
        this.drawing.drawDigger(15, this.diggerx, this.diggery, false);
        this.main.incrementPenalty();
        if (this.bags.getbagdir(this.deathbag) + 1 === 0) {
          this.sound.soundDdie();
          this.deathtime = 5;
          this.deathstage = 2;
          this.deathani = 0;
          this.diggery -= 6;
        }
        break;
      case 2:
        if (this.deathtime !== 0) {
          this.deathtime--;
          break;
        }
        if (this.deathani === 0) this.sound.music(2);
        clbits = this.drawing.drawDigger(14 - this.deathani, this.diggerx, this.diggery, false);
        this.main.incrementPenalty();
        if (this.deathani === 0 && (clbits & 0x3f00) !== 0) this.monster.killmonsters(clbits);
        if (this.deathani < 4) {
          this.deathani++;
          this.deathtime = 2;
        } else {
          this.deathstage = 4;
          if (this.sound.musicFlag) this.deathtime = 60;
          else this.deathtime = 10;
        }
        break;
      case 3:
        this.deathstage = 5;
        this.deathani = 0;
        this.deathtime = 0;
        break;
      case 5:
        if (this.deathani >= 0 && this.deathani <= 6) {
          this.drawing.drawDigger(15, this.diggerx, this.diggery - this.deatharc[this.deathani], false);
          if (this.deathani === 6) this.sound.musicOff();
          this.main.incrementPenalty();
          this.deathani++;
          if (this.deathani === 1) this.sound.soundDdie();
          if (this.deathani === 7) {
            this.deathtime = 5;
            this.deathani = 0;
            this.deathstage = 2;
          }
        }
        break;
      case 4:
        if (this.deathtime !== 0) this.deathtime--;
        else this.main.setDead(true);
    }
  }

  async doDigger(): Promise<void> {
    await this.newFrame();
    if (this.expsn !== 0) this.drawexplosion();
    else this.updatefire();
    if (this.diggerVisible)
      if (this.digOnScreen)
        if (this.digtime !== 0) {
          this.drawing.drawDigger(this.digmdir, this.diggerx, this.diggery, this.notFiring && this.rechargetime === 0);
          this.main.incrementPenalty();
          this.digtime--;
        } else this.updatedigger();
      else this.diggerdie();
    if (this.bonusMode && this.digOnScreen) {
      if (this.bonustimeleft !== 0) {
        this.bonustimeleft--;
        if (this.startbonustimeleft !== 0 || this.bonustimeleft < 20) {
          this.startbonustimeleft--;
          if ((this.bonustimeleft & 1) !== 0) {
            this.display.setIntensity(1);
            this.sound.soundBonus();
          } else {
            this.display.setIntensity(0);
            this.sound.soundBonus();
          }
          if (this.startbonustimeleft === 0) {
            this.sound.music(0);
            this.sound.soundBonusOff();
            this.display.setIntensity(0);
          }
        }
      } else {
        this.endbonusmode();
        this.sound.soundBonusOff();
        this.sound.music(1);
      }
    }
    if (this.bonusMode && !this.digOnScreen) {
      this.endbonusmode();
      this.sound.soundBonusOff();
      this.sound.music(1);
    }
    if (this.emocttime > 0) this.emocttime--;
  }

  drawEmeralds(): void {
    this.emmask = 1 << this.main.getCurrentPlayer();
    for (let x = 0; x < 15; x++)
      for (let y = 0; y < 10; y++)
        if ((this.emfield[y * 15 + x] & this.emmask) !== 0) this.drawing.drawEmerald(x * 20 + 12, y * 18 + 21);
  }

  drawexplosion(): void {
    if (this.expsn >= 1 && this.expsn <= 3) {
      if (this.expsn === 1) this.sound.soundExplode();
      this.drawing.drawFire(this.firex, this.firey, this.expsn);
      this.main.incrementPenalty();
      this.expsn++;
    } else {
      this.killFire();
      this.expsn = 0;
    }
  }

  endbonusmode(): void {
    this.bonusMode = false;
    this.display.setIntensity(0);
  }

  eraseBonus(): void {
    if (this.bonusVisible) {
      this.bonusVisible = false;
      this.sprite.eraseSprite(14);
    }
    this.display.setIntensity(0);
  }

  eraseDigger(): void {
    this.sprite.eraseSprite(0);
    this.diggerVisible = false;
  }

  getfirepflag(): boolean {
    return this.input.firePressedFlag;
  }

  hitemerald(x: number, y: number, rx: number, ry: number, dir: number): boolean {
    let hit = false;
    let r: number;
    if (dir < 0 || dir > 6 || (dir & 1) !== 0) return hit;
    if (dir === 0 && rx !== 0) x++;
    if (dir === 6 && ry !== 0) y++;
    if (dir === 0 || dir === 4) r = rx;
    else r = ry;
    if ((this.emfield[y * 15 + x] & this.emmask) !== 0) {
      if (r === this.embox[dir]) {
        this.drawing.drawEmerald(x * 20 + 12, y * 18 + 21);
        this.main.incrementPenalty();
      }
      if (r === this.embox[dir + 1]) {
        this.drawing.eraseEmerald(x * 20 + 12, y * 18 + 21);
        this.main.incrementPenalty();
        hit = true;
        this.emfield[y * 15 + x] &= ~this.emmask;
      }
    }
    return hit;
  }

  initbonusmode(): void {
    this.bonusMode = true;
    this.eraseBonus();
    this.display.setIntensity(1);
    this.bonustimeleft = 250 - this.main.getLevelNumberClampedToTen() * 20;
    this.startbonustimeleft = 20;
    this.monsterEatMultiplier = 1;
  }

  initDigger(): void {
    this.diggerv = 9;
    this.digmdir = 4;
    this.diggerh = 7;
    this.diggerx = this.diggerh * 20 + 12;
    this.digdir = 0;
    this.diggerrx = 0;
    this.diggerry = 0;
    this.digtime = 0;
    this.digOnScreen = true;
    this.deathstage = 1;
    this.diggerVisible = true;
    this.diggery = this.diggerv * 18 + 18;
    this.sprite.moveDrawSprite(0, this.diggerx, this.diggery);
    this.notFiring = true;
    this.emocttime = 0;
    this.bonusVisible = this.bonusMode = false;
    this.input.firePressed = false;
    this.expsn = 0;
    this.rechargetime = 0;
  }

  killdigger(stage: number, bag: number): void {
    if (this.deathstage < 2 || this.deathstage > 4) {
      this.digOnScreen = false;
      this.deathstage = stage;
      this.deathbag = bag;
    }
  }

  killemerald(x: number, y: number): void {
    if ((this.emfield[y * 15 + x + 15] & this.emmask) !== 0) {
      this.emfield[y * 15 + x + 15] &= ~this.emmask;
      this.drawing.eraseEmerald(x * 20 + 12, (y + 1) * 18 + 21);
    }
  }

  killFire(): void {
    if (!this.notFiring) {
      this.notFiring = true;
      this.sprite.eraseSprite(15);
      this.sound.soundFireOff();
    }
  }

  makeEmeraldField(): void {
    this.emmask = 1 << this.main.getCurrentPlayer();
    for (let x = 0; x < 15; x++)
      for (let y = 0; y < 10; y++)
        if (this.main.getLevelChar(x, y, this.main.getLevelPlan()) === "C".charCodeAt(0))
          this.emfield[y * 15 + x] |= this.emmask;
        else this.emfield[y * 15 + x] &= ~this.emmask;
  }

  /** Ожидает следующий игровой кадр (замена Thread.sleep игрового цикла). */
  async newFrame(): Promise<void> {
    this.input.checkKeyboard();
    this.time += this.frametime;
    this.display.render();
    await this.waitUntil(this.time);
  }

  private waitUntil(target: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.running) {
        resolve();
        return;
      }
      const delay = target - this.display.getCurrentTimeMillis();
      // setTimeout вместо requestAnimationFrame: даёт корректный фиксированный шаг
      // frametime независимо от частоты монитора и продолжает тикать в фоне.
      setTimeout(resolve, delay > 0 ? delay : 0);
    });
  }

  reversedir(dir: number): number {
    switch (dir) {
      case 0:
        return 4;
      case 4:
        return 0;
      case 2:
        return 6;
      case 6:
        return 2;
    }
    return dir;
  }

  updatedigger(): void {
    let ddir: number;
    let push = false;
    this.input.readDirection();
    const dir = this.input.getDirection();
    if (dir === 0 || dir === 2 || dir === 4 || dir === 6) ddir = dir;
    else ddir = -1;
    if (this.diggerrx === 0 && (ddir === 2 || ddir === 6)) this.digdir = this.digmdir = ddir;
    if (this.diggerry === 0 && (ddir === 4 || ddir === 0)) this.digdir = this.digmdir = ddir;
    if (dir === -1) this.digmdir = -1;
    else if (this.digmdir === -1 && ddir === -1) this.digmdir = -1;
    else if (this.digmdir === -1) this.digmdir = this.digdir;
    if (
      (this.diggerx === 292 && this.digmdir === 0) ||
      (this.diggerx === 12 && this.digmdir === 4) ||
      (this.diggery === 180 && this.digmdir === 6) ||
      (this.diggery === 18 && this.digmdir === 2)
    )
      this.digmdir = -1;
    const diggerox = this.diggerx;
    const diggeroy = this.diggery;
    if (this.digmdir !== -1) this.drawing.digTunnel(diggerox, diggeroy, this.digmdir);
    switch (this.digmdir) {
      case 0:
        this.drawing.drawTunnelEdgeRight(this.diggerx, this.diggery);
        this.diggerx += 4;
        break;
      case 4:
        this.drawing.drawTunnelEdgeLeft(this.diggerx, this.diggery);
        this.diggerx -= 4;
        break;
      case 2:
        this.drawing.drawTunnelEdgeTop(this.diggerx, this.diggery);
        this.diggery -= 3;
        break;
      case 6:
        this.drawing.drawTunnelEdgeBottom(this.diggerx, this.diggery);
        this.diggery += 3;
        break;
    }
    if (
      this.hitemerald(
        Math.trunc((this.diggerx - 12) / 20),
        Math.trunc((this.diggery - 18) / 18),
        (this.diggerx - 12) % 20,
        (this.diggery - 18) % 18,
        this.digmdir,
      )
    ) {
      this.scores.scoreEmerald();
      this.sound.soundEm();
      this.sound.soundEmerald(this.emocttime);
      this.emocttime = 9;
    }
    const clbits = this.drawing.drawDigger(this.digdir, this.diggerx, this.diggery, this.notFiring && this.rechargetime === 0);
    this.main.incrementPenalty();
    if ((this.bags.bagbits() & clbits) !== 0) {
      if (this.digmdir === 0 || this.digmdir === 4) {
        push = this.bags.pushbags(this.digmdir, clbits);
        this.digtime++;
      } else if (!this.bags.pushudbags(clbits)) push = false;
      if (!push) {
        this.diggerx = diggerox;
        this.diggery = diggeroy;
        if (this.digmdir === 2) this.diggery = Math.trunc((this.diggery - 18 + 17) / 18) * 18 + 18;
        else if (this.digmdir === 6) this.diggery = Math.trunc((this.diggery - 18) / 18) * 18 + 18;
        if (this.digmdir === 4) this.diggerx = Math.trunc((this.diggerx - 12 + 19) / 20) * 20 + 12;
        else if (this.digmdir === 0) this.diggerx = Math.trunc((this.diggerx - 12) / 20) * 20 + 12;
        this.drawing.drawDigger(this.digmdir, this.diggerx, this.diggery, this.notFiring && this.rechargetime === 0);
        this.main.incrementPenalty();
        this.digdir = this.reversedir(this.digmdir);
      }
    }
    if ((clbits & 0x3f00) !== 0 && this.bonusMode)
      for (let nmon = this.monster.killmonsters(clbits); nmon !== 0; nmon--) {
        this.sound.soundEatm();
        this.scores.scoreEatMonster();
      }
    if ((clbits & 0x4000) !== 0) {
      this.scores.scoreBonus();
      this.initbonusmode();
    }
    this.diggerh = Math.trunc((this.diggerx - 12) / 20);
    this.diggerrx = (this.diggerx - 12) % 20;
    this.diggerv = Math.trunc((this.diggery - 18) / 18);
    this.diggerry = (this.diggery - 18) % 18;
  }

  updatefire(): void {
    let clbits: number;
    let pix = 0;
    if (this.notFiring) {
      if (this.rechargetime !== 0) this.rechargetime--;
      else if (this.getfirepflag())
        if (this.digOnScreen) {
          this.rechargetime = this.main.getLevelNumberClampedToTen() * 3 + 60;
          this.notFiring = false;
          switch (this.digdir) {
            case 0:
              this.firex = this.diggerx + 8;
              this.firey = this.diggery + 4;
              break;
            case 4:
              this.firex = this.diggerx;
              this.firey = this.diggery + 4;
              break;
            case 2:
              this.firex = this.diggerx + 4;
              this.firey = this.diggery;
              break;
            case 6:
              this.firex = this.diggerx + 4;
              this.firey = this.diggery + 8;
          }
          this.firedir = this.digdir;
          this.sprite.moveDrawSprite(15, this.firex, this.firey);
          this.sound.soundFire();
        }
    } else {
      switch (this.firedir) {
        case 0:
          this.firex += 8;
          pix = this.display.getPixel(this.firex, this.firey + 4) | this.display.getPixel(this.firex + 4, this.firey + 4);
          break;
        case 4:
          this.firex -= 8;
          pix = this.display.getPixel(this.firex, this.firey + 4) | this.display.getPixel(this.firex + 4, this.firey + 4);
          break;
        case 2:
          this.firey -= 7;
          pix =
            (this.display.getPixel(this.firex + 4, this.firey) |
              this.display.getPixel(this.firex + 4, this.firey + 1) |
              this.display.getPixel(this.firex + 4, this.firey + 2) |
              this.display.getPixel(this.firex + 4, this.firey + 3) |
              this.display.getPixel(this.firex + 4, this.firey + 4) |
              this.display.getPixel(this.firex + 4, this.firey + 5) |
              this.display.getPixel(this.firex + 4, this.firey + 6)) &
            0xc0;
          break;
        case 6:
          this.firey += 7;
          pix =
            (this.display.getPixel(this.firex, this.firey) |
              this.display.getPixel(this.firex, this.firey + 1) |
              this.display.getPixel(this.firex, this.firey + 2) |
              this.display.getPixel(this.firex, this.firey + 3) |
              this.display.getPixel(this.firex, this.firey + 4) |
              this.display.getPixel(this.firex, this.firey + 5) |
              this.display.getPixel(this.firex, this.firey + 6)) &
            3;
          break;
      }
      clbits = this.drawing.drawFire(this.firex, this.firey, 0);
      this.main.incrementPenalty();
      if ((clbits & 0x3f00) !== 0)
        for (let mon = 0, b = 256; mon < 6; mon++, b <<= 1)
          if ((clbits & b) !== 0) {
            this.monster.killMonster(mon);
            this.scores.scoreKillMonster();
            this.expsn = 1;
          }
      if ((clbits & 0x40fe) !== 0) this.expsn = 1;
      switch (this.firedir) {
        case 0:
          if (this.firex > 296) this.expsn = 1;
          else if (pix !== 0 && clbits === 0) {
            this.expsn = 1;
            this.firex -= 8;
            this.drawing.drawFire(this.firex, this.firey, 0);
          }
          break;
        case 4:
          if (this.firex < 16) this.expsn = 1;
          else if (pix !== 0 && clbits === 0) {
            this.expsn = 1;
            this.firex += 8;
            this.drawing.drawFire(this.firex, this.firey, 0);
          }
          break;
        case 2:
          if (this.firey < 15) this.expsn = 1;
          else if (pix !== 0 && clbits === 0) {
            this.expsn = 1;
            this.firey += 7;
            this.drawing.drawFire(this.firex, this.firey, 0);
          }
          break;
        case 6:
          if (this.firey > 183) this.expsn = 1;
          else if (pix !== 0 && clbits === 0) {
            this.expsn = 1;
            this.firey -= 7;
            this.drawing.drawFire(this.firex, this.firey, 0);
          }
      }
    }
  }

  // ----- Обработка клавиатуры (браузерные события) -----

  /** Обрабатывает нажатие клавиши. Возвращает true, если клавиша игровая (нужен preventDefault). */
  keyDown(key: string): boolean {
    switch (key) {
      case "ArrowUp":
        this.input.keyUpPressed();
        return true;
      case "ArrowDown":
        this.input.keyDownPressed();
        return true;
      case "ArrowLeft":
        this.input.keyLeftPressed();
        return true;
      case "ArrowRight":
        this.input.keyRightPressed();
        return true;
      case "F1":
        this.input.keyF1Pressed();
        return true;
      case "F7":
        this.sound.musicFlag = !this.sound.musicFlag;
        if (this.sound.musicFlag && !this.sound.musicPlaying && this.sound.soundFlag) this.sound.music(this.sound.tuneno);
        return true;
      case "F9":
        this.sound.soundFlag = !this.sound.soundFlag;
        return true;
      case "F10":
        this.input.escape = true;
        return true;
      case "+":
      case "=":
        this.input.plusPressed = true;
        return true;
      case "-":
        this.input.minusPressed = true;
        return true;
      case "Escape":
        this.input.processKey(27);
        return true;
      case "Enter":
        this.input.processKey(13);
        return true;
      case " ":
        this.input.processKey(32);
        return true;
      default:
        if (key.length === 1) this.input.processKey(key.toUpperCase().charCodeAt(0));
        return false;
    }
  }

  /** Обрабатывает отпускание клавиши. */
  keyUp(key: string): void {
    switch (key) {
      case "ArrowUp":
        this.input.keyUpReleased();
        break;
      case "ArrowDown":
        this.input.keyDownReleased();
        break;
      case "ArrowLeft":
        this.input.keyLeftReleased();
        break;
      case "ArrowRight":
        this.input.keyRightReleased();
        break;
      case "F1":
        this.input.keyF1Released();
        break;
      case "+":
      case "=":
        this.input.plusPressed = false;
        break;
      case "-":
        this.input.minusPressed = false;
        break;
    }
  }
}
