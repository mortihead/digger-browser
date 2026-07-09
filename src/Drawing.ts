import type { Digger } from "./Digger.ts";

/**
 * Отрисовка/рендеринг: раскладка поля, спрайты (диггер, монстры, мешки, огонь,
 * бонус), вывод текста и логика прокапывания туннелей.
 *
 * Поле — сетка 15×10, хранится битовыми масками в {@link field}.
 * Биты 0-4 — горизонтальные сегменты туннеля, биты 6-11 — вертикальные,
 * бит 13 (0x2000) — наличие изумруда, бит 12 (0x1000) — туннель уже прорисован.
 *
 * Порт org.digger.app.Drawing. Вызовы AWT currentSource.newPixels убраны:
 * в браузерной версии экран целиком выводится раз в кадр методом render().
 */
export class Drawing {
  private static readonly FIELD_WIDTH = 15;
  private static readonly FIELD_HEIGHT = 10;
  private static readonly FIELD_SIZE = Drawing.FIELD_WIDTH * Drawing.FIELD_HEIGHT;

  private static readonly BIT_EMERALD = 0x2000;
  private static readonly BIT_TUNNEL_DRAWN = 0x1000;

  private readonly bitMasks = [
    0xfffe, 0xfffd, 0xfffb, 0xfff7, 0xffef, 0xffdf, 0xffbf, 0xff7f, 0xfeff, 0xfdff, 0xfbff, 0xf7ff,
  ];

  private static readonly CLEAR_HORIZONTAL = 0xd03f;
  private static readonly CLEAR_VERTICAL = 0xdfe0;
  private static readonly ALL_HORIZONTAL = 0x1f;
  private static readonly ALL_VERTICAL = 0xfc0;

  private readonly dig: Digger;

  field1: number[] = new Array(Drawing.FIELD_SIZE).fill(0);
  field2: number[] = new Array(Drawing.FIELD_SIZE).fill(0);
  field: number[] = new Array(Drawing.FIELD_SIZE).fill(0);

  // --- Буферы пикселей спрайтов (сохранённый фон под спрайтом) ---
  private readonly diggerBuf: number[] = new Array(480).fill(0);
  private readonly bagBuf: number[][] = Array.from({ length: 7 }, () => new Array(480).fill(0));
  private readonly monBuf: number[][] = Array.from({ length: 6 }, () => new Array(480).fill(0));
  private readonly bonusBuf: number[] = new Array(480).fill(0);
  private readonly fireBuf: number[] = new Array(128).fill(0);

  // --- Состояние анимации ---
  private readonly monSpriteFrame = [0, 0, 0, 0, 0, 0];
  private readonly monSpriteDir = [0, 0, 0, 0, 0, 0];
  private digSpriteFrame = 0;
  private digSpriteDir = 0;
  private fireSpriteFrame = 0;
  private readonly fireHeight = 8;

  constructor(d: Digger) {
    this.dig = d;
  }

  /** Создаёт буферы спрайтов диггера, бонус-вишни и огненного заряда. */
  createDiggerBonusFireSprites(): void {
    this.digSpriteDir = 1;
    this.digSpriteFrame = 0;
    this.fireSpriteFrame = 0;
    this.dig.sprite.createSprite(0, 0, this.diggerBuf, 4, 15, 0, 0);
    this.dig.sprite.createSprite(14, 81, this.bonusBuf, 4, 15, 0, 0);
    this.dig.sprite.createSprite(15, 82, this.fireBuf, 2, this.fireHeight, 0, 0);
  }

  /** Создаёт буферы всех спрайтов: мешки, монстры, диггер, бонус, огонь. */
  createAllSprites(): void {
    for (let i = 0; i < 7; i++) this.dig.sprite.createSprite(i + 1, 62, this.bagBuf[i], 4, 15, 0, 0);
    for (let i = 0; i < 6; i++) this.dig.sprite.createSprite(i + 8, 71, this.monBuf[i], 4, 15, 0, 0);
    this.createDiggerBonusFireSprites();
    for (let i = 0; i < 6; i++) {
      this.monSpriteFrame[i] = 0;
      this.monSpriteDir[i] = 1;
    }
  }

