import { CgaDisplay } from "./CgaDisplay.ts";

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const display = new CgaDisplay(canvas);

/**
 * Целочисленное масштабирование canvas под размер окна средствами CSS.
 * Внутренний размер буфера остаётся 320×200, браузер растягивает без сглаживания.
 */
function resize(): void {
  const scale = Math.max(
    1,
    Math.floor(Math.min(window.innerWidth / display.width, window.innerHeight / display.height)),
  );
  canvas.style.width = `${display.width * scale}px`;
  canvas.style.height = `${display.height * scale}px`;
}
window.addEventListener("resize", resize);
resize();

// --- Временная проверка Этапа 2: отрисовка настоящих спрайтов из данных ---
// Рисуем диггера в 4 направлениях + анимацию кадров. Будет удалено на этапе игры.

// Индексы в CGA_TABLE (пары спрайт/маска): диггер вправо/вверх/влево/вниз, кадры 1-3.
const DIGGER_RIGHT = 1;
const DIGGER_UP = 7;
const DIGGER_LEFT = 13;
const DIGGER_DOWN = 19;
const DIGGER_W = 4; // ширина в упакованных единицах (16 пикселей)
const DIGGER_H = 15; // высота в строках

let frame = 0;

function drawDemo(): void {
  display.clearScreen();

  // Кадр анимации 0..2, меняется каждые 8 кадров рендера.
  const animFrame = Math.floor(frame / 8) % 3;

  display.drawSpriteMasked(40, 40, DIGGER_RIGHT + animFrame, DIGGER_W, DIGGER_H);
  display.drawSpriteMasked(120, 40, DIGGER_UP + animFrame, DIGGER_W, DIGGER_H);
  display.drawSpriteMasked(200, 40, DIGGER_LEFT + animFrame, DIGGER_W, DIGGER_H);
  display.drawSpriteMasked(280, 40, DIGGER_DOWN + animFrame, DIGGER_W, DIGGER_H);
}

function loop(): void {
  drawDemo();
  display.render();
  frame++;
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
