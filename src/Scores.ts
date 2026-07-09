import type { Digger } from "./Digger.ts";

/**
 * Очки и таблица рекордов. Порт org.digger.app.Scores.
 * Хранение рекордов через localStorage (в оригинале — java.util.prefs).
 * Паузы (flashyWait) и ввод инициалов реализованы асинхронно через ожидание кадров.
 */
export class Scores {
  private static readonly MAX_SCORES = 11;
  private static readonly PLAYER_ONE = 0;
  private static readonly STORAGE_PREFIX = "digger.score.";

  private readonly dig: Digger;

  scoreHigh: number[] = new Array(12).fill(0); // [12], индекс 11 — 10-е место
  scoreinit: string[] = new Array(Scores.MAX_SCORES).fill("---");
  finalScore = 0;
  player1Score = 0;
  player2Score = 0;
  player1NextLifeScore = 0;
  player2NextLifeScore = 0;
  hsbuf = "";
  bonusScore = 20000;
  gotInitFlag = false;

  constructor(d: Digger) {
    this.dig = d;
  }

  addScore(score: number): void {
    if (this.dig.main.getCurrentPlayer() === Scores.PLAYER_ONE) {
      this.player1Score += score;
      if (this.player1Score > 999999) this.player1Score = 0;
      this.writenum(this.player1Score, 0, 0, 6, 1);
      if (this.player1Score >= this.player1NextLifeScore) {
        if (this.dig.main.getLives(1) < 5) {
          this.dig.main.addLife(1);
          this.dig.drawing.drawLives();
        }
        this.player1NextLifeScore += this.bonusScore;
      }
    } else {
      this.player2Score += score;
      if (this.player2Score > 999999) this.player2Score = 0;
      if (this.player2Score < 100000) this.writenum(this.player2Score, 236, 0, 6, 1);
      else this.writenum(this.player2Score, 248, 0, 6, 1);
      if (this.player2Score > this.player2NextLifeScore) {
        if (this.dig.main.getLives(2) < 5) {
          this.dig.main.addLife(2);
          this.dig.drawing.drawLives();
        }
        this.player2NextLifeScore += this.bonusScore;
      }
    }
    this.dig.main.incrementPenalty();
    this.dig.main.incrementPenalty();
    this.dig.main.incrementPenalty();
  }

  drawScores(): void {
    this.writenum(this.player1Score, 0, 0, 6, 3);
    if (this.dig.main.numPlayers === 2)
      if (this.player2Score < 100000) this.writenum(this.player2Score, 236, 0, 6, 3);
      else this.writenum(this.player2Score, 248, 0, 6, 3);
  }

  async endOfGame(): Promise<void> {
    this.addScore(0);
    if (this.dig.main.getCurrentPlayer() === Scores.PLAYER_ONE) this.finalScore = this.player1Score;
    else this.finalScore = this.player2Score;
    if (this.finalScore > this.scoreHigh[11]) {
      this.dig.display.clearScreen();
      this.drawScores();
      this.dig.main.playerDisplayBuffer = "PLAYER ";
      this.dig.main.playerDisplayBuffer += this.dig.main.getCurrentPlayer() === Scores.PLAYER_ONE ? "1" : "2";
      this.dig.drawing.drawText(this.dig.main.playerDisplayBuffer, 108, 0, 2);
      await this.getInitials();
      this.shuffleHigh();
      this.saveScores();
    } else {
      this.dig.main.clearTopLine();
      this.dig.drawing.drawText("GAME OVER", 104, 0, 3);
      this.dig.sound.killSound();
      for (let j = 0; j < 20; j++)
        for (let i = 0; i < 2; i++) {
          this.dig.display.setPalette(1 - (j & 1));
          await this.flashyWait(1);
          this.dig.display.setPalette(0);
          this.dig.display.setIntensity((1 - i) & 1);
          await this.dig.newFrame();
        }
      this.dig.sound.setupSound();
      this.dig.drawing.drawText("         ", 104, 0, 3);
    }
  }