  /** Рисует фоновую землю уровня. */
  drawBackground(levelPlan: number): void {
    for (let y = 14; y < 200; y += 4)
      for (let x = 0; x < 320; x += 20) this.dig.sprite.drawMiscSprite(x, y, 93 + levelPlan, 5, 4);
  }

  /** Рисует бонус-вишню в заданной позиции. */
  drawBonus(x: number, y: number): void {
    this.dig.sprite.initSprite(14, 81, 4, 15, 0, 0);
    this.dig.sprite.moveDrawSprite(14, x, y);
  }

  /** Рисует нижнюю кромку туннеля (под ячейкой). */
  drawTunnelEdgeBottom(x: number, y: number): void {
    this.dig.sprite.initMiscSprite(x - 4, y + 15, 6, 6);
    this.dig.sprite.drawMiscSprite(x - 4, y + 15, 105, 6, 6);
    this.dig.sprite.captureAndDrawSprites();
  }

  /**
   * Рисует спрайт диггера.
   *
   * @param frame кадр анимации (0-6 ходьба, 10-15 смерть)
   * @param right true, если смотрит вправо
   * @return битовая маска коллизий
   */
  drawDigger(frame: number, x: number, y: number, right: boolean): number {
    this.digSpriteFrame += this.digSpriteDir;
    if (this.digSpriteFrame === 2 || this.digSpriteFrame === 0) this.digSpriteDir = -this.digSpriteDir;
    this.digSpriteFrame = Math.max(0, Math.min(2, this.digSpriteFrame));
    if (frame >= 0 && frame <= 6 && (frame & 1) === 0) {
      this.dig.sprite.initSprite(0, (frame + (right ? 0 : 1)) * 3 + this.digSpriteFrame + 1, 4, 15, 0, 0);
      return this.dig.sprite.redrawSprite(0, x, y);
    }
    if (frame >= 10 && frame <= 15) {
      this.dig.sprite.initSprite(0, 40 - frame, 4, 15, 0, 0);
      return this.dig.sprite.redrawSprite(0, x, y);
    }
    return 0;
  }

  /** Рисует один изумруд в заданной пиксельной позиции. */
  drawEmerald(x: number, y: number): void {
    this.dig.sprite.initMiscSprite(x, y, 4, 10);
    this.dig.sprite.drawMiscSprite(x, y, 108, 4, 10);
    this.dig.sprite.captureAndDrawSprites();
  }

  /** Перерисовывает кромки туннелей для всех частично прокопанных ячеек. */
  drawField(): void {
    const FW = Drawing.FIELD_WIDTH;
    const FH = Drawing.FIELD_HEIGHT;
    for (let x = 0; x < FW; x++)
      for (let y = 0; y < FH; y++)
        if ((this.field[y * FW + x] & Drawing.BIT_EMERALD) === 0) {
          const xp = x * 20 + 12;
          const yp = y * 18 + 18;
          if ((this.field[y * FW + x] & Drawing.ALL_VERTICAL) !== Drawing.ALL_VERTICAL) {
            this.field[y * FW + x] &= Drawing.CLEAR_HORIZONTAL;
            this.drawTunnelEdgeBottom(xp, yp - 15);
            this.drawTunnelEdgeBottom(xp, yp - 12);
            this.drawTunnelEdgeBottom(xp, yp - 9);
            this.drawTunnelEdgeBottom(xp, yp - 6);
            this.drawTunnelEdgeBottom(xp, yp - 3);
            this.drawTunnelEdgeTop(xp, yp + 3);
          }
          if ((this.field[y * FW + x] & Drawing.ALL_HORIZONTAL) !== Drawing.ALL_HORIZONTAL) {
            this.field[y * FW + x] &= Drawing.CLEAR_VERTICAL;
            this.drawTunnelEdgeRight(xp - 16, yp);
            this.drawTunnelEdgeRight(xp - 12, yp);
            this.drawTunnelEdgeRight(xp - 8, yp);
            this.drawTunnelEdgeRight(xp - 4, yp);
            this.drawTunnelEdgeLeft(xp + 4, yp);
          }
          if (x < 14) if ((this.field[y * FW + x + 1] & 0xfdf) !== 0xfdf) this.drawTunnelEdgeRight(xp, yp);
          if (y < 9) if ((this.field[(y + 1) * FW + x] & 0xfdf) !== 0xfdf) this.drawTunnelEdgeBottom(xp, yp);
        }
  }

