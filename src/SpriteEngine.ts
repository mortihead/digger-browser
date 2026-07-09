import type { Digger } from "./Digger.ts";

/**
 * Спрайтовый движок: управляет до 16 спрайтами с детекцией коллизий,
 * сохранением/восстановлением фона и порядком отрисовки.
 *
 * Спрайты 0-7 — мешки, 8-13 — монстры, 14 — бонус, 15 — огонь;
 * 0 также используется под диггера. Слот 16 — временный для прочих спрайтов.
 *
 * Порт org.digger.app.SpriteEngine.
 */
export class SpriteEngine {
  private readonly dig: Digger;

  sprDrawFlag: boolean[] = new Array(17).fill(false);
  sprRecFlag: boolean[] = new Array(17).fill(false);
  sprEnabled: boolean[] = new Array(16).fill(false);

  sprChar: number[] = new Array(17).fill(0);
  sprBackground: number[][] = new Array(16);
  sprX: number[] = new Array(17).fill(0);
  sprY: number[] = new Array(17).fill(0);
  sprWidth: number[] = new Array(17).fill(0);
  sprHeight: number[] = new Array(17).fill(0);
  sprBWidth: number[] = new Array(16).fill(0);
  sprBHeight: number[] = new Array(16).fill(0);
  sprNewChar: number[] = new Array(16).fill(0);
  sprNewWidth: number[] = new Array(16).fill(0);
  sprNewHeight: number[] = new Array(16).fill(0);
  sprNewBWidth: number[] = new Array(16).fill(0);
  sprNewBHeight: number[] = new Array(16).fill(0);

  private readonly defaultSprOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  private sprOrder: number[] = this.defaultSprOrder;

  constructor(d: Digger) {
    this.dig = d;
  }

  bcollide(bx: number, si: number): boolean {
    if (this.sprX[bx] >= this.sprX[si]) {
      if (this.sprX[bx] + this.sprBWidth[bx] > this.sprWidth[si] * 4 + this.sprX[si] - this.sprBWidth[si] - 1)
        return false;
    } else if (this.sprX[si] + this.sprBWidth[si] > this.sprWidth[bx] * 4 + this.sprX[bx] - this.sprBWidth[bx] - 1)
      return false;
    if (this.sprY[bx] >= this.sprY[si]) {
      if (this.sprY[bx] + this.sprBHeight[bx] <= this.sprHeight[si] + this.sprY[si] - this.sprBHeight[si] - 1)
        return true;
      return false;
    }
    if (this.sprY[si] + this.sprBHeight[si] <= this.sprHeight[bx] + this.sprY[bx] - this.sprBHeight[bx] - 1)
      return true;
    return false;
  }

  bcollides(bx: number): number {
    const si = bx;
    let ax = 0;
    let dx = 0;
    bx = 0;
    do {
      if (this.sprEnabled[bx] && bx !== si) {
        if (this.bcollide(bx, si)) ax |= 1 << dx;
        this.sprX[bx] += 320;
        this.sprY[bx] -= 2;
        if (this.bcollide(bx, si)) ax |= 1 << dx;
        this.sprX[bx] -= 640;
        this.sprY[bx] += 4;
        if (this.bcollide(bx, si)) ax |= 1 << dx;
        this.sprX[bx] += 320;
        this.sprY[bx] -= 2;
      }
      bx++;
      dx++;
    } while (dx !== 16);
    return ax;
  }

  clearDrawFlags(): void {
    this.clearRecFlags();
    for (let i = 0; i < 17; i++) this.sprDrawFlag[i] = false;
  }

  clearRecFlags(): void {
    for (let i = 0; i < 17; i++) this.sprRecFlag[i] = false;
  }

  collide(bx: number, si: number): boolean {
    if (this.sprX[bx] >= this.sprX[si]) {
      if (this.sprX[bx] > this.sprWidth[si] * 4 + this.sprX[si] - 1) return false;
    } else if (this.sprX[si] > this.sprWidth[bx] * 4 + this.sprX[bx] - 1) return false;
    if (this.sprY[bx] >= this.sprY[si]) {
      if (this.sprY[bx] <= this.sprHeight[si] + this.sprY[si] - 1) return true;
      return false;
    }
    if (this.sprY[si] <= this.sprHeight[bx] + this.sprY[bx] - 1) return true;
    return false;
  }

  createSprite(n: number, ch: number, mov: number[], wid: number, hei: number, bwid: number, bhei: number): void {
    this.sprNewChar[n & 15] = this.sprChar[n & 15] = ch;
    this.sprBackground[n & 15] = mov;
    this.sprNewWidth[n & 15] = this.sprWidth[n & 15] = wid;
    this.sprNewHeight[n & 15] = this.sprHeight[n & 15] = hei;
    this.sprNewBWidth[n & 15] = this.sprBWidth[n & 15] = bwid;
    this.sprNewBHeight[n & 15] = this.sprBHeight[n & 15] = bhei;
    this.sprEnabled[n & 15] = false;
  }

  drawMiscSprite(x: number, y: number, ch: number, wid: number, hei: number): void {
    this.sprX[16] = x & -4;
    this.sprY[16] = y;
    this.sprChar[16] = ch;
    this.sprWidth[16] = wid;
    this.sprHeight[16] = hei;
    this.dig.display.drawSpriteMasked(this.sprX[16], this.sprY[16], this.sprChar[16], this.sprWidth[16], this.sprHeight[16]);
  }

