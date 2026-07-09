import type { Digger } from "./Digger.ts";
import { BagState } from "./BagState.ts";

/**
 * Управление мешками золота: размещение, падение, качание, толкание, сбор золота.
 * Одновременно до 7 мешков (индексы 1-7). Порт org.digger.app.Bags.
 */
export class Bags {
  private static readonly MAX_BAGS = 8; // размер массива (индекс 0 не используется)
  private static readonly GOLD_BASE_TIME = 150;

  private readonly dig: Digger;

  /** Снимки состояния мешков для режима 2 игроков. */
  bagdat1: BagState[] = [];
  bagdat2: BagState[] = [];
  bagdat: BagState[] = [];

  pushCount = 0;
  goldTime = 0;

  /** Индексы кадров качания: неподвижно, влево, неподвижно, вправо. */
  private readonly wobbleAnim = [2, 0, 1, 0];

  constructor(d: Digger) {
    this.dig = d;
    for (let i = 0; i < Bags.MAX_BAGS; i++) {
      this.bagdat[i] = new BagState();
      this.bagdat1[i] = new BagState();
      this.bagdat2[i] = new BagState();
    }
  }

  /** Возвращает битовую маску существующих мешков (биты 1-7). */
  bagbits(): number {
    let bags = 0;
    for (let bag = 1, bit = 2; bag < Bags.MAX_BAGS; bag++, bit <<= 1)
      if (this.bagdat[bag].exist) bags |= bit;
    return bags;
  }

  /** Вызывается, когда падающий мешок ударяется о землю. */
  baghitground(bag: number): void {
    if (this.bagdat[bag].direction === 6 && this.bagdat[bag].fallHeight > 1) this.bagdat[bag].goldTime = 1;
    else this.bagdat[bag].fallHeight = 0;
    this.bagdat[bag].direction = -1;
    this.bagdat[bag].wobbleTime = 15;
    this.bagdat[bag].wobbling = false;
    const clbits = this.dig.drawing.drawGold(bag, 0, this.bagdat[bag].x, this.bagdat[bag].y);
    this.dig.main.incrementPenalty();
    for (let bn = 1, b = 2; bn < Bags.MAX_BAGS; bn++, b <<= 1) if ((b & clbits) !== 0) this.removebag(bn);
  }

  bagy(bag: number): number {
    return this.bagdat[bag].y;
  }

  /** Сохраняет состояние мешков текущего игрока и убирает отвалившиеся. */
  cleanupBags(): void {
    this.dig.sound.soundFallOff();
    for (let bpa = 1; bpa < Bags.MAX_BAGS; bpa++) {
      if (
        this.bagdat[bpa].exist &&
        ((this.bagdat[bpa].h === 7 && this.bagdat[bpa].v === 9) ||
          this.bagdat[bpa].xr !== 0 ||
          this.bagdat[bpa].yr !== 0 ||
          this.bagdat[bpa].goldTime !== 0 ||
          this.bagdat[bpa].fallHeight !== 0 ||
          this.bagdat[bpa].wobbling)
      ) {
        this.bagdat[bpa].exist = false;
        this.dig.sprite.eraseSprite(bpa);
      }
      if (this.dig.main.getCurrentPlayer() === 0) this.bagdat1[bpa].copyFrom(this.bagdat[bpa]);
      else this.bagdat2[bpa].copyFrom(this.bagdat[bpa]);
    }
  }

