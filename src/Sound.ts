import type { Digger } from "./Digger.ts";

/**
 * Эмуляция звука PC Speaker.
 *
 * ВНИМАНИЕ: пока это заглушка — все методы ничего не делают. Полная реализация
 * синтеза (Web Audio API, эмуляция таймеров 8253) будет добавлена на этапе звука.
 * Поля и сигнатуры соответствуют оригиналу org.digger.app.Sound, чтобы игровая
 * логика вызывала их без изменений.
 */
export class Sound {
  volume = 0;
  soundFlag = true;
  musicFlag = true;
  musicPlaying = false;
  tuneno = 0;

  constructor(_d: Digger) {}

  initSound(): void {}
  setupSound(): void {}
  killSound(): void {}
  soundStop(): void {}

  music(_tune: number): void {}
  musicOff(): void {}

  setSoundT2(): void {}
  setT2Val(_t2v: number): void {}

  sound1Up(): void {}
  soundBonus(): void {}
  soundBonusOff(): void {}
  soundBreak(): void {}
  soundDdie(): void {}
  soundEatm(): void {}
  soundEm(): void {}
  soundEmerald(_emocttime: number): void {}
  soundExplode(): void {}
  soundFall(): void {}
  soundFallOff(): void {}
  soundFire(): void {}
  soundFireOff(): void {}
  soundGold(): void {}
  soundLevDone(): void {}
  soundPause(): void {}
  soundPauseOff(): void {}
  soundWobble(): void {}
  soundWobbleOff(): void {}
}
