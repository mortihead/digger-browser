import type { Digger } from "./Digger.ts";
import { SoundEngine } from "./SoundEngine.ts";

/**
 * Эмуляция звука PC Speaker для Digger.
 *
 * Оригинально управлялся таймером Intel 8253 и прерываниями IRQ0 (Int 8).
 * Здесь soundInt() вызывается движком {@link SoundEngine} с частотой 73 Гц,
 * а сам звук синтезируется квадратной волной через Web Audio API.
 * Порт org.digger.app.Sound.
 *
 * Делитель таймера → частота: freq = 1193180 / divisor (Гц).
 * 0x7d00 (32000) → ~37 Гц (маркер тишины); 0x8e8 (2280) → ~523 Гц (C5).
 */
export class Sound {
  private static readonly SILENCE_T0VAL = 0x7d00;
  private static readonly DEFAULT_T2VAL = 40;

  private readonly dig: Digger;
  private engine: SoundEngine | null = null;

  wavetype = 0;
  t2val = 0;
  t0val = 0;
  musvol = 0;
  spkrmode = 0;
  pulsewidth = 1;
  volume = 0;

  timerClock = 0;

  soundFlag = true;
  musicFlag = true;
  sndFlag = false;
  soundPausedFlag = false;

  // --- Джингл окончания уровня ---
  soundLevDoneFlag = false;
  nljpointer = 0;
  nljnoteduration = 0;
  private readonly newlevjingle = [0x8e8, 0x712, 0x5f2, 0x7f0, 0x6ac, 0x54c, 0x712, 0x5f2, 0x4b8, 0x474, 0x474];

  // --- Звук падения ---
  soundFallFlag = false;
  soundFallF = false;
  soundfallvalue = 0;
  soundfalln = 0;

  // --- Звук разбивания ---
  soundBreakFlag = false;
  soundbreakduration = 0;
  soundbreakvalue = 0;

  // --- Звук качания ---
  soundWobbleFlag = false;
  soundwobblen = 0;

  // --- Звук выстрела ---
  soundFireFlag = false;
  soundfirevalue = 0;
  soundfiren = 0;

  // --- Звук взрыва ---
  soundExplodeFlag = false;
  soundexplodevalue = 0;
  soundexplodeduration = 0;

  // --- Звук бонуса ---
  soundBonusFlag = false;
  soundbonusn = 0;

  // --- Звук монстра-изумруда ---
  soundEmFlag = false;

  // --- Звук сбора изумруда ---
  soundEmeraldFlag = false;
  soundemeraldduration = 0;
  emerfreq = 0;
  soundemeraldn = 0;

  // --- Звук сбора золота ---
  soundGoldFlag = false;
  soundGoldF = false;
  soundgoldvalue1 = 0;
  soundgoldvalue2 = 0;
  soundgoldduration = 0;

  // --- Звук поедания монстра ---
  soundEatmFlag = false;
  soundeatmvalue = 0;
  soundeatmduration = 0;
  soundeatmn = 0;

  // --- Звук смерти диггера ---
  soundDdieFlag = false;
  soundddien = 0;
  soundddievalue = 0;

  // --- Звук 1-Up ---
  sound1UpFlag = false;
  sound1upduration = 0;

  // --- Состояние музыки ---
  musicPlaying = false;
  musicp = 0;
  tuneno = 0;
  noteduration = 0;
  notevalue = 0;
  musicmaxvol = 0;
  musicattackrate = 0;
  musicsustainlevel = 0;
  musicdecayrate = 0;
  musicnotewidth = 0;
  musicreleaserate = 0;
  musicstage = 0;
  musicn = 0;

  soundT0Flag = false;
  int8Flag = false;

