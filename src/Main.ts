import type { Digger } from "./Digger.ts";
import { GameState } from "./GameState.ts";

/**
 * Контроллер игрового цикла: титульный экран, переходы уровней, смена игроков.
 * Порт org.digger.app.Main. Блокирующие циклы оригинала переведены на async/await
 * поверх dig.newFrame().
 */
export class Main {
  private readonly dig: Digger;

  /** Порядок приоритета отрисовки спрайтов (больший индекс рисуется первым). */
  digSprOrder = [14, 13, 7, 6, 5, 4, 3, 2, 1, 12, 11, 10, 9, 8, 15, 0];

  gameData: GameState[] = [new GameState(), new GameState()];

  playerDisplayBuffer = "";

  currentPlayer = 0;
  numPlayers = 0;
  penalty = 0;
  levelNotDrawn = false;
  flashPlayer = false;

  speedMul = 40;
  randSeed = 0;

  /** Раскладки уровней: 8 планов × 10 строк × 15 столбцов. */
  readonly levelData: string[][] = [
    ["S   B     HHHHS", "V  CC  C  V B  ", "VB CC  C  V    ", "V  CCB CB V CCC", "V  CC  C  V CCC", "HH CC  C  V CCC", " V    B B V    ", " HHHH     V    ", "C   V     V   C", "CC  HHHHHHH  CC"],
    ["SHHHHH  B B  HS", " CC  V       V ", " CC  V CCCCC V ", "BCCB V CCCCC V ", "CCCC V       V ", "CCCC V B  HHHH ", " CC  V CC V    ", " BB  VCCCCV CC ", "C    V CC V CC ", "CC   HHHHHH    "],
    ["SHHHHB B BHHHHS", "CC  V C C V BB ", "C   V C C V CC ", " BB V C C VCCCC", "CCCCV C C VCCCC", "CCCCHHHHHHH CC ", " CC  C V C  CC ", " CC  C V C     ", "C    C V C    C", "CC   C H C   CC"],
    ["SHBCCCCBCCCCBHS", "CV  CCCCCCC  VC", "CHHH CCCCC HHHC", "C  V  CCC  V  C", "   HHH C HHH   ", "  B  V B V  B  ", "  C  VCCCV  C  ", " CCC HHHHH CCC ", "CCCCC CVC CCCCC", "CCCCC CHC CCCCC"],
    ["SHHHHHHHHHHHHHS", "VBCCCCBVCCCCCCV", "VCCCCCCV CCBC V", "V CCCC VCCBCCCV", "VCCCCCCV CCCC V", "V CCCC VBCCCCCV", "VCCBCCCV CCCC V", "V CCBC VCCCCCCV", "VCCCCCCVCCCCCCV", "HHHHHHHHHHHHHHH"],
    ["SHHHHHHHHHHHHHS", "VCBCCV V VCCBCV", "VCCC VBVBV CCCV", "VCCCHH V HHCCCV", "VCC V CVC V CCV", "VCCHH CVC HHCCV", "VC V CCVCC V CV", "VCHHBCCVCCBHHCV", "VCVCCCCVCCCCVCV", "HHHHHHHHHHHHHHH"],
    ["SHCCCCCVCCCCCHS", " VCBCBCVCBCBCV ", "BVCCCCCVCCCCCVB", "CHHCCCCVCCCCHHC", "CCV CCCVCCC VCC", "CCHHHCCVCCHHHCC", "CCCCV CVC VCCCC", "CCCCHH V HHCCCC", "CCCCCV V VCCCCC", "CCCCCHHHHHCCCCC"],
    ["HHHHHHHHHHHHHHS", "V CCBCCCCCBCC V", "HHHCCCCBCCCCHHH", "VBV CCCCCCC VBV", "VCHHHCCCCCHHHCV", "VCCBV CCC VBCCV", "VCCCHHHCHHHCCCV", "VCCCC V V CCCCV", "VCCCCCV VCCCCCV", "HHHHHHHHHHHHHHH"],
  ];

  constructor(d: Digger) {
    this.dig = d;
  }

  addLife(pl: number): void {
    this.gameData[pl - 1].lives++;
    this.dig.sound.sound1Up();
  }