  redrawSprite(n: number, x: number, y: number): number {
    const bx = n & 15;
    x &= -4;
    this.clearDrawFlags();
    this.setRedrawFlags(bx);
    const t1 = this.sprX[bx];
    const t2 = this.sprY[bx];
    const t3 = this.sprWidth[bx];
    const t4 = this.sprHeight[bx];
    this.sprX[bx] = x;
    this.sprY[bx] = y;
    this.sprWidth[bx] = this.sprNewWidth[bx];
    this.sprHeight[bx] = this.sprNewHeight[bx];
    this.clearRecFlags();
    this.setRedrawFlags(bx);
    this.sprHeight[bx] = t4;
    this.sprWidth[bx] = t3;
    this.sprY[bx] = t2;
    this.sprX[bx] = t1;
    this.sprDrawFlag[bx] = true;
    this.restoreBackgrounds();
    this.sprX[bx] = x;
    this.sprY[bx] = y;
    this.sprChar[bx] = this.sprNewChar[bx];
    this.sprWidth[bx] = this.sprNewWidth[bx];
    this.sprHeight[bx] = this.sprNewHeight[bx];
    this.sprBWidth[bx] = this.sprNewBWidth[bx];
    this.sprBHeight[bx] = this.sprNewBHeight[bx];
    this.dig.display.readSpritePixels(this.sprX[bx], this.sprY[bx], this.sprBackground[bx], this.sprWidth[bx], this.sprHeight[bx]);
    this.drawMaskedSprites();
    return this.bcollides(bx);
  }

  eraseSprite(n: number): void {
    const bx = n & 15;
    this.dig.display.drawSprite(this.sprX[bx], this.sprY[bx], this.sprBackground[bx], this.sprWidth[bx], this.sprHeight[bx]);
    this.sprEnabled[bx] = false;
    this.clearDrawFlags();
    this.setRedrawFlags(bx);
    this.drawMaskedSprites();
  }

  captureAndDrawSprites(): void {
    for (let i = 0; i < 16; i++)
      if (this.sprDrawFlag[i])
        this.dig.display.readSpritePixels(this.sprX[i], this.sprY[i], this.sprBackground[i], this.sprWidth[i], this.sprHeight[i]);
    this.drawMaskedSprites();
  }

  initMiscSprite(x: number, y: number, wid: number, hei: number): void {
    this.sprX[16] = x;
    this.sprY[16] = y;
    this.sprWidth[16] = wid;
    this.sprHeight[16] = hei;
    this.clearDrawFlags();
    this.setRedrawFlags(16);
    this.restoreBackgrounds();
  }

  initSprite(n: number, ch: number, wid: number, hei: number, bwid: number, bhei: number): void {
    this.sprNewChar[n & 15] = ch;
    this.sprNewWidth[n & 15] = wid;
    this.sprNewHeight[n & 15] = hei;
    this.sprNewBWidth[n & 15] = bwid;
    this.sprNewBHeight[n & 15] = bhei;
  }

  moveDrawSprite(n: number, x: number, y: number): number {
    const bx = n & 15;
    this.sprX[bx] = x & -4;
    this.sprY[bx] = y;
    this.sprChar[bx] = this.sprNewChar[bx];
    this.sprWidth[bx] = this.sprNewWidth[bx];
    this.sprHeight[bx] = this.sprNewHeight[bx];
    this.sprBWidth[bx] = this.sprNewBWidth[bx];
    this.sprBHeight[bx] = this.sprNewBHeight[bx];
    this.clearDrawFlags();
    this.setRedrawFlags(bx);
    this.restoreBackgrounds();
    this.dig.display.readSpritePixels(this.sprX[bx], this.sprY[bx], this.sprBackground[bx], this.sprWidth[bx], this.sprHeight[bx]);
    this.sprEnabled[bx] = true;
    this.sprDrawFlag[bx] = true;
    this.drawMaskedSprites();
    return this.bcollides(bx);
  }

  /** Рисует все отмеченные спрайты с масками (прозрачный фон). */
  private drawMaskedSprites(): void {
    for (let i = 0; i < 16; i++) {
      const j = this.sprOrder[i];
      if (this.sprDrawFlag[j])
        this.dig.display.drawSpriteMasked(this.sprX[j], this.sprY[j], this.sprChar[j], this.sprWidth[j], this.sprHeight[j]);
    }
  }

  /** Восстанавливает фон для всех отмеченных спрайтов (перезапись без маски). */
  private restoreBackgrounds(): void {
    for (let i = 0; i < 16; i++)
      if (this.sprDrawFlag[i])
        this.dig.display.drawSprite(this.sprX[i], this.sprY[i], this.sprBackground[i], this.sprWidth[i], this.sprHeight[i]);
  }

  setRedrawFlags(n: number): void {
    if (!this.sprRecFlag[n]) {
      this.sprRecFlag[n] = true;
      for (let i = 0; i < 16; i++)
        if (this.sprEnabled[i] && i !== n) {
          if (this.collide(i, n)) {
            this.sprDrawFlag[i] = true;
            this.setRedrawFlags(i);
          }
          this.sprX[i] += 320;
          this.sprY[i] -= 2;
          if (this.collide(i, n)) {
            this.sprDrawFlag[i] = true;
            this.setRedrawFlags(i);
          }
          this.sprX[i] -= 640;
          this.sprY[i] += 4;
          if (this.collide(i, n)) {
            this.sprDrawFlag[i] = true;
            this.setRedrawFlags(i);
          }
          this.sprX[i] += 320;
          this.sprY[i] -= 2;
        }
    }
  }

  setSpriteOrder(newsprorder: number[] | null): void {
    this.sprOrder = newsprorder == null ? this.defaultSprOrder : newsprorder;
  }
}
