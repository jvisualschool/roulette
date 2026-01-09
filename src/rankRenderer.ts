import { RenderParameters } from './rouletteRenderer';
import { MouseEventArgs, UIObject } from './UIObject';
import { bound } from './utils/bound.decorator';
import { Rect } from './types/rect.type';
import { Marble } from './marble';

export class RankRenderer implements UIObject {
  private _currentY = 0;
  private _targetY = 0;
  private fontHeight = 28; // 행 높이 대폭 확대
  private _userMoved = 0;
  private _currentWinner = -1;
  private maxY = 0;
  private winners: Marble[] = [];
  private marbles: Marble[] = [];
  private winnerRank: number = -1;
  private messageHandler?: (msg: string) => void;

  constructor() {
  }

  @bound
  onWheel(e: WheelEvent) {
    this._targetY += e.deltaY;
    if (this._targetY > this.maxY) {
      this._targetY = this.maxY;
    }
    this._userMoved = 2000;
  }

  @bound
  onDblClick(e?: MouseEventArgs) {
    if (e) {
      if (navigator.clipboard) {
        const tsv: string[] = [];
        let rank = 0;
        tsv.push(...[...this.winners, ...this.marbles].map((m) => {
          rank++;
          return [rank.toString(), m.name, rank - 1 === this.winnerRank ? '☆' : ''].join('\t');
        }));

        tsv.unshift(['Rank', 'Name', 'Winner'].join('\t'));

        navigator.clipboard.writeText(tsv.join('\n')).then(() => {
          if (this.messageHandler) {
            this.messageHandler('The result has been copied');
          }
        });
      }
    }
  }

  onMessage(func: (msg: string) => void) {
    this.messageHandler = func;
  }

  render(
    ctx: CanvasRenderingContext2D,
    { winners, marbles, winnerRank, theme }: RenderParameters,
    width: number,
    height: number,
  ) {
    const startY = Math.max(-this.fontHeight, this._currentY - height / 2);
    this.maxY = Math.max(
      0,
      (marbles.length + winners.length) * this.fontHeight + this.fontHeight,
    );
    this._currentWinner = winners.length;

    this.winners = winners;
    this.marbles = marbles;
    this.winnerRank = winnerRank;

    ctx.save();

    // 1. FPS 표시 (맨 위로 더 밀착)
    const fpsValue = (arguments[1] as RenderParameters).fps;
    ctx.textAlign = 'left';
    ctx.font = '900 10pt sans-serif';
    ctx.shadowBlur = 0;
    const fpsColor = fpsValue >= 110 ? '#00ffc8' : (fpsValue >= 55 ? '#ffffff' : '#ff4b4b');
    ctx.fillStyle = fpsColor;
    ctx.fillText(`${fpsValue} FPS`, 15, 15);

    // 2. 상단 카운터 (여백 축소)
    ctx.font = 'bold 14pt sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.fillText(`LIVE RANKING: ${winners.length} / ${winners.length + marbles.length}`, 15, 35);

    // 3. 순위 리스트 클리핑 (여백 50% 추가 축소)
    ctx.beginPath();
    ctx.rect(0, 43, 300, height);
    ctx.clip();

    ctx.translate(0, -startY + 48);

    const drawRow = (marble: { hue: number, name: string }, rank: number, isWinner: boolean) => {
      const y = rank * this.fontHeight;
      if (y < startY - this.fontHeight || y > startY + height) return;

      const rowX = 15;
      const rowY = y;
      const rowW = 220;
      const rowH = this.fontHeight - 6;
      const cornerRadius = 3;

      // 1. 전체 행 배경 (더 어둡게)
      ctx.beginPath();
      ctx.roundRect(rowX, rowY, rowW, rowH, cornerRadius);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fill();

      // 2. 좌측 컬러 바 (구슬 고유 색상)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(rowX, rowY, 6, rowH, [cornerRadius, 0, 0, cornerRadius]);
      ctx.clip();
      ctx.fillStyle = `hsl(${marble.hue} 100% 60%)`;
      ctx.fillRect(rowX, rowY, 6, rowH);
      ctx.restore();

      // 3. 순위 숫자가 들어갈 박스 (회색)
      const rankBoxW = 35;
      ctx.fillStyle = isWinner ? 'rgba(255, 215, 0, 0.9)' : 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(rowX + 6, rowY, rankBoxW, rowH);

      // 4. 숫자 텍스트 (정중앙 정렬)
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.font = 'bold 14pt sans-serif';
      ctx.fillStyle = isWinner ? '#000' : '#ffffff';
      ctx.fillText((rank + 1).toString(), rowX + 6 + rankBoxW / 2, rowY + rowH / 2);

      // 5. 이름 텍스트
      ctx.textAlign = 'left';
      ctx.font = '600 14pt sans-serif';
      ctx.fillStyle = '#ffffff';
      let nameText = marble.name;
      if (rank === winnerRank) nameText += ' ⭐';
      ctx.fillText(nameText, rowX + rankBoxW + 15, rowY + rowH / 2);
    };

    winners.forEach((marble, rank) => drawRow(marble, rank, true));
    marbles.forEach((marble, rank) => drawRow(marble, rank + winners.length, false));

    ctx.restore();
  }

  update(deltaTime: number) {
    if (this._currentWinner === -1) {
      return;
    }
    if (this._userMoved > 0) {
      this._userMoved -= deltaTime;
    } else {
      this._targetY = Math.max(0, (this._currentWinner - 5) * this.fontHeight); // 적절한 스크롤 위치 제어
    }
    if (this._currentY !== this._targetY) {
      this._currentY += (this._targetY - this._currentY) * (deltaTime / 250);
    }
    if (Math.abs(this._currentY - this._targetY) < 1) {
      this._currentY = this._targetY;
    }
  }

  getBoundingBox(): Rect | null {
    return null;
  }
}
