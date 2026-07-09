import { Digger } from "./Digger.ts";

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const dig = new Digger(canvas);

/**
 * Целочисленное масштабирование canvas под размер окна средствами CSS.
 * Внутренний размер буфера остаётся 320×200, браузер растягивает без сглаживания.
 */
function resize(): void {
  const scale = Math.max(
    1,
    Math.floor(Math.min(window.innerWidth / dig.display.width, window.innerHeight / dig.display.height)),
  );
  canvas.style.width = `${dig.display.width * scale}px`;
  canvas.style.height = `${dig.display.height * scale}px`;
}
window.addEventListener("resize", resize);
resize();

// --- Проверка Этапа 3: статичная отрисовка уровня 1 ---
// Строим поле из данных уровня, рисуем фон, кромки туннелей и текст.
// Мешки, изумруды, диггер и монстры появятся на этапе игрового цикла.

dig.display.clearScreen();
dig.display.setIntensity(0);
dig.drawing.buildField();
dig.drawing.createAllSprites();
dig.drawing.drawFieldAndBackground();
dig.drawing.drawText("DIGGER", 108, 0, 3);

// Временный доступ для отладки (Этап 3).
(globalThis as unknown as { dig: Digger }).dig = dig;

function loop(): void {
  dig.display.render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