  /**
   * Рисует огненный заряд.
   *
   * @param frame 0 — анимация, 1-2 — расширяющийся кончик
   * @return битовая маска коллизий
   */
  drawFire(x: number, y: number, frame: number): number {
    if (frame === 0) {
      this.fireSpriteFrame++;
      if (this.fireSpriteFrame > 2) this.fireSpriteFrame = 0;
      this.dig.sprite.initSprite(15, 82 + this.fireSpriteFrame, 2, this.fireHeight, 0, 0);
    } else {
      this.dig.sprite.initSprite(15, 84 + frame, 2, this.fireHeight, 0, 0);
    }
    return this.dig.sprite.redrawSprite(15, x, y);
  }

  /** Рисует падающие комья земли под мешком, пробивающим грунт. */
  drawBagFallDebris(x: number, y: number): void {
    this.dig.sprite.initMiscSprite(x - 4, y + 15, 6, 8);
    this.dig.sprite.drawMiscSprite(x - 4, y + 15, 107, 6, 8);
    this.dig.sprite.captureAndDrawSprites();
  }

  /**
   * Рисует спрайт мешка с золотом.
   *
   * @param spriteIndex слот спрайта (1-7)
   * @param frame кадр (0=неподвижен, 1-2=качание, 3=падение, 4-6=разбитие)
   * @return битовая маска коллизий
   */
  drawGold(spriteIndex: number, frame: number, x: number, y: number): number {
    this.dig.sprite.initSprite(spriteIndex, frame + 62, 4, 15, 0, 0);
    return this.dig.sprite.redrawSprite(spriteIndex, x, y);
  }

  /** Рисует левую кромку туннеля (граница справа от ячейки). */
  drawTunnelEdgeLeft(x: number, y: number): void {
    this.dig.sprite.initMiscSprite(x - 8, y - 1, 2, 18);
    this.dig.sprite.drawMiscSprite(x - 8, y - 1, 104, 2, 18);
    this.dig.sprite.captureAndDrawSprites();
  }

  /** Рисует одну иконку жизни. */
  drawLife(type: number, x: number, y: number): void {
    this.dig.sprite.drawMiscSprite(x, y, type + 110, 4, 12);
  }

  /** Рисует оставшиеся жизни обоих игроков в верхней панели. */
  drawLives(): void {
    let n = this.dig.main.getLives(1) - 1;
    for (let l = 1; l < 5; l++) {
      this.drawLife(n > 0 ? 0 : 2, l * 20 + 60, 0);
      n--;
    }
    if (this.dig.main.numPlayers === 2) {
      n = this.dig.main.getLives(2) - 1;
      for (let l = 1; l < 5; l++) {
        this.drawLife(n > 0 ? 1 : 2, 244 - l * 20, 0);
        n--;
      }
    }
  }

  /**
   * Рисует живого монстра (Nobbin или Hobbin) с анимацией ходьбы.
   *
   * @param isNobbin true для Nobbin (круглый), false для Hobbin (копает горизонтально)
   * @param direction направление (0=вправо, 4=влево)
   * @return битовая маска коллизий
   */
  drawMonster(index: number, isNobbin: boolean, direction: number, x: number, y: number): number {
    this.monSpriteFrame[index] += this.monSpriteDir[index];
    if (this.monSpriteFrame[index] === 2 || this.monSpriteFrame[index] === 0)
      this.monSpriteDir[index] = -this.monSpriteDir[index];
    this.monSpriteFrame[index] = Math.max(0, Math.min(2, this.monSpriteFrame[index]));
    if (isNobbin) {
      this.dig.sprite.initSprite(index + 8, this.monSpriteFrame[index] + 69, 4, 15, 0, 0);
    } else {
      switch (direction) {
        case 0:
          this.dig.sprite.initSprite(index + 8, this.monSpriteFrame[index] + 73, 4, 15, 0, 0);
          break;
        case 4:
          this.dig.sprite.initSprite(index + 8, this.monSpriteFrame[index] + 77, 4, 15, 0, 0);
      }
    }
    return this.dig.sprite.redrawSprite(index + 8, x, y);
  }

