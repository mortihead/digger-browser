import type { Digger } from "./Digger.ts";
import { MonsterState } from "./MonsterState.ts";

/**
 * Управление монстрами: появление, ИИ движения, коллизии, смерть.
 * Одновременно до 6 монстров (индексы 0-5). Типы: Nobbin (круглый, не копает)
 * и Hobbin (копает землю). Порт org.digger.app.Monster.
 */
export class Monster {
  private static readonly MAX_MONSTERS = 6;

  private readonly dig: Digger;

  mondat: MonsterState[] = [];

  nextMonster = 0;
  totalMonsters = 0;
  maxMonOnScreen = 0;
  nextMonTime = 0;
  monGapTime = 0;

  unbonusFlag = false;
  monGotGold = false;

  constructor(d: Digger) {
    this.dig = d;
    for (let i = 0; i < Monster.MAX_MONSTERS; i++) this.mondat[i] = new MonsterState();
  }

  /** Не даёт двум наложенным монстрам двигаться в одну сторону. */
  checkcoincide(mon: number, bits: number): void {
    for (let m = 0, b = 256; m < Monster.MAX_MONSTERS; m++, b <<= 1)
      if (
        (bits & b) !== 0 &&
        this.mondat[mon].direction === this.mondat[m].direction &&
        this.mondat[m].spawnTime === 0 &&
        this.mondat[mon].spawnTime === 0
      )
        this.mondat[m].direction = this.dig.reversedir(this.mondat[m].direction);
  }

  /** Заставляет монстров, идущих вверх, развернуться, когда рядом падает мешок. */
  checkMonScared(h: number): void {
    for (let m = 0; m < Monster.MAX_MONSTERS; m++)
      if (h === this.mondat[m].h && this.mondat[m].direction === 2) this.mondat[m].direction = 6;
  }

  /** Создаёт нового монстра в правом верхнем углу. */
  createMonster(): void {
    for (let i = 0; i < Monster.MAX_MONSTERS; i++)
      if (!this.mondat[i].flag) {
        const m = this.mondat[i];
        m.flag = true;
        m.alive = true;
        m.type = 0;
        m.nob = true;
        m.huntTime = 0;
        m.h = 14;
        m.v = 0;
        m.x = 292;
        m.y = 18;
        m.xr = 0;
        m.yr = 0;
        m.direction = 4;
        m.horizontalDir = 4;
        this.nextMonster++;
        this.nextMonTime = this.monGapTime;
        m.spawnTime = 5;
        this.dig.sprite.moveDrawSprite(i + 8, m.x, m.y);
        break;
      }
  }

  /** Основное покадровое обновление: появление, ИИ движения, анимация смерти. */
  doMonsters(): void {
    if (this.nextMonTime > 0) this.nextMonTime--;
    else {
      if (
        this.nextMonster < this.totalMonsters &&
        this.getMonstersOnScreenCount() < this.maxMonOnScreen &&
        this.dig.digOnScreen &&
        !this.dig.bonusMode
      )
        this.createMonster();
      if (this.unbonusFlag && this.nextMonster === this.totalMonsters && this.nextMonTime === 0)
        if (this.dig.digOnScreen) {
          this.unbonusFlag = false;
          this.dig.createbonus();
        }
    }
    for (let i = 0; i < Monster.MAX_MONSTERS; i++)
      if (this.mondat[i].flag) {
        if (this.mondat[i].huntTime > 10 - this.dig.main.getLevelNumberClampedToTen()) {
          if (this.mondat[i].nob) {
            this.mondat[i].nob = false;
            this.mondat[i].huntTime = 0;
          }
        }
        if (this.mondat[i].alive)
          if (this.mondat[i].type === 0) {
            this.handleMonsterAi(i);
            if (this.dig.main.randomNumber(15 - this.dig.main.getLevelNumberClampedToTen()) === 0 && this.mondat[i].nob)
              this.handleMonsterAi(i);
          } else this.mondat[i].type--;
        else this.handleMonsterDeath(i);
      }
  }