  /** Покадровое обновление всех мешков. */
  doBags(): void {
    let soundFallOff = true;
    let soundWobbleOff = true;
    for (let bag = 1; bag < Bags.MAX_BAGS; bag++)
      if (this.bagdat[bag].exist) {
        if (this.bagdat[bag].goldTime !== 0) {
          if (this.bagdat[bag].goldTime === 1) {
            this.dig.sound.soundBreak();
            this.dig.drawing.drawGold(bag, 4, this.bagdat[bag].x, this.bagdat[bag].y);
            this.dig.main.incrementPenalty();
          }
          if (this.bagdat[bag].goldTime === 3) {
            this.dig.drawing.drawGold(bag, 5, this.bagdat[bag].x, this.bagdat[bag].y);
            this.dig.main.incrementPenalty();
          }
          if (this.bagdat[bag].goldTime === 5) {
            this.dig.drawing.drawGold(bag, 6, this.bagdat[bag].x, this.bagdat[bag].y);
            this.dig.main.incrementPenalty();
          }
          this.bagdat[bag].goldTime++;
          if (this.bagdat[bag].goldTime === this.goldTime) this.removebag(bag);
          else if (this.bagdat[bag].v < 9 && this.bagdat[bag].goldTime < this.goldTime - 10)
            if ((this.dig.monster.getfield(this.bagdat[bag].h, this.bagdat[bag].v + 1) & 0x2000) === 0)
              this.bagdat[bag].goldTime = this.goldTime - 10;
        } else this.updatebag(bag);
      }
    for (let bag = 1; bag < Bags.MAX_BAGS; bag++) {
      if (this.bagdat[bag].direction === 6 && this.bagdat[bag].exist) soundFallOff = false;
      if (this.bagdat[bag].direction !== 6 && this.bagdat[bag].wobbling && this.bagdat[bag].exist)
        soundWobbleOff = false;
    }
    if (soundFallOff) this.dig.sound.soundFallOff();
    if (soundWobbleOff) this.dig.sound.soundWobbleOff();
  }

  /** Восстанавливает мешки из снимка текущего игрока и рисует их. */
  drawBags(): void {
    for (let bag = 1; bag < Bags.MAX_BAGS; bag++) {
      if (this.dig.main.getCurrentPlayer() === 0) this.bagdat[bag].copyFrom(this.bagdat1[bag]);
      else this.bagdat[bag].copyFrom(this.bagdat2[bag]);
      if (this.bagdat[bag].exist) this.dig.sprite.moveDrawSprite(bag, this.bagdat[bag].x, this.bagdat[bag].y);
    }
  }

  getbagdir(bag: number): number {
    if (this.bagdat[bag].exist) return this.bagdat[bag].direction;
    return -1;
  }

  /** Собирает золото из разбитого мешка. */
  getgold(bag: number): void {
    const clbits = this.dig.drawing.drawGold(bag, 6, this.bagdat[bag].x, this.bagdat[bag].y);
    this.dig.main.incrementPenalty();
    if ((clbits & 1) !== 0) {
      this.dig.scores.scoreGold();
      this.dig.sound.soundGold();
      this.dig.digtime = 0;
    } else this.dig.monster.monsterGotGold();
    this.removebag(bag);
  }

  /** Считает мешки, которые сейчас движутся (падают или качаются). */
  getMovingBagsCount(): number {
    let n = 0;
    for (let bag = 1; bag < Bags.MAX_BAGS; bag++)
      if (
        this.bagdat[bag].exist &&
        this.bagdat[bag].goldTime < 10 &&
        (this.bagdat[bag].goldTime !== 0 || this.bagdat[bag].wobbling)
      )
        n++;
    return n;
  }

