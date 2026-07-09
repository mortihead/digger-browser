/** Изменяемое состояние одной игры (на игрока). Порт org.digger.app.GameState. */
export class GameState {
  lives = 0; // оставшиеся жизни
  level = 0; // текущий номер уровня (с 1)
  dead = false; // игрок погиб в этом раунде
  levelDone = false; // текущий уровень пройден
}
