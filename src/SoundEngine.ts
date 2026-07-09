import type { Sound } from "./Sound.ts";

/**
 * Эмуляция вывода PC Speaker через Web Audio API.
 *
 * Оригинал (org.digger.app.SoundEngine) вручную генерировал сэмплы квадратной
 * волны в отдельном потоке Java Sound. В браузере тот же результат достигается
 * проще: постоянный OscillatorNode типа "square" + GainNode, у которых на тике
 * 73 Гц обновляются частота и громкость по значениям таймеров 8253.
 *
 * Частота из делителя таймера: freq = 1193180 / divisor (Гц).
 * Режимы (spkrmode): 0 — таймер 2 (SFX), 1/2 — таймер 0 (музыка).
 */
export class SoundEngine {
  private static readonly CRYSTAL_FREQ = 1193180;
  private static readonly UPDATE_RATE_HZ = 73;
  private static readonly MASTER_VOLUME = 0.25;
  private static readonly MIN_AUDIBLE_FREQ = 20;
  private static readonly MAX_AUDIBLE_FREQ = 20000;

  private readonly sound: Sound;

  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private intervalId: number | null = null;

  private t0 = 0x7d00;
  private t2 = 40;
  private mode = 0;
  private pulseWidth = 1;

  constructor(sound: Sound) {
    this.sound = sound;
  }

  /** Инициализирует аудиограф и запускает тик soundInt(). Возвращает false при неудаче. */
  start(): boolean {
    try {
      this.ctx = new AudioContext();
      this.osc = this.ctx.createOscillator();
      this.osc.type = "square";
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.osc.connect(this.gain).connect(this.ctx.destination);
      this.osc.frequency.value = 440;
      this.osc.start();
    } catch {
      this.ctx = null;
      return false;
    }
    // Тик прерывания IRQ0 (soundInt) с частотой 73 Гц — двигает все эффекты и музыку.
    this.intervalId = window.setInterval(() => this.sound.soundInt(), 1000 / SoundEngine.UPDATE_RATE_HZ);
    return true;
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    try {
      this.osc?.stop();
    } catch {
      /* уже остановлен */
    }
    void this.ctx?.close();
    this.ctx = null;
    this.osc = null;
    this.gain = null;
  }

  /** Возобновляет AudioContext (браузеры создают его приостановленным до жеста пользователя). */
  resume(): void {
    void this.ctx?.resume();
  }

  updateT0Val(val: number): void {
    this.t0 = val;
    this.applyParams();
  }

  updateT2Val(val: number): void {
    this.t2 = val;
    this.applyParams();
  }

  updateSpkrMode(m: number): void {
    this.mode = m;
    this.applyParams();
  }

  updatePulseWidth(pw: number): void {
    this.pulseWidth = pw;
    this.applyParams();
  }

  /** Пересчитывает частоту и громкость осциллятора по текущим значениям таймеров. */
  private applyParams(): void {
    if (!this.ctx || !this.osc || !this.gain) return;
    const pw = Math.max(this.pulseWidth, 1);
    let frequency: number;
    let amplitude: number;
    if (this.mode === 0) {
      frequency = this.t2 !== 0 ? SoundEngine.CRYSTAL_FREQ / this.t2 : 0;
      amplitude = SoundEngine.MASTER_VOLUME;
    } else {
      frequency = this.t0 !== 0 ? SoundEngine.CRYSTAL_FREQ / this.t0 : 0;
      amplitude = Math.min(pw / 50, 1) * SoundEngine.MASTER_VOLUME;
    }
    const now = this.ctx.currentTime;
    if (frequency < SoundEngine.MIN_AUDIBLE_FREQ || frequency > SoundEngine.MAX_AUDIBLE_FREQ) {
      this.gain.gain.setValueAtTime(0, now);
      return;
    }
    this.osc.frequency.setValueAtTime(frequency, now);
    this.gain.gain.setValueAtTime(amplitude, now);
  }
}