  eraseMonsters(): void {
    for (let i = 0; i < Monster.MAX_MONSTERS; i++) if (this.mondat[i].flag) this.dig.sprite.eraseSprite(i + 8);
  }

  /** Проверяет, может ли монстр двигаться в направлении dir из ячейки (x, y). */
  fieldClear(dir: number, x: number, y: number): boolean {
    switch (dir) {
      case 0:
        if (x < 14)
          if ((this.getfield(x + 1, y) & 0x2000) === 0)
            if ((this.getfield(x + 1, y) & 1) === 0 || (this.getfield(x, y) & 0x10) === 0) return true;
        break;
      case 4:
        if (x > 0)
          if ((this.getfield(x - 1, y) & 0x2000) === 0)
            if ((this.getfield(x - 1, y) & 0x10) === 0 || (this.getfield(x, y) & 1) === 0) return true;
        break;
      case 2:
        if (y > 0)
          if ((this.getfield(x, y - 1) & 0x2000) === 0)
            if ((this.getfield(x, y - 1) & 0x800) === 0 || (this.getfield(x, y) & 0x40) === 0) return true;
        break;
      case 6:
        if (y < 9)
          if ((this.getfield(x, y + 1) & 0x2000) === 0)
            if ((this.getfield(x, y + 1) & 0x40) === 0 || (this.getfield(x, y) & 0x800) === 0) return true;
    }
    return false;
  }

  getfield(x: number, y: number): number {
    return this.dig.drawing.field[y * 15 + x];
  }

  /** Добавляет задержку к таймерам движения монстров. */
  increaseMonsterDelay(n: number): void {
    if (n > 6) n = 6;
    for (let m = 1; m < n; m++) this.mondat[m].type++;
  }

  incpenalties(bits: number): void {
    for (let m = 0, b = 256; m < Monster.MAX_MONSTERS; m++, b <<= 1) {
      if ((bits & b) !== 0) this.dig.main.incrementPenalty();
      b <<= 1;
    }
  }

  /** Инициализирует параметры монстров для текущего уровня. */
  initMonsters(): void {
    for (let i = 0; i < Monster.MAX_MONSTERS; i++) this.mondat[i].flag = false;
    this.nextMonster = 0;
    this.monGapTime = 45 - (this.dig.main.getLevelNumberClampedToTen() << 1);
    this.totalMonsters = this.dig.main.getLevelNumberClampedToTen() + 5;
    switch (this.dig.main.getLevelNumberClampedToTen()) {
      case 1:
        this.maxMonOnScreen = 3;
        break;
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
        this.maxMonOnScreen = 4;
        break;
      case 8:
      case 9:
      case 10:
        this.maxMonOnScreen = 5;
    }
    this.nextMonTime = 10;
    this.unbonusFlag = true;
  }

  killMonster(mon: number): void {
    if (this.mondat[mon].flag) {
      this.mondat[mon].flag = this.mondat[mon].alive = false;
      this.dig.sprite.eraseSprite(mon + 8);
      if (this.dig.bonusMode) this.totalMonsters++;
    }
  }

  /** Убивает всех монстров по маске. Возвращает число убитых. */
  killmonsters(bits: number): number {
    let n = 0;
    for (let m = 0, b = 256; m < Monster.MAX_MONSTERS; m++, b <<= 1)
      if ((bits & b) !== 0) {
        this.killMonster(m);
        n++;
      }
    return n;
  }