  /**
   * Рисует умирающего/раздавленного монстра.
   *
   * @return битовая маска коллизий
   */
  drawMonsterDeath(index: number, isNobbin: boolean, direction: number, x: number, y: number): number {
    if (isNobbin) {
      this.dig.sprite.initSprite(index + 8, 72, 4, 15, 0, 0);
    } else {
      switch (direction) {
        case 0:
          this.dig.sprite.initSprite(index + 8, 76, 4, 15, 0, 0);
          break;
        case 4:
          this.dig.sprite.initSprite(index + 8, 80, 4, 14, 0, 0);
      }
    }
    return this.dig.sprite.redrawSprite(index + 8, x, y);
  }

  /** Рисует правую кромку туннеля (граница слева от ячейки). */
  drawTunnelEdgeRight(x: number, y: number): void {
    this.dig.sprite.initMiscSprite(x + 16, y - 1, 2, 18);
    this.dig.sprite.drawMiscSprite(x + 16, y - 1, 102, 2, 18);
    this.dig.sprite.captureAndDrawSprites();
  }

  /** Рисует трещину земли под качающимся мешком перед падением. */
  drawBagGroundCrack(x: number, y: number): void {
    this.dig.sprite.initMiscSprite(x - 4, y + 17, 6, 6);
    this.dig.sprite.drawMiscSprite(x - 4, y + 17, 106, 6, 6);
    this.dig.sprite.captureAndDrawSprites();
  }

  /** Восстанавливает поле из снимка и перерисовывает фон и кромки туннелей. */
  drawFieldAndBackground(): void {
    const FW = Drawing.FIELD_WIDTH;
    const FH = Drawing.FIELD_HEIGHT;
    for (let x = 0; x < FW; x++)
      for (let y = 0; y < FH; y++)
        if (this.dig.main.getCurrentPlayer() === 0) this.field[y * FW + x] = this.field1[y * FW + x];
        else this.field[y * FW + x] = this.field2[y * FW + x];
    this.dig.display.setPalette(0);
    this.dig.display.setIntensity(0);
    this.drawBackground(this.dig.main.getLevelPlan());
    this.drawField();
  }

  /** Рисует верхнюю кромку туннеля (над ячейкой). */
  drawTunnelEdgeTop(x: number, y: number): void {
    this.dig.sprite.initMiscSprite(x - 4, y - 6, 6, 6);
    this.dig.sprite.drawMiscSprite(x - 4, y - 6, 103, 6, 6);
    this.dig.sprite.captureAndDrawSprites();
  }