  calibrate(): void {
    this.dig.sound.volume = 1;
  }

  /** Проверяет, пройден ли уровень (собраны все изумруды или не осталось монстров). */
  checkLevelDone(): void {
    if ((this.dig.countEmeralds() === 0 || this.dig.monster.getMonstersLeft() === 0) && this.dig.digOnScreen)
      this.gameData[this.currentPlayer].levelDone = true;
    else this.gameData[this.currentPlayer].levelDone = false;
  }

  clearTopLine(): void {
    this.dig.drawing.drawText("                          ", 0, 0, 3);
    this.dig.drawing.drawText(" ", 308, 0, 3);
  }

  drawScreen(): void {
    this.dig.drawing.createAllSprites();
    this.dig.drawing.drawFieldAndBackground();
    this.dig.bags.drawBags();
    this.dig.drawEmeralds();
    this.dig.initDigger();
    this.dig.monster.initMonsters();
  }

  getCurrentPlayer(): number {
    return this.currentPlayer;
  }

  getLevelChar(x: number, y: number, l: number): number {
    if (l === 0) l++;
    return this.levelData[l - 1][y].charCodeAt(x);
  }

  getLives(pl: number): number {
    return this.gameData[pl - 1].lives;
  }

  incrementPenalty(): void {
    this.penalty++;
  }

  initChars(): void {
    this.dig.drawing.initAllSprites();
    this.dig.initDigger();
    this.dig.monster.initMonsters();
  }

  initLevel(): void {
    this.gameData[this.currentPlayer].levelDone = false;
    this.dig.drawing.buildField();
    this.dig.makeEmeraldField();
    this.dig.bags.initBags();
    this.levelNotDrawn = true;
  }

  getLevelNumber(): number {
    return this.gameData[this.currentPlayer].level;
  }

  getLevelNumberClampedToTen(): number {
    if (this.gameData[this.currentPlayer].level > 10) return 10;
    return this.gameData[this.currentPlayer].level;
  }

  getLevelPlan(): number {
    let l = this.getLevelNumber();
    if (l > 8) l = (l & 3) + 5; // Планы уровней: 12345678, 678, (5678)×247, далее 5
    return l;
  }