  // Мелодии (формат: [freq1, dur1, freq2, dur2, ...], завершается 0x7d64)
  private readonly bonusjingle = [
    0x11d1, 2, 0x11d1, 2, 0x11d1, 4, 0x11d1, 2, 0x11d1, 2, 0x11d1, 4, 0x11d1, 2, 0x11d1, 2,
    0xd59, 4, 0xbe4, 4, 0xa98, 4, 0x11d1, 2, 0x11d1, 2, 0x11d1, 4, 0x11d1, 2, 0x11d1, 2,
    0x11d1, 4, 0xd59, 2, 0xa98, 2, 0xbe4, 4, 0xe24, 4, 0x11d1, 4, 0x11d1, 2, 0x11d1, 2,
    0x11d1, 4, 0x11d1, 2, 0x11d1, 2, 0x11d1, 4, 0x11d1, 2, 0x11d1, 2, 0xd59, 4, 0xbe4, 4,
    0xa98, 4, 0xd59, 2, 0xa98, 2, 0x8e8, 10, 0xa00, 2, 0xa98, 2, 0xbe4, 2, 0xd59, 4,
    0xa98, 4, 0xd59, 4, 0x11d1, 2, 0x11d1, 2, 0x11d1, 4, 0x11d1, 2, 0x11d1, 2, 0x11d1, 4,
    0x11d1, 2, 0x11d1, 2, 0xd59, 4, 0xbe4, 4, 0xa98, 4, 0x11d1, 2, 0x11d1, 2, 0x11d1, 4,
    0x11d1, 2, 0x11d1, 2, 0x11d1, 4, 0xd59, 2, 0xa98, 2, 0xbe4, 4, 0xe24, 4, 0x11d1, 4,
    0x11d1, 2, 0x11d1, 2, 0x11d1, 4, 0x11d1, 2, 0x11d1, 2, 0x11d1, 4, 0x11d1, 2, 0x11d1, 2,
    0xd59, 4, 0xbe4, 4, 0xa98, 4, 0xd59, 2, 0xa98, 2, 0x8e8, 10, 0xa00, 2, 0xa98, 2,
    0xbe4, 2, 0xd59, 4, 0xa98, 4, 0xd59, 4, 0xa98, 2, 0xa98, 2, 0xa98, 4, 0xa98, 2,
    0xa98, 2, 0xa98, 4, 0xa98, 2, 0xa98, 2, 0xa98, 4, 0x7f0, 4, 0xa98, 4, 0x7f0, 4,
    0xa98, 4, 0x7f0, 4, 0xa98, 4, 0xbe4, 4, 0xd59, 4, 0xe24, 4, 0xfdf, 4, 0xa98, 2,
    0xa98, 2, 0xa98, 4, 0xa98, 2, 0xa98, 2, 0xa98, 4, 0xa98, 2, 0xa98, 2, 0xa98, 4,
    0x7f0, 4, 0xa98, 4, 0x7f0, 4, 0xa98, 4, 0x7f0, 4, 0x8e8, 4, 0x970, 4, 0x8e8, 4,
    0x970, 4, 0x8e8, 4, 0xa98, 2, 0xa98, 2, 0xa98, 4, 0xa98, 2, 0xa98, 2, 0xa98, 4,
    0xa98, 2, 0xa98, 2, 0xa98, 4, 0x7f0, 4, 0xa98, 4, 0x7f0, 4, 0xa98, 4, 0x7f0, 4,
    0xa98, 4, 0xbe4, 4, 0xd59, 4, 0xe24, 4, 0xfdf, 4, 0xa98, 2, 0xa98, 2, 0xa98, 4,
    0xa98, 2, 0xa98, 2, 0xa98, 4, 0xa98, 2, 0xa98, 2, 0xa98, 4, 0x7f0, 4, 0xa98, 4,
    0x7f0, 4, 0xa98, 4, 0x7f0, 4, 0x8e8, 4, 0x970, 4, 0x8e8, 4, 0x970, 4, 0x8e8, 4,
    0x7d64,
  ];