  /** Размещает мешки на поле согласно плану уровня. */
  initBags(): void {
    this.pushCount = 0;
    this.goldTime = Bags.GOLD_BASE_TIME - this.dig.main.getLevelNumberClampedToTen() * 10;
    for (let bag = 1; bag < Bags.MAX_BAGS; bag++) this.bagdat[bag].exist = false;
    let bag = 1;
    for (let x = 0; x < 15; x++)
      for (let y = 0; y < 10; y++)
        if (this.dig.main.getLevelChar(x, y, this.dig.main.getLevelPlan()) === "B".charCodeAt(0))
          if (bag < Bags.MAX_BAGS) {
            const b = this.bagdat[bag];
            b.exist = true;
            b.goldTime = 0;
            b.fallHeight = 0;
            b.direction = -1;
            b.wobbling = false;
            b.wobbleTime = 15;
            b.unfallen = true;
            b.x = x * 20 + 12;
            b.y = y * 18 + 18;
            b.h = x;
            b.v = y;
            b.xr = 0;
            b.yr = 0;
            bag++;
          }
    if (this.dig.main.getCurrentPlayer() === 0)
      for (let i = 1; i < Bags.MAX_BAGS; i++) this.bagdat1[i].copyFrom(this.bagdat[i]);
    else for (let i = 1; i < Bags.MAX_BAGS; i++) this.bagdat2[i].copyFrom(this.bagdat[i]);
  }

  /** Пытается толкнуть мешок в заданном направлении. Возвращает true при успехе. */
  pushbag(bag: number, dir: number): boolean {
    let push = true;
    const ox = (this.bagdat[bag].x);
    const oy = (this.bagdat[bag].y);
    let x = ox;
    let y = oy;
    const h = this.bagdat[bag].h;
    const v = this.bagdat[bag].v;
    let clbits: number;
    if (this.bagdat[bag].goldTime !== 0) {
      this.getgold(bag);
      return true;
    }
    if (this.bagdat[bag].direction === 6 && (dir === 4 || dir === 0)) {
      clbits = this.dig.drawing.drawGold(bag, 3, x, y);
      this.dig.main.incrementPenalty();
      if ((clbits & 1) !== 0 && this.dig.diggery >= y) this.dig.killdigger(1, bag);
      if ((clbits & 0x3f00) !== 0) this.dig.monster.squashmonsters(bag, clbits);
      return true;
    }
    if ((x === 292 && dir === 0) || (x === 12 && dir === 4) || (y === 180 && dir === 6) || (y === 18 && dir === 2))
      push = false;
    if (push) {
      switch (dir) {
        case 0:
          x += 4;
          break;
        case 4:
          x -= 4;
          break;
        case 6:
          if (this.bagdat[bag].unfallen) {
            this.bagdat[bag].unfallen = false;
            this.dig.drawing.drawBagGroundCrack(x, y);
            this.dig.drawing.drawTunnelEdgeTop(x, y + 21);
          } else this.dig.drawing.drawBagFallDebris(x, y);
          this.dig.drawing.digTunnel(x, y, dir);
          this.dig.killemerald(h, v);
          y += 6;
      }
      switch (dir) {
        case 6:
          clbits = this.dig.drawing.drawGold(bag, 3, x, y);
          this.dig.main.incrementPenalty();
          if ((clbits & 1) !== 0 && this.dig.diggery >= y) this.dig.killdigger(1, bag);
          if ((clbits & 0x3f00) !== 0) this.dig.monster.squashmonsters(bag, clbits);
          break;
        case 0:
        case 4:
          this.bagdat[bag].wobbleTime = 15;
          this.bagdat[bag].wobbling = false;
          clbits = this.dig.drawing.drawGold(bag, 0, x, y);
          this.dig.main.incrementPenalty();
          this.pushCount = 1;
          if ((clbits & 0xfe) !== 0)
            if (!this.pushbags(dir, clbits)) {
              x = ox;
              y = oy;
              this.dig.drawing.drawGold(bag, 0, ox, oy);
              this.dig.main.incrementPenalty();
              push = false;
            }
          if ((clbits & 1) !== 0 || (clbits & 0x3f00) !== 0) {
            x = ox;
            y = oy;
            this.dig.drawing.drawGold(bag, 0, ox, oy);
            this.dig.main.incrementPenalty();
            push = false;
          }
      }
      if (push) this.bagdat[bag].direction = dir;
      else this.bagdat[bag].direction = this.dig.reversedir(dir);
      this.bagdat[bag].x = x;
      this.bagdat[bag].y = y;
      this.bagdat[bag].h = Math.trunc((x - 12) / 20);
      this.bagdat[bag].v = Math.trunc((y - 18) / 18);
      this.bagdat[bag].xr = (x - 12) % 20;
      this.bagdat[bag].yr = (y - 18) % 18;
    }
    return push;
  }

