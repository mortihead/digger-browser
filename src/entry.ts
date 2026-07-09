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
    Math.floor(Math.min(window.innerWidth / dig.width, window.innerHeight / dig.height)),
  );
  canvas.style.width = `${dig.width * scale}px`;
  canvas.style.height = `${dig.height * scale}px`;
}
window.addEventListener("resize", resize);
resize();

// Привязка клавиатуры: keyDown возвращает true для игровых клавиш — гасим их
// стандартное поведение (прокрутка стрелками, действия F-клавиш и т.п.).
window.addEventListener("keydown", (e) => {
  if (dig.keyDown(e.key)) e.preventDefault();
});
window.addEventListener("keyup", (e) => dig.keyUp(e.key));

// Временный доступ для отладки (Этап 4).
(globalThis as unknown as { dig: Digger }).dig = dig;

void dig.start();