  private readonly backgjingle = [
    0xfdf, 2, 0x11d1, 2, 0xfdf, 2, 0x1530, 2, 0x1ab2, 2, 0x1530, 2, 0x1fbf, 4, 0xfdf, 2,
    0x11d1, 2, 0xfdf, 2, 0x1530, 2, 0x1ab2, 2, 0x1530, 2, 0x1fbf, 4, 0xfdf, 2, 0xe24, 2,
    0xd59, 2, 0xe24, 2, 0xd59, 2, 0xfdf, 2, 0xe24, 2, 0xfdf, 2, 0xe24, 2, 0x11d1, 2,
    0xfdf, 2, 0x11d1, 2, 0xfdf, 2, 0x1400, 2, 0xfdf, 4, 0xfdf, 2, 0x11d1, 2, 0xfdf, 2,
    0x1530, 2, 0x1ab2, 2, 0x1530, 2, 0x1fbf, 4, 0xfdf, 2, 0x11d1, 2, 0xfdf, 2, 0x1530, 2,
    0x1ab2, 2, 0x1530, 2, 0x1fbf, 4, 0xfdf, 2, 0xe24, 2, 0xd59, 2, 0xe24, 2, 0xd59, 2,
    0xfdf, 2, 0xe24, 2, 0xfdf, 2, 0xe24, 2, 0x11d1, 2, 0xfdf, 2, 0x11d1, 2, 0xfdf, 2,
    0xe24, 2, 0xd59, 4, 0xa98, 2, 0xbe4, 2, 0xa98, 2, 0xd59, 2, 0x11d1, 2, 0xd59, 2,
    0x1530, 4, 0xa98, 2, 0xbe4, 2, 0xa98, 2, 0xd59, 2, 0x11d1, 2, 0xd59, 2, 0x1530, 4,
    0xa98, 2, 0x970, 2, 0x8e8, 2, 0x970, 2, 0x8e8, 2, 0xa98, 2, 0x970, 2, 0xa98, 2,
    0x970, 2, 0xbe4, 2, 0xa98, 2, 0xbe4, 2, 0xa98, 2, 0xd59, 2, 0xa98, 4, 0xa98, 2,
    0xbe4, 2, 0xa98, 2, 0xd59, 2, 0x11d1, 2, 0xd59, 2, 0x1530, 4, 0xa98, 2, 0xbe4, 2,
    0xa98, 2, 0xd59, 2, 0x11d1, 2, 0xd59, 2, 0x1530, 4, 0xa98, 2, 0x970, 2, 0x8e8, 2,
    0x970, 2, 0x8e8, 2, 0xa98, 2, 0x970, 2, 0xa98, 2, 0x970, 2, 0xbe4, 2, 0xa98, 2,
    0xbe4, 2, 0xa98, 2, 0xd59, 2, 0xa98, 4, 0x7f0, 2, 0x8e8, 2, 0xa98, 2, 0xd59, 2,
    0x11d1, 2, 0xd59, 2, 0x1530, 4, 0xa98, 2, 0xbe4, 2, 0xa98, 2, 0xd59, 2, 0x11d1, 2,
    0xd59, 2, 0x1530, 4, 0xa98, 2, 0x970, 2, 0x8e8, 2, 0x970, 2, 0x8e8, 2, 0xa98, 2,
    0x970, 2, 0xa98, 2, 0x970, 2, 0xbe4, 2, 0xa98, 2, 0xbe4, 2, 0xd59, 2, 0xbe4, 2,
    0xa98, 4, 0x7d64,
  ];

  private readonly dirge = [
    0x7d00, 2, 0x11d1, 6, 0x11d1, 4, 0x11d1, 2, 0x11d1, 6, 0xefb, 4, 0xfdf, 2,
    0xfdf, 4, 0x11d1, 2, 0x11d1, 4, 0x12e0, 2, 0x11d1, 12, 0x7d00, 16, 0x7d00, 16,
    0x7d00, 16, 0x7d00, 16, 0x7d00, 16, 0x7d00, 16, 0x7d00, 16, 0x7d00, 16,
    0x7d00, 16, 0x7d00, 16, 0x7d00, 16, 0x7d64,
  ];

  constructor(d: Digger) {
    this.dig = d;
  }

  private pushToEngine(): void {
    if (this.engine) {
      this.engine.updateT0Val(this.t0val);
      this.engine.updateT2Val(this.t2val);
      this.engine.updateSpkrMode(this.spkrmode);
      this.engine.updatePulseWidth(this.pulsewidth);
    }
  }

  /** Возобновляет аудиоконтекст (вызывать по первому жесту пользователя). */
  resume(): void {
    this.engine?.resume();
  }

  /** Приостанавливает аудиоконтекст (при потере фокуса вкладкой). */
  suspend(): void {
    this.engine?.suspend();
  }

