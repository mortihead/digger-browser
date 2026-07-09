import { CgaDisplay } from "./CgaDisplay.ts";
import { SpriteEngine } from "./SpriteEngine.ts";
import { Drawing } from "./Drawing.ts";
import { Main } from "./Main.ts";

/**
 * Главный класс-контейнер игры. В оригинале (org.digger.app.Digger) это
 * «god object», через который все подсистемы видят друг друга: dig.display,
 * dig.sprite, dig.drawing, dig.main.
 *
 * ВНИМАНИЕ: пока собраны только подсистемы для отрисовки статичного уровня.
 * Игровая логика (движение, монстры, мешки, звук, ввод, игровой цикл) будет
 * добавлена на следующих этапах.
 */
export class Digger {
  readonly display: CgaDisplay;
  readonly sprite: SpriteEngine;
  readonly drawing: Drawing;
  readonly main: Main;

  constructor(canvas: HTMLCanvasElement) {
    this.display = new CgaDisplay(canvas);
    this.sprite = new SpriteEngine(this);
    this.drawing = new Drawing(this);
    this.main = new Main(this);
  }
}