  private flashyWait(n: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, n * 2));
  }

  /** Проверяет, что код клавиши — обычный печатный символ (не функциональная клавиша). */
  private isRegularKey(kp: number): boolean {
    return kp !== 0 && (kp & 0x80) === 0;
  }

  async getInitial(x: number, y: number): Promise<number> {
    this.dig.input.lastKeyCode = 0;
    this.dig.display.drawChar(x, y, "_".charCodeAt(0), 3);
    for (let j = 0; j < 5; j++) {
      for (let i = 0; i < 40; i++) {
        if (this.isRegularKey(this.dig.input.lastKeyCode)) return this.dig.input.lastKeyCode;
        await this.flashyWait(15);
      }
      for (let i = 0; i < 40; i++) {
        if (this.isRegularKey(this.dig.input.lastKeyCode)) {
          this.dig.display.drawChar(x, y, "_".charCodeAt(0), 3);
          return this.dig.input.lastKeyCode;
        }
        await this.flashyWait(15);
      }
    }
    this.gotInitFlag = true;
    return 0;
  }

  async getInitials(): Promise<void> {
    this.dig.drawing.drawText("ENTER YOUR", 100, 70, 3);
    this.dig.drawing.drawText(" INITIALS", 100, 90, 3);
    this.dig.drawing.drawText("_ _ _", 128, 130, 3);
    this.scoreinit[0] = "...";
    this.dig.sound.killSound();
    this.gotInitFlag = false;
    for (let i = 0; i < 3; i++) {
      let k = 0;
      while (k === 0 && !this.gotInitFlag) {
        k = await this.getInitial(i * 24 + 128, 130);
        if (i !== 0 && k === 8) i--;
        k = this.dig.input.getAsciiKey(this.dig.input.lastKeyCode);
      }
      if (k !== 0) {
        this.dig.display.drawChar(i * 24 + 128, 130, k, 3);
        const chars = this.scoreinit[0].split("");
        chars[i] = String.fromCharCode(k);
        this.scoreinit[0] = chars.join("");
      }
    }
    this.dig.input.lastKeyCode = 0;
    for (let i = 0; i < 20; i++) await this.flashyWait(15);
    this.dig.sound.setupSound();
    this.dig.display.clearScreen();
    this.dig.display.setPalette(0);
    this.dig.display.setIntensity(0);
    await this.dig.newFrame();
  }

  initScores(): void {
    this.addScore(0);
  }

  loadScores(): void {
    this.readScores();
  }

  private saveScores(): void {
    for (let i = 0; i < Scores.MAX_SCORES; i++) {
      localStorage.setItem(`${Scores.STORAGE_PREFIX}name_${i}`, this.scoreinit[i] ?? "Player");
      localStorage.setItem(`${Scores.STORAGE_PREFIX}score_${i}`, String(this.scoreHigh[i]));
    }
  }

  private readScores(): void {
    this.scoreinit.fill("---");
    this.scoreHigh.fill(0);
    for (let i = 0; i < Scores.MAX_SCORES; i++) {
      this.scoreinit[i] = localStorage.getItem(`${Scores.STORAGE_PREFIX}name_${i}`) ?? "---";
      this.scoreHigh[i] = Number(localStorage.getItem(`${Scores.STORAGE_PREFIX}score_${i}`) ?? 0);
    }
  }

  numberToString(n: number): string {
    let p = "";
    let x: number;
    for (x = 0; x < 6; x++) {
      p = String(n % 10) + p;
      n = Math.floor(n / 10);
      if (n === 0) {
        x++;
        break;
      }
    }
    for (; x < 6; x++) p = " " + p;
    return p;
  }

  /** Начисляет 1000 очков за съеденный бонус. */
  scoreBonus(): void {
    this.addScore(1000);
  }

  /** Очки за съеденного монстра в бонус-режиме; каждый следующий удваивает награду. */
  scoreEatMonster(): void {
    this.addScore(this.dig.monsterEatMultiplier * 200);
    this.dig.monsterEatMultiplier <<= 1;
  }

  /** Начисляет 25 очков за изумруд. */
  scoreEmerald(): void {
    this.addScore(25);
  }

  /** Начисляет 500 очков за мешок золота. */
  scoreGold(): void {
    this.addScore(500);
  }

  /** Начисляет 250 очков за убитого монстра. */
  scoreKillMonster(): void {
    this.addScore(250);
  }

  /** Начисляет 250 очков за 'O' (октавный бонус). */
  scoreOctave(): void {
    this.addScore(250);
  }

  showTable(): void {
    this.dig.drawing.drawText("HIGH SCORES", 16, 25, 3);
    let col = 2;
    for (let i = 1; i < 11; i++) {
      this.hsbuf = this.scoreinit[i] + "  " + this.numberToString(this.scoreHigh[i + 1]);
      this.dig.drawing.drawText(this.hsbuf, 16, 31 + 13 * i, col);
      col = 1;
    }
  }

  shuffleHigh(): void {
    let j: number;
    for (j = 10; j > 1; j--) if (this.finalScore < this.scoreHigh[j]) break;
    for (let i = 10; i > j; i--) {
      this.scoreHigh[i + 1] = this.scoreHigh[i];
      this.scoreinit[i] = this.scoreinit[i - 1];
    }
    this.scoreHigh[j + 1] = this.finalScore;
    this.scoreinit[j] = this.scoreinit[0];
  }

  writeCurrentScore(bp6: number): void {
    if (this.dig.main.getCurrentPlayer() === Scores.PLAYER_ONE) this.writenum(this.player1Score, 0, 0, 6, bp6);
    else if (this.player2Score < 100000) this.writenum(this.player2Score, 236, 0, 6, bp6);
    else this.writenum(this.player2Score, 248, 0, 6, bp6);
  }

  writenum(n: number, x: number, y: number, w: number, c: number): void {
    let xp = (w - 1) * 12 + x;
    while (w > 0) {
      const d = n % 10;
      if (w > 1 || d > 0) this.dig.display.drawChar(xp, y, d + "0".charCodeAt(0), c);
      n = Math.floor(n / 10);
      w--;
      xp -= 12;
    }
  }

  zeroScores(): void {
    this.player2Score = 0;
    this.player1Score = 0;
    this.finalScore = 0;
    this.player1NextLifeScore = this.bonusScore;
    this.player2NextLifeScore = this.bonusScore;
  }
}