  /** ИИ монстра: выбор направления и перемещение. */
  handleMonsterAi(mon: number): void {
    const m = this.mondat[mon];
    let dir: number;
    let mdirp1: number;
    let mdirp2: number;
    let mdirp3: number;
    let mdirp4: number;
    let t: number;
    let push = true;
    const monox = m.x;
    const monoy = m.y;
    if (m.xr === 0 && m.yr === 0) {
      if (m.huntTime > 30 + (this.dig.main.getLevelNumberClampedToTen() << 1))
        if (!m.nob) {
          m.huntTime = 0;
          m.nob = true;
        }

      if (Math.abs(this.dig.diggery - m.y) > Math.abs(this.dig.diggerx - m.x)) {
        mdirp1 = this.dig.diggery < m.y ? 2 : 6;
        mdirp4 = this.dig.diggery < m.y ? 6 : 2;
        mdirp2 = this.dig.diggerx < m.x ? 4 : 0;
        mdirp3 = this.dig.diggerx < m.x ? 0 : 4;
      } else {
        mdirp1 = this.dig.diggerx < m.x ? 4 : 0;
        mdirp4 = this.dig.diggerx < m.x ? 0 : 4;
        mdirp2 = this.dig.diggery < m.y ? 2 : 6;
        mdirp3 = this.dig.diggery < m.y ? 6 : 2;
      }

      if (this.dig.bonusMode) {
        t = mdirp1;
        mdirp1 = mdirp4;
        mdirp4 = t;
        t = mdirp2;
        mdirp2 = mdirp3;
        mdirp3 = t;
      }

      dir = this.dig.reversedir(m.direction);
      if (dir === mdirp1) {
        mdirp1 = mdirp2;
        mdirp2 = mdirp3;
        mdirp3 = mdirp4;
        mdirp4 = dir;
      }
      if (dir === mdirp2) {
        mdirp2 = mdirp3;
        mdirp3 = mdirp4;
        mdirp4 = dir;
      }
      if (dir === mdirp3) {
        mdirp3 = mdirp4;
        mdirp4 = dir;
      }

      if (
        this.dig.main.randomNumber(this.dig.main.getLevelNumberClampedToTen() + 5) === 1 &&
        this.dig.main.getLevelNumberClampedToTen() < 6
      ) {
        t = mdirp1;
        mdirp1 = mdirp3;
        mdirp3 = t;
      }

      if (this.fieldClear(mdirp1, m.h, m.v)) dir = mdirp1;
      else if (this.fieldClear(mdirp2, m.h, m.v)) dir = mdirp2;
      else if (this.fieldClear(mdirp3, m.h, m.v)) dir = mdirp3;
      else if (this.fieldClear(mdirp4, m.h, m.v)) dir = mdirp4;

      if (!m.nob) dir = mdirp1;

      if (m.direction !== dir) m.type++;

      m.direction = dir;
    }

    if (
      (m.x === 292 && m.direction === 0) ||
      (m.x === 12 && m.direction === 4) ||
      (m.y === 180 && m.direction === 6) ||
      (m.y === 18 && m.direction === 2)
    )
      m.direction = -1;

    if (m.direction === 4 || m.direction === 0) m.horizontalDir = m.direction;

    if (!m.nob) this.dig.drawing.digTunnel(m.x, m.y, m.direction);

    switch (m.direction) {
      case 0:
        if (!m.nob) this.dig.drawing.drawTunnelEdgeRight(m.x, m.y);
        m.x += 4;
        break;
      case 4:
        if (!m.nob) this.dig.drawing.drawTunnelEdgeLeft(m.x, m.y);
        m.x -= 4;
        break;
      case 2:
        if (!m.nob) this.dig.drawing.drawTunnelEdgeTop(m.x, m.y);
        m.y -= 3;
        break;
      case 6:
        if (!m.nob) this.dig.drawing.drawTunnelEdgeBottom(m.x, m.y);
        m.y += 3;
        break;
    }

    if (!m.nob)
      this.dig.hitemerald(
        Math.trunc((m.x - 12) / 20),
        Math.trunc((m.y - 18) / 18),
        (m.x - 12) % 20,
        (m.y - 18) % 18,
        m.direction,
      );

    if (!this.dig.digOnScreen) {
      m.x = monox;
      m.y = monoy;
    }

    if (m.spawnTime !== 0) {
      m.spawnTime--;
      m.x = monox;
      m.y = monoy;
    }

    if (!m.nob && m.huntTime < 100) m.huntTime++;

    push = true;
    let clbits = this.dig.drawing.drawMonster(mon, m.nob, m.horizontalDir, m.x, m.y);
    this.dig.main.incrementPenalty();

    if ((clbits & 0x3f00) !== 0) {
      m.type++;
      this.checkcoincide(mon, clbits);
      this.incpenalties(clbits);
    }

    if ((clbits & this.dig.bags.bagbits()) !== 0) {
      m.type++;
      this.monGotGold = false;
      if (m.direction === 4 || m.direction === 0) {
        push = this.dig.bags.pushbags(m.direction, clbits);
        m.type++;
      } else if (!this.dig.bags.pushudbags(clbits)) push = false;
      if (this.monGotGold) m.type = 0;
      if (!m.nob && m.huntTime > 1) this.dig.bags.removebags(clbits);
    }

    if (m.nob && (clbits & 0x3f00) !== 0 && this.dig.digOnScreen) m.huntTime++;

    if (!push) {
      m.x = monox;
      m.y = monoy;
      this.dig.drawing.drawMonster(mon, m.nob, m.horizontalDir, m.x, m.y);
      this.dig.main.incrementPenalty();
      if (m.nob) m.huntTime++;
      if ((m.direction === 2 || m.direction === 6) && m.nob) m.direction = this.dig.reversedir(m.direction);
    }

    if ((clbits & 1) !== 0 && this.dig.digOnScreen)
      if (this.dig.bonusMode) {
        this.killMonster(mon);
        this.dig.scores.scoreEatMonster();
        this.dig.sound.soundEatm();
      } else this.dig.killdigger(3, 0);

    m.h = Math.trunc((m.x - 12) / 20);
    m.v = Math.trunc((m.y - 18) / 18);
    m.xr = (m.x - 12) % 20;
    m.yr = (m.y - 18) % 18;
    void clbits;
  }