  initSound(): void {
    this.wavetype = 2;
    this.t0val = 12000;
    this.musvol = 8;
    this.t2val = 40;
    this.soundT0Flag = true;
    this.sndFlag = true;
    this.spkrmode = 0;
    this.int8Flag = false;
    this.musicPlaying = false;
    this.setSoundT2();
    this.soundStop();
    this.startInt8();

    this.engine = new SoundEngine(this);
    if (!this.engine.start()) this.engine = null;
  }

  killSound(): void {
    if (this.engine) {
      this.engine.stop();
      this.engine = null;
    }
    this.stopInt8();
  }

  music(tune: number): void {
    this.tuneno = tune;
    this.musicp = 0;
    this.noteduration = 0;
    switch (tune) {
      case 0:
        this.musicmaxvol = 50;
        this.musicattackrate = 20;
        this.musicsustainlevel = 20;
        this.musicdecayrate = 10;
        this.musicreleaserate = 4;
        break;
      case 1:
        this.musicmaxvol = 50;
        this.musicattackrate = 50;
        this.musicsustainlevel = 8;
        this.musicdecayrate = 15;
        this.musicreleaserate = 1;
        break;
      case 2:
        this.musicmaxvol = 50;
        this.musicattackrate = 50;
        this.musicsustainlevel = 25;
        this.musicdecayrate = 5;
        this.musicreleaserate = 1;
        break;
    }
    this.musicPlaying = true;
    if (tune === 2) this.soundDdieOff();
  }

  musicOff(): void {
    this.musicPlaying = false;
    this.musicp = 0;
  }

  musicUpdate(): void {
    if (!this.musicPlaying) return;
    if (this.noteduration !== 0) {
      this.noteduration--;
    } else {
      this.musicstage = this.musicn = 0;
      switch (this.tuneno) {
        case 0:
          this.noteduration = this.bonusjingle[this.musicp + 1] * 3;
          this.musicnotewidth = this.noteduration - 3;
          this.notevalue = this.bonusjingle[this.musicp];
          this.musicp += 2;
          if (this.bonusjingle[this.musicp] === 0x7d64) this.musicp = 0;
          break;
        case 1:
          this.noteduration = this.backgjingle[this.musicp + 1] * 6;
          this.musicnotewidth = 12;
          this.notevalue = this.backgjingle[this.musicp];
          this.musicp += 2;
          if (this.backgjingle[this.musicp] === 0x7d64) this.musicp = 0;
          break;
        case 2:
          this.noteduration = this.dirge[this.musicp + 1] * 10;
          this.musicnotewidth = this.noteduration - 10;
          this.notevalue = this.dirge[this.musicp];
          this.musicp += 2;
          if (this.dirge[this.musicp] === 0x7d64) this.musicp = 0;
          break;
      }
    }
    this.musicn++;
    this.wavetype = 1;
    this.t0val = this.notevalue;
    if (this.musicn >= this.musicnotewidth) this.musicstage = 2;
    switch (this.musicstage) {
      case 0:
        if (this.musvol + this.musicattackrate >= this.musicmaxvol) {
          this.musicstage = 1;
          this.musvol = this.musicmaxvol;
          break;
        }
        this.musvol += this.musicattackrate;
        break;
      case 1:
        if (this.musvol - this.musicdecayrate <= this.musicsustainlevel) {
          this.musvol = this.musicsustainlevel;
          break;
        }
        this.musvol -= this.musicdecayrate;
        break;
      case 2:
        if (this.musvol - this.musicreleaserate <= 1) {
          this.musvol = 1;
          break;
        }
        this.musvol -= this.musicreleaserate;
    }
    if (this.musvol === 1) this.t0val = Sound.SILENCE_T0VAL;
  }

  setSoundMode(): void {
    this.spkrmode = this.wavetype;
    if (!this.soundT0Flag && this.sndFlag) this.soundT0Flag = true;
  }

  setSoundT2(): void {
    if (this.soundT0Flag) {
      this.spkrmode = 0;
      this.soundT0Flag = false;
    }
  }

  setT0(): void {
    if (this.sndFlag) {
      if (this.t0val < 1000 && (this.wavetype === 1 || this.wavetype === 2)) this.t0val = 1000;
      if (this.musvol < 1) this.musvol = 1;
      if (this.musvol > 50) this.musvol = 50;
      this.pulsewidth = this.musvol * this.volume;
      this.setSoundMode();
    }
  }