  /** Точка входа: титульный экран → игровой цикл → возврат к титулу. */
  async main(): Promise<void> {
    let frame: number;
    let x = 0;

    this.dig.time = this.dig.display.getCurrentTimeMillis();
    this.calibrate();
    this.dig.ftime = this.speedMul * 2000;
    this.dig.display.init();
    this.dig.display.setPalette(0);
    this.dig.input.initKeyboard();
    this.dig.input.detectJoystick();
    this.dig.scores.loadScores();
    this.dig.sound.initSound();

    this.numPlayers = 1;
    do {
      this.dig.sound.soundStop();
      this.dig.sprite.setSpriteOrder(this.digSprOrder);
      this.dig.drawing.createAllSprites();
      this.dig.input.detectJoystick();
      this.dig.display.clearScreen();
      this.dig.display.drawTitleScreen();
      this.dig.drawing.drawText("D I G G E R", 100, 0, 3);
      this.showPlayers();
      this.dig.scores.showTable();
      let start = false;
      frame = 0;

      this.dig.time = this.dig.display.getCurrentTimeMillis();

      while (!start) {
        start = this.dig.input.testStart();
        if (this.dig.input.lastKeyCode !== 0) {
          if (this.dig.input.lastKeyCode === 27) {
            this.switchPlayerCount();
            this.showPlayers();
          }
          this.dig.input.lastAsciiKeyCode = 0;
          this.dig.input.lastKeyCode = 0;
        }
        if (frame === 0) for (let t = 54; t < 174; t += 12) this.dig.drawing.drawText("            ", 164, t, 0);
        if (frame === 50) {
          this.dig.sprite.moveDrawSprite(8, 292, 63);
          x = 292;
        }
        if (frame > 50 && frame <= 77) {
          x -= 4;
          this.dig.drawing.drawMonster(0, true, 4, x, 63);
        }
        if (frame > 77) this.dig.drawing.drawMonster(0, true, 0, 184, 63);
        if (frame === 83) this.dig.drawing.drawText("NOBBIN", 216, 64, 2);
        if (frame === 90) {
          this.dig.sprite.moveDrawSprite(9, 292, 82);
          this.dig.drawing.drawMonster(1, false, 4, 292, 82);
          x = 292;
        }
        if (frame > 90 && frame <= 117) {
          x -= 4;
          this.dig.drawing.drawMonster(1, false, 4, x, 82);
        }
        if (frame > 117) this.dig.drawing.drawMonster(1, false, 0, 184, 82);
        if (frame === 123) this.dig.drawing.drawText("HOBBIN", 216, 83, 2);
        if (frame === 130) {
          this.dig.sprite.moveDrawSprite(0, 292, 101);
          this.dig.drawing.drawDigger(4, 292, 101, true);
          x = 292;
        }
        if (frame > 130 && frame <= 157) {
          x -= 4;
          this.dig.drawing.drawDigger(4, x, 101, true);
        }
        if (frame > 157) this.dig.drawing.drawDigger(0, 184, 101, true);
        if (frame === 163) this.dig.drawing.drawText("DIGGER", 216, 102, 2);
        if (frame === 178) {
          this.dig.sprite.moveDrawSprite(1, 184, 120);
          this.dig.drawing.drawGold(1, 0, 184, 120);
        }
        if (frame === 183) this.dig.drawing.drawText("GOLD", 216, 121, 2);
        if (frame === 198) this.dig.drawing.drawEmerald(184, 141);
        if (frame === 203) this.dig.drawing.drawText("EMERALD", 216, 140, 2);
        if (frame === 218) this.dig.drawing.drawBonus(184, 158);
        if (frame === 223) this.dig.drawing.drawText("BONUS", 216, 159, 2);
        await this.dig.newFrame();
        frame++;
        if (frame > 250) frame = 0;
        if (!this.dig.running && frame > 1) return;
      }
      this.dig.input.lastAsciiKeyCode = 0;
      this.dig.input.lastKeyCode = 0;

      this.gameData[0].level = 1;
      this.gameData[0].lives = 3;
      if (this.numPlayers === 2) {
        this.gameData[1].level = 1;
        this.gameData[1].lives = 3;
      } else this.gameData[1].lives = 0;
      this.dig.display.clearScreen();
      this.currentPlayer = 0;
      this.initLevel();
      this.currentPlayer = 1;
      this.initLevel();
      this.dig.scores.zeroScores();
      this.dig.bonusVisible = true;
      if (this.numPlayers === 2) this.flashPlayer = true;
      this.currentPlayer = 0;
      while ((this.gameData[0].lives !== 0 || this.gameData[1].lives !== 0) && !this.dig.input.escape) {
        this.gameData[this.currentPlayer].dead = false;
        while (!this.gameData[this.currentPlayer].dead && this.gameData[this.currentPlayer].lives !== 0 && !this.dig.input.escape) {
          this.dig.drawing.initAllSprites();
          await this.play();
        }
        if (this.gameData[1 - this.currentPlayer].lives !== 0) {
          this.currentPlayer = 1 - this.currentPlayer;
          this.flashPlayer = this.levelNotDrawn = true;
        }
      }
      this.dig.input.escape = false;
    } while (this.dig.running);
  }