  /** Анимация смерти монстра: раздавлен мешком или растворяется. */
  handleMonsterDeath(mon: number): void {
    const m = this.mondat[mon];
    switch (m.death) {
      case 1:
        if (this.dig.bags.bagy(m.bag) + 6 > m.y) m.y = this.dig.bags.bagy(m.bag);
        this.dig.drawing.drawMonsterDeath(mon, m.nob, m.horizontalDir, m.x, m.y);
        this.dig.main.incrementPenalty();
        if (this.dig.bags.getbagdir(m.bag) === -1) {
          m.deathTime = 1;
          m.death = 4;
        }
        break;
      case 4:
        if (m.deathTime !== 0) m.deathTime--;
        else {
          this.killMonster(mon);
          this.dig.scores.scoreKillMonster();
        }
    }
  }

  monsterGotGold(): void {
    this.monGotGold = true;
  }

  getMonstersLeft(): number {
    return this.getMonstersOnScreenCount() + this.totalMonsters - this.nextMonster;
  }

  getMonstersOnScreenCount(): number {
    let n = 0;
    for (let i = 0; i < Monster.MAX_MONSTERS; i++) if (this.mondat[i].flag) n++;
    return n;
  }

  squashmonster(mon: number, death: number, bag: number): void {
    this.mondat[mon].alive = false;
    this.mondat[mon].death = death;
    this.mondat[mon].bag = bag;
  }

  squashmonsters(bag: number, bits: number): void {
    for (let m = 0, b = 256; m < Monster.MAX_MONSTERS; m++, b <<= 1)
      if ((bits & b) !== 0) if (this.mondat[m].y >= this.dig.bags.bagy(bag)) this.squashmonster(m, 1, bag);
  }
}
