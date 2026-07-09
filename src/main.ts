import type { Digger } from "./Digger.ts";

/**
 * Контроллер игрового цикла: титульный экран, переходы уровней, смена игроков.
 *
 * Порт org.digger.app.Main. ВНИМАНИЕ: пока портирована только часть, нужная
 * для отрисовки статичного уровня (данные уровней и геттеры). Полная логика
 * (титул, переходы, штрафы, жизни) будет добавлена на этапе игрового цикла.
 */
export class Main {
  numPlayers = 0;
  currentPlayer = 0;
  penalty = 0;

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

  constructor(_d: Digger) {}

  getCurrentPlayer(): number {
    return this.currentPlayer;
  }

  /** Возвращает ASCII-код символа раскладки уровня в ячейке (x, y) плана l. */
  getLevelChar(x: number, y: number, l: number): number {
    if (l === 0) l++;
    return this.levelData[l - 1][y].charCodeAt(x);
  }

  /** Возвращает номер плана уровня (1-8). Пока зафиксирован на 1 до этапа игрового цикла. */
  getLevelPlan(): number {
    return 1;
  }

  /** Возвращает число жизней игрока. Пока заглушка до этапа игрового цикла. */
  getLives(_pl: number): number {
    return 3;
  }

  incrementPenalty(): void {
    this.penalty++;
  }
}
