/** Изменяемое состояние одного мешка золота на поле. Порт org.digger.app.BagState. */
export class BagState {
  x = 0;
  y = 0; // пиксельная позиция
  h = 0;
  v = 0; // позиция в ячейках
  xr = 0;
  yr = 0; // субпиксельный остаток внутри ячейки
  direction = 0; // направление движения (0=вправо, 4=влево и т.д.)
  wobbleTime = 0; // кадров до окончания качания
  goldTime = 0; // счётчик времени подбора золота
  fallHeight = 0; // на сколько ячеек мешок упал
  wobbling = false; // мешок качается перед падением
  unfallen = false; // мешок ещё не падал (лежит на грунте)
  exist = false; // мешок активен на поле

  copyFrom(other: BagState): void {
    this.x = other.x;
    this.y = other.y;
    this.h = other.h;
    this.v = other.v;
    this.xr = other.xr;
    this.yr = other.yr;
    this.direction = other.direction;
    this.wobbleTime = other.wobbleTime;
    this.goldTime = other.goldTime;
    this.fallHeight = other.fallHeight;
    this.wobbling = other.wobbling;
    this.unfallen = other.unfallen;
    this.exist = other.exist;
  }
}
