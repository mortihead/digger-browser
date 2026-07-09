/**
 * Программная эмуляция видеовыхода IBM CGA (Color Graphics Adapter).
 *
 * Хранит буфер 320×200 пикселей, где каждый пиксель — 2-битный (4 цвета).
 * Есть два набора палитр (обычная и яркая).
 *
 * Порт оригинального класса org.digger.app.CgaDisplay. В отличие от Java-версии
 * (AWT MemoryImageSource с авто-обновлением), здесь буфер значений 0-3
 * преобразуется в RGBA и выводится на <canvas> методом {@link render},
 * который дёргает игровой цикл раз в кадр.
 */
import { CGA_TABLE } from "./CgaGrafx.ts";

export class CgaDisplay {
  /** Размеры экрана (режим CGA 4: 320×200). */
  readonly width = 320;
  readonly height = 200;
  private readonly size = this.width * this.height;

  /** Распакованный буфер пикселей: 1 значение на пиксель, значения 0-3. */
  readonly pixels: Uint8Array;

  /**
   * RGBA-палитры: [наборПалитры][цветовойИндекс] = упакованный ABGR для ImageData.
   * Индекс 0 — чёрный фон.
   *
   * Набор 0 (обычный): чёрный / зелёный / красный / коричневый.
   * Набор 1 (яркий): чёрный / ярко-зелёный / ярко-красный / жёлтый.
   */
  private readonly palettes: Uint32Array[] = [
    this.buildPalette([
      [0x00, 0x00, 0x00],
      [0x00, 0xaa, 0x00],
      [0xaa, 0x00, 0x00],
      [0xaa, 0x54, 0x00],
    ]),
    this.buildPalette([
      [0x00, 0x00, 0x00],
      [0x54, 0xff, 0x54],
      [0xff, 0x54, 0x54],
      [0xff, 0xff, 0x54],
    ]),
  ];

  /** Текущая выбранная палитра (0 — обычная, 1 — яркая). */
  private currentPalette: Uint32Array = this.palettes[0];

  /** 2D-контекст видимого canvas. */
  private readonly ctx: CanvasRenderingContext2D;
  private readonly imageData: ImageData;
  /** Представление буфера ImageData как 32-битных пикселей для быстрой записи. */
  private readonly rgba: Uint32Array;

  constructor(canvas: HTMLCanvasElement) {
    this.pixels = new Uint8Array(this.size);

    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Не удалось получить 2D-контекст canvas");
    this.ctx = ctx;
    this.imageData = ctx.createImageData(this.width, this.height);
    this.rgba = new Uint32Array(this.imageData.data.buffer);
  }

  /**
   * Собирает палитру из RGB-троек в массив упакованных пикселей формата,
   * совместимого с ImageData (порядок байт зависит от порядка байт платформы,
   * на практике little-endian: 0xAABBGGRR).
   */
  private buildPalette(rgb: [number, number, number][]): Uint32Array {
    const out = new Uint32Array(4);
    for (let i = 0; i < 4; i++) {
      const [r, g, b] = rgb[i];
      // Альфа = 0xFF (непрозрачный). Порядок little-endian: A B G R.
      out[i] = (0xff << 24) | (b << 16) | (g << 8) | r;
    }
    return out;
  }

  /** Очищает весь экран в чёрный (цвет 0). */
  clearScreen(): void {
    this.pixels.fill(0);
  }

  /** Возвращает текущее системное время в миллисекундах (замена чтения аппаратного таймера). */
  getCurrentTimeMillis(): number {
    return Date.now();
  }

  /** Заглушка (в оригинале: инициализация регистров режима CGA 4). */
  init(): void {}

  /** Переключает обычную (0) и яркую (1) палитру. */
  setIntensity(inten: number): void {
    this.currentPalette = this.palettes[inten & 1];
  }

  /** Заглушка (в оригинале: выбор палитры CGA 0 или 1 через порт 3D9h). */
  setPalette(_pal: number): void {}

  /**
   * Рисует спрайт с маской. Прозрачные пиксели (биты маски = 1) пропускаются,
   * сохраняя фон.
   *
   * @param ch индекс в {@link CGA_TABLE}: спрайт в [ch*2], маска в [ch*2+1]
   * @param w  ширина в упакованных единицах (1 единица = 4 пикселя)
   * @param h  высота в строках
   */
  drawSpriteMasked(x: number, y: number, ch: number, w: number, h: number): void {
    const spr = CGA_TABLE[ch * 2];
    const msk = CGA_TABLE[ch * 2 + 1];
    if (!spr || !msk) return;
    const pixels = this.pixels;
    let src = 0;
    let dest = y * this.width + (x & 0xfffc);
    for (let i = 0; i < h; i++) {
      let d = dest;
      for (let j = 0; j < w; j++) {
        let px = spr[src];
        const mx = msk[src];
        src++;
        if ((mx & 3) === 0) pixels[d + 3] = px & 3;
        px >>= 2;
        if ((mx & (3 << 2)) === 0) pixels[d + 2] = px & 3;
        px >>= 2;
        if ((mx & (3 << 4)) === 0) pixels[d + 1] = px & 3;
        px >>= 2;
        if ((mx & (3 << 6)) === 0) pixels[d] = px & 3;
        d += 4;
        if (src === spr.length || src === msk.length) return;
      }
      dest += this.width;
    }
  }

  /**
   * Преобразует буфер значений 0-3 в RGBA через текущую палитру
   * и выводит на canvas. Вызывается игровым циклом раз в кадр.
   */
  render(): void {
    const { pixels, rgba, currentPalette, size } = this;
    for (let i = 0; i < size; i++) {
      rgba[i] = currentPalette[pixels[i]];
    }
    this.ctx.putImageData(this.imageData, 0, 0);
  }
}