  /**
   * Сбрасывает биты поля по направлению движения (прокапывание туннеля).
   *
   * @param dir направление (0=вправо, 4=влево, 2=вверх, 6=вниз)
   */
  digTunnel(x: number, y: number, dir: number): void {
    const FW = Drawing.FIELD_WIDTH;
    let h = Math.floor((x - 12) / 20);
    let xr = Math.floor(((x - 12) % 20) / 4);
    let v = Math.floor((y - 18) / 18);
    let yr = Math.floor(((y - 18) % 18) / 3);
    this.dig.main.incrementPenalty();
    switch (dir) {
      case 0:
        h++;
        this.field[v * FW + h] &= this.bitMasks[xr];
        if ((this.field[v * FW + h] & Drawing.ALL_HORIZONTAL) !== 0) break;
        this.field[v * FW + h] &= ~Drawing.BIT_TUNNEL_DRAWN;
        break;
      case 4:
        xr--;
        if (xr < 0) {
          xr += 5;
          h--;
        }
        this.field[v * FW + h] &= this.bitMasks[xr];
        if ((this.field[v * FW + h] & Drawing.ALL_HORIZONTAL) !== 0) break;
        this.field[v * FW + h] &= ~Drawing.BIT_TUNNEL_DRAWN;
        break;
      case 2:
        yr--;
        if (yr < 0) {
          yr += 6;
          v--;
        }
        this.field[v * FW + h] &= this.bitMasks[6 + yr];
        if ((this.field[v * FW + h] & Drawing.ALL_VERTICAL) !== 0) break;
        this.field[v * FW + h] &= ~Drawing.BIT_TUNNEL_DRAWN;
        break;
      case 6:
        v++;
        this.field[v * FW + h] &= this.bitMasks[6 + yr];
        if ((this.field[v * FW + h] & Drawing.ALL_VERTICAL) !== 0) break;
        this.field[v * FW + h] &= ~Drawing.BIT_TUNNEL_DRAWN;
    }
  }

  /** Стирает изумруд с поля (рисует поверх фон). */
  eraseEmerald(x: number, y: number): void {
    this.dig.sprite.initMiscSprite(x, y, 4, 10);
    this.dig.sprite.drawMiscSprite(x, y, 109, 4, 10);
    this.dig.sprite.captureAndDrawSprites();
  }

  /** Переинициализирует спрайты диггера, бонуса и огня (без пересоздания буферов). */
  initDiggerBonusFireSprites(): void {
    this.digSpriteDir = 1;
    this.digSpriteFrame = 0;
    this.fireSpriteFrame = 0;
    this.dig.sprite.initSprite(0, 0, 4, 15, 0, 0);
    this.dig.sprite.initSprite(14, 81, 4, 15, 0, 0);
    this.dig.sprite.initSprite(15, 82, 2, this.fireHeight, 0, 0);
  }

  /** Переинициализирует все спрайты (мешки, монстры, диггер, бонус, огонь). */
  initAllSprites(): void {
    for (let i = 1; i <= 7; i++) this.dig.sprite.initSprite(i, 62, 4, 15, 0, 0);
    for (let i = 8; i <= 13; i++) this.dig.sprite.initSprite(i, 71, 4, 15, 0, 0);
    this.initDiggerBonusFireSprites();
  }

  /** Строит массив битовых масок поля из данных раскладки уровня. */
  buildField(): void {
    const FW = Drawing.FIELD_WIDTH;
    const FH = Drawing.FIELD_HEIGHT;
    for (let x = 0; x < FW; x++)
      for (let y = 0; y < FH; y++) {
        this.field[y * FW + x] = -1;
        const c = this.dig.main.getLevelChar(x, y, this.dig.main.getLevelPlan());
        const ch = String.fromCharCode(c);
        if (ch === "S" || ch === "V") this.field[y * FW + x] &= Drawing.CLEAR_HORIZONTAL;
        if (ch === "S" || ch === "H") this.field[y * FW + x] &= Drawing.CLEAR_VERTICAL;
        if (this.dig.main.getCurrentPlayer() === 0) this.field1[y * FW + x] = this.field[y * FW + x];
        else this.field2[y * FW + x] = this.field[y * FW + x];
      }
  }

  /** Выводит текст в заданной позиции. */
  drawText(text: string, x: number, y: number, color: number): void {
    for (let i = 0; i < text.length; i++) {
      this.dig.display.drawChar(x, y, text.charCodeAt(i), color);
      x += 12;
    }
  }

  /** Сохраняет текущее состояние поля в снимок активного игрока. */
  saveFieldSnapshot(): void {
    const FW = Drawing.FIELD_WIDTH;
    const FH = Drawing.FIELD_HEIGHT;
    for (let x = 0; x < FW; x++)
      for (let y = 0; y < FH; y++)
        if (this.dig.main.getCurrentPlayer() === 0) this.field1[y * FW + x] = this.field[y * FW + x];
        else this.field2[y * FW + x] = this.field[y * FW + x];
  }
}