  /** Толкает все мешки, совпадающие с маской. */
  pushbags(dir: number, bits: number): boolean {
    let push = true;
    for (let bag = 1, bit = 2; bag < Bags.MAX_BAGS; bag++, bit <<= 1)
      if ((bits & bit) !== 0) if (!this.pushbag(bag, dir)) push = false;
    return push;
  }

  /** Проверяет возможность вертикального толчка (мешки с золотом собираются). */
  pushudbags(bits: number): boolean {
    let push = true;
    for (let bag = 1, b = 2; bag < Bags.MAX_BAGS; bag++, b <<= 1)
      if ((bits & b) !== 0)
        if (this.bagdat[bag].goldTime !== 0) this.getgold(bag);
        else push = false;
    return push;
  }

  removebag(bag: number): void {
    if (this.bagdat[bag].exist) {
      this.bagdat[bag].exist = false;
      this.dig.sprite.eraseSprite(bag);
    }
  }

  removebags(bits: number): void {
    for (let bag = 1, b = 2; bag < Bags.MAX_BAGS; bag++, b <<= 1)
      if (this.bagdat[bag].exist && (bits & b) !== 0) this.removebag(bag);
  }

  /** Покадровое обновление одного мешка: переходы качание/падение. */
  updatebag(bag: number): void {
    const x = this.bagdat[bag].x;
    const h = this.bagdat[bag].h;
    const xr = this.bagdat[bag].xr;
    const y = this.bagdat[bag].y;
    const v = this.bagdat[bag].v;
    const yr = this.bagdat[bag].yr;
    switch (this.bagdat[bag].direction) {
      case -1:
        if (y < 180 && xr === 0) {
          if (this.bagdat[bag].wobbling) {
            if (this.bagdat[bag].wobbleTime === 0) {
              this.bagdat[bag].direction = 6;
              this.dig.sound.soundFall();
              break;
            }
            this.bagdat[bag].wobbleTime--;
            const wbl = this.bagdat[bag].wobbleTime % 8;
            if ((wbl & 1) === 0) {
              this.dig.drawing.drawGold(bag, this.wobbleAnim[wbl >> 1], x, y);
              this.dig.main.incrementPenalty();
              this.dig.sound.soundWobble();
            }
          } else if ((this.dig.monster.getfield(h, v + 1) & 0xfdf) !== 0xfdf)
            if (!this.dig.isDiggerUnderBag(h, v + 1)) this.bagdat[bag].wobbling = true;
        } else {
          this.bagdat[bag].wobbleTime = 15;
          this.bagdat[bag].wobbling = false;
        }
        break;
      case 0:
      case 4:
        if (xr === 0)
          if (y < 180 && (this.dig.monster.getfield(h, v + 1) & 0xfdf) !== 0xfdf) {
            this.bagdat[bag].direction = 6;
            this.bagdat[bag].wobbleTime = 0;
            this.dig.sound.soundFall();
          } else this.baghitground(bag);
        break;
      case 6:
        if (yr === 0) this.bagdat[bag].fallHeight++;
        if (y >= 180) this.baghitground(bag);
        else if ((this.dig.monster.getfield(h, v + 1) & 0xfdf) === 0xfdf) if (yr === 0) this.baghitground(bag);
        this.dig.monster.checkMonScared(this.bagdat[bag].h);
    }
    if (this.bagdat[bag].direction !== -1)
      if (this.bagdat[bag].direction !== 6 && this.pushCount !== 0) this.pushCount--;
      else this.pushbag(bag, this.bagdat[bag].direction);
  }
}