  /** Игровой цикл одного уровня. */
  async play(): Promise<void> {
    let t: number;
    if (this.levelNotDrawn) {
      this.levelNotDrawn = false;
      this.drawScreen();
      this.dig.time = this.dig.display.getCurrentTimeMillis();
      if (this.flashPlayer) {
        this.flashPlayer = false;
        this.playerDisplayBuffer = "PLAYER ";
        this.playerDisplayBuffer += this.currentPlayer === 0 ? "1" : "2";
        this.clearTopLine();
        for (t = 0; t < 15; t++)
          for (let c = 1; c <= 3; c++) {
            this.dig.drawing.drawText(this.playerDisplayBuffer, 108, 0, c);
            this.dig.scores.writeCurrentScore(c);
            await this.dig.newFrame();
            if (this.dig.input.escape) return;
          }
        this.dig.scores.drawScores();
        this.dig.scores.addScore(0);
      }
    } else this.initChars();
    this.dig.input.lastKeyCode = 0;
    this.dig.drawing.drawText("        ", 108, 0, 3);
    this.dig.scores.initScores();
    this.dig.drawing.drawLives();
    this.dig.sound.music(1);
    this.dig.input.readDirection();
    this.dig.time = this.dig.display.getCurrentTimeMillis();
    while (!this.gameData[this.currentPlayer].dead && !this.gameData[this.currentPlayer].levelDone && !this.dig.input.escape) {
      this.penalty = 0;
      await this.dig.doDigger();
      this.dig.monster.doMonsters();
      this.dig.bags.doBags();
      if (this.penalty > 8) this.dig.monster.increaseMonsterDelay(this.penalty - 8);
      await this.testPause();
      this.checkLevelDone();
    }
    this.dig.eraseDigger();
    this.dig.sound.musicOff();
    t = 20;
    while ((this.dig.bags.getMovingBagsCount() !== 0 || t !== 0) && !this.dig.input.escape) {
      if (t !== 0) t--;
      this.penalty = 0;
      this.dig.bags.doBags();
      await this.dig.doDigger();
      this.dig.monster.doMonsters();
      if (this.penalty < 8) t = 0;
    }
    this.dig.sound.soundStop();
    this.dig.killFire();
    this.dig.eraseBonus();
    this.dig.bags.cleanupBags();
    this.dig.drawing.saveFieldSnapshot();
    this.dig.monster.eraseMonsters();
    await this.dig.newFrame();
    if (this.gameData[this.currentPlayer].levelDone) await this.dig.sound.soundLevDone();
    if (this.dig.countEmeralds() === 0) {
      this.gameData[this.currentPlayer].level++;
      if (this.gameData[this.currentPlayer].level > 1000) this.gameData[this.currentPlayer].level = 1000;
      this.initLevel();
    }
    if (this.gameData[this.currentPlayer].dead) {
      this.gameData[this.currentPlayer].lives--;
      this.dig.drawing.drawLives();
      if (this.gameData[this.currentPlayer].lives === 0 && !this.dig.input.escape) await this.dig.scores.endOfGame();
    }
    if (this.gameData[this.currentPlayer].levelDone) {
      this.gameData[this.currentPlayer].level++;
      if (this.gameData[this.currentPlayer].level > 1000) this.gameData[this.currentPlayer].level = 1000;
      this.initLevel();
    }
  }

  randomNumber(n: number): number {
    this.randSeed = (Math.imul(this.randSeed, 0x15a4e35) + 1) | 0;
    return (this.randSeed & 0x7fffffff) % n;
  }

  setDead(bp6: boolean): void {
    this.gameData[this.currentPlayer].dead = bp6;
  }

  showPlayers(): void {
    if (this.numPlayers === 1) {
      this.dig.drawing.drawText("ONE", 220, 25, 3);
      this.dig.drawing.drawText(" PLAYER ", 192, 39, 3);
    } else {
      this.dig.drawing.drawText("TWO", 220, 25, 3);
      this.dig.drawing.drawText(" PLAYERS", 184, 39, 3);
    }
  }

  switchPlayerCount(): void {
    this.numPlayers = 3 - this.numPlayers;
  }

  async testPause(): Promise<void> {
    if (this.dig.input.lastAsciiKeyCode === 32) {
      this.dig.input.lastAsciiKeyCode = 0;
      this.dig.sound.soundPause();
      this.dig.sound.setT2Val(40);
      this.dig.sound.setSoundT2();
      this.clearTopLine();
      this.dig.drawing.drawText("PAUSED", 124, 0, 1);
      await this.dig.newFrame();
      this.dig.input.lastKeyCode = 0;
      while (this.dig.input.lastKeyCode === 0 && this.dig.running && !this.dig.input.escape) {
        await this.dig.newFrame();
      }
      this.clearTopLine();
      this.dig.scores.drawScores();
      this.dig.scores.addScore(0);
      this.dig.drawing.drawLives();
      await this.dig.newFrame();
      this.dig.time = this.dig.display.getCurrentTimeMillis() - this.dig.frametime;
      this.dig.input.lastKeyCode = 0;
    } else this.dig.sound.soundPauseOff();
  }
}