  setT2Val(t2v: number): void {
    this.t2val = t2v;
  }

  setupSound(): void {
    if (this.engine === null) {
      this.sndFlag = true;
      this.startInt8();
      this.engine = new SoundEngine(this);
      if (!this.engine.start()) this.engine = null;
    }
  }

  sound1Up(): void {
    this.sound1upduration = 96;
    this.sound1UpFlag = true;
  }

  sound1UpOff(): void {
    this.sound1UpFlag = false;
  }

  sound1UpUpdate(): void {
    if (this.sound1UpFlag) {
      if (Math.trunc(this.sound1upduration / 3) % 2 !== 0) this.t2val = (this.sound1upduration << 2) + 600;
      this.sound1upduration--;
      if (this.sound1upduration < 1) this.sound1UpFlag = false;
    }
  }

  soundBonus(): void {
    this.soundBonusFlag = true;
  }

  soundBonusOff(): void {
    this.soundBonusFlag = false;
    this.soundbonusn = 0;
  }

  soundBonusUpdate(): void {
    if (this.soundBonusFlag) {
      this.soundbonusn++;
      if (this.soundbonusn > 15) this.soundbonusn = 0;
      if (this.soundbonusn >= 0 && this.soundbonusn < 6) this.t2val = 0x4ce;
      if (this.soundbonusn >= 8 && this.soundbonusn < 14) this.t2val = 0x5e9;
    }
  }

  soundBreak(): void {
    this.soundbreakduration = 3;
    if (this.soundbreakvalue < 15000) this.soundbreakvalue = 15000;
    this.soundBreakFlag = true;
  }

  soundBreakOff(): void {
    this.soundBreakFlag = false;
  }

  soundBreakUpdate(): void {
    if (this.soundBreakFlag)
      if (this.soundbreakduration !== 0) {
        this.soundbreakduration--;
        this.t2val = this.soundbreakvalue;
      } else this.soundBreakFlag = false;
  }

  soundDdie(): void {
    this.soundddien = 0;
    this.soundddievalue = 20000;
    this.soundDdieFlag = true;
  }

  soundDdieOff(): void {
    this.soundDdieFlag = false;
  }

  soundDdieUpdate(): void {
    if (this.soundDdieFlag) {
      this.soundddien++;
      if (this.soundddien === 1) this.musicOff();
      if (this.soundddien >= 1 && this.soundddien <= 10) this.soundddievalue = 20000 - this.soundddien * 1000;
      if (this.soundddien > 10) this.soundddievalue += 500;
      if (this.soundddievalue > 30000) this.soundDdieOff();
      this.t2val = this.soundddievalue;
    }
  }

  soundEatm(): void {
    this.soundeatmduration = 20;
    this.soundeatmn = 3;
    this.soundeatmvalue = 2000;
    this.soundEatmFlag = true;
  }

  soundEatmOff(): void {
    this.soundEatmFlag = false;
  }

  soundEatmUpdate(): void {
    if (this.soundEatmFlag)
      if (this.soundeatmn !== 0) {
        if (this.soundeatmduration !== 0) {
          if (this.soundeatmduration % 4 === 1) this.t2val = this.soundeatmvalue;
          if (this.soundeatmduration % 4 === 3) this.t2val = this.soundeatmvalue - (this.soundeatmvalue >> 4);
          this.soundeatmduration--;
          this.soundeatmvalue -= this.soundeatmvalue >> 4;
        } else {
          this.soundeatmduration = 20;
          this.soundeatmn--;
          this.soundeatmvalue = 2000;
        }
      } else this.soundEatmFlag = false;
  }

  soundEm(): void {
    this.soundEmFlag = true;
  }

  soundEmerald(emocttime: number): void {
    if (emocttime !== 0) {
      switch (this.emerfreq) {
        case 0x8e8:
          this.emerfreq = 0x7f0;
          break;
        case 0x7f0:
          this.emerfreq = 0x712;
          break;
        case 0x712:
          this.emerfreq = 0x6ac;
          break;
        case 0x6ac:
          this.emerfreq = 0x5f2;
          break;
        case 0x5f2:
          this.emerfreq = 0x54c;
          break;
        case 0x54c:
          this.emerfreq = 0x4b8;
          break;
        case 0x4b8:
          this.emerfreq = 0x474;
          this.dig.scores.scoreOctave();
          break;
        case 0x474:
          this.emerfreq = 0x8e8;
          break;
      }
    } else {
      this.emerfreq = 0x8e8;
    }
    this.soundemeraldduration = 7;
    this.soundemeraldn = 0;
    this.soundEmeraldFlag = true;
  }

  soundEmeraldOff(): void {
    this.soundEmeraldFlag = false;
  }

  soundEmeraldUpdate(): void {
    if (this.soundEmeraldFlag)
      if (this.soundemeraldduration !== 0) {
        if (this.soundemeraldn === 0 || this.soundemeraldn === 1) this.t2val = this.emerfreq;
        this.soundemeraldn++;
        if (this.soundemeraldn > 7) {
          this.soundemeraldn = 0;
          this.soundemeraldduration--;
        }
      } else this.soundEmeraldOff();
  }

  soundEmOff(): void {
    this.soundEmFlag = false;
  }

  soundEmUpdate(): void {
    if (this.soundEmFlag) {
      this.t2val = 1000;
      this.soundEmOff();
    }
  }

  soundExplode(): void {
    this.soundexplodevalue = 1500;
    this.soundexplodeduration = 10;
    this.soundExplodeFlag = true;
    this.soundFireOff();
  }

  soundExplodeOff(): void {
    this.soundExplodeFlag = false;
  }

  soundExplodeUpdate(): void {
    if (this.soundExplodeFlag)
      if (this.soundexplodeduration !== 0) {
        this.soundexplodevalue = this.t2val = this.soundexplodevalue - (this.soundexplodevalue >> 3);
        this.soundexplodeduration--;
      } else this.soundExplodeFlag = false;
  }

  soundFall(): void {
    this.soundfallvalue = 1000;
    this.soundFallFlag = true;
  }

  soundFallOff(): void {
    this.soundFallFlag = false;
    this.soundfalln = 0;
  }

  soundFallUpdate(): void {
    if (this.soundFallFlag)
      if (this.soundfalln < 1) {
        this.soundfalln++;
        if (this.soundFallF) this.t2val = this.soundfallvalue;
      } else {
        this.soundfalln = 0;
        if (this.soundFallF) {
          this.soundfallvalue += 50;
          this.soundFallF = false;
        } else this.soundFallF = true;
      }
  }

  soundFire(): void {
    this.soundfirevalue = 500;
    this.soundFireFlag = true;
  }

  soundFireOff(): void {
    this.soundFireFlag = false;
    this.soundfiren = 0;
  }

  soundFireUpdate(): void {
    if (this.soundFireFlag) {
      if (this.soundfiren === 1) {
        this.soundfiren = 0;
        this.soundfirevalue += Math.trunc(this.soundfirevalue / 55);
        this.t2val = this.soundfirevalue + this.dig.main.randomNumber(this.soundfirevalue >> 3);
        if (this.soundfirevalue > 30000) this.soundFireOff();
      } else this.soundfiren++;
    }
  }

  soundGold(): void {
    this.soundgoldvalue1 = 500;
    this.soundgoldvalue2 = 4000;
    this.soundgoldduration = 30;
    this.soundGoldF = false;
    this.soundGoldFlag = true;
  }

  soundGoldOff(): void {
    this.soundGoldFlag = false;
  }

  soundGoldUpdate(): void {
    if (this.soundGoldFlag) {
      if (this.soundgoldduration !== 0) this.soundgoldduration--;
      else this.soundGoldFlag = false;
      if (this.soundGoldF) {
        this.soundGoldF = false;
        this.t2val = this.soundgoldvalue1;
      } else {
        this.soundGoldF = true;
        this.t2val = this.soundgoldvalue2;
      }
      this.soundgoldvalue1 += this.soundgoldvalue1 >> 4;
      this.soundgoldvalue2 -= this.soundgoldvalue2 >> 4;
    }
  }

  /** Основной обработчик звукового прерывания (замена аппаратного Int 8). */
  soundInt(): void {
    if (this.soundLevDoneFlag) return;
    this.timerClock++;
    if (this.soundFlag && !this.sndFlag) this.sndFlag = true;
    if (!this.soundFlag && this.sndFlag) {
      this.sndFlag = false;
      this.setSoundT2();
      if (this.engine) {
        this.engine.updateT0Val(Sound.SILENCE_T0VAL);
        this.engine.updateT2Val(Sound.DEFAULT_T2VAL);
        this.engine.updateSpkrMode(0);
      }
    }
    if (!this.musicFlag && this.musicPlaying) this.musicOff();
    if (this.sndFlag && !this.soundPausedFlag) {
      this.t0val = Sound.SILENCE_T0VAL;
      this.t2val = Sound.DEFAULT_T2VAL;
      if (this.musicFlag) this.musicUpdate();
      this.soundEmeraldUpdate();
      this.soundWobbleUpdate();
      this.soundDdieUpdate();
      this.soundBreakUpdate();
      this.soundGoldUpdate();
      this.soundEmUpdate();
      this.soundExplodeUpdate();
      this.soundFireUpdate();
      this.soundEatmUpdate();
      this.soundFallUpdate();
      this.sound1UpUpdate();
      this.soundBonusUpdate();
      if (this.t0val === Sound.SILENCE_T0VAL || this.t2val !== Sound.DEFAULT_T2VAL) this.setSoundT2();
      else {
        this.setSoundMode();
        this.setT0();
      }
      this.setT2Val(this.t2val);
      this.pushToEngine();
    }
  }

  /** Джингл окончания уровня (блокирующий цикл оригинала переведён в async). */
  async soundLevDone(): Promise<void> {
    this.soundStop();
    this.nljpointer = 0;
    this.nljnoteduration = 20;
    this.soundLevDoneFlag = true;
    while (this.soundLevDoneFlag) {
      this.timerClock++;
      this.soundLevDoneUpdate();
      await new Promise((resolve) => setTimeout(resolve, 14));
    }
  }

  soundLevDoneOff(): void {
    this.soundLevDoneFlag = false;
  }

  soundLevDoneUpdate(): void {
    if (this.sndFlag) {
      if (this.nljpointer < 11) this.t2val = this.newlevjingle[this.nljpointer];
      this.t0val = this.t2val + 35;
      this.musvol = 50;
      this.setSoundMode();
      this.setT0();
      this.setT2Val(this.t2val);
      this.pushToEngine();
      if (this.nljnoteduration > 0) this.nljnoteduration--;
      else {
        this.nljnoteduration = 20;
        this.nljpointer++;
        if (this.nljpointer > 10) this.soundLevDoneOff();
      }
    } else {
      this.soundLevDoneFlag = false;
    }
  }

  soundPause(): void {
    this.soundPausedFlag = true;
    if (this.engine) {
      this.engine.updateT0Val(Sound.SILENCE_T0VAL);
      this.engine.updateT2Val(Sound.DEFAULT_T2VAL);
      this.engine.updateSpkrMode(0);
    }
  }

  soundPauseOff(): void {
    this.soundPausedFlag = false;
  }

  soundStop(): void {
    this.soundFallOff();
    this.soundWobbleOff();
    this.soundFireOff();
    this.musicOff();
    this.soundBonusOff();
    this.soundExplodeOff();
    this.soundBreakOff();
    this.soundEmOff();
    this.soundEmeraldOff();
    this.soundGoldOff();
    this.soundEatmOff();
    this.soundDdieOff();
    this.sound1UpOff();
  }

  soundWobble(): void {
    this.soundWobbleFlag = true;
  }

  soundWobbleOff(): void {
    this.soundWobbleFlag = false;
    this.soundwobblen = 0;
  }

  soundWobbleUpdate(): void {
    if (this.soundWobbleFlag) {
      this.soundwobblen++;
      if (this.soundwobblen > 63) this.soundwobblen = 0;
      switch (this.soundwobblen) {
        case 0:
          this.t2val = 0x7d0;
          break;
        case 16:
        case 48:
          this.t2val = 0x9c4;
          break;
        case 32:
          this.t2val = 0xbb8;
          break;
      }
    }
  }

  startInt8(): void {
    if (!this.int8Flag) this.int8Flag = true;
  }

  stopInt8(): void {
    if (this.int8Flag) this.int8Flag = false;
    this.setT2Val(Sound.DEFAULT_T2VAL);
  }
}
