import { canvasHeight, canvasWidth, initialZoom, Themes } from './data/constants';
import { Camera } from './camera';
import { StageDef } from './data/maps';
import { Marble } from './marble';
import { ParticleManager } from './particleManager';
import { GameObject } from './gameObject';
import { UIObject } from './UIObject';
import { VectorLike } from './types/VectorLike';
import { MapEntityState } from './types/MapEntity.type';
import { ColorTheme } from './types/ColorTheme';

export type RenderParameters = {
  camera: Camera;
  stage: StageDef;
  entities: MapEntityState[];
  marbles: Marble[];
  winners: Marble[];
  particleManager: ParticleManager;
  effects: GameObject[];
  winnerRank: number;
  winner: Marble | null;
  size: VectorLike;
  theme: ColorTheme;
  countdown: number | null;
  showStartLine: boolean;
  fps: number;
};

export class RouletteRenderer {
  private _canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  public sizeFactor = 1;

  private _images: { [key: string]: HTMLImageElement } = {};
  private _theme: ColorTheme = Themes.dark;

  constructor() {
  }

  get width() {
    return this._canvas.width;
  }

  get height() {
    return this._canvas.height;
  }

  get canvas() {
    return this._canvas;
  }

  set theme(value: ColorTheme) {
    this._theme = value;
  }

  async init() {
    await this._load();

    this._canvas = document.createElement('canvas');
    this._canvas.width = canvasWidth;
    this._canvas.height = canvasHeight;
    this.ctx = this._canvas.getContext('2d', {
      alpha: false,
      desynchronized: true, // 성능 향상
    }) as CanvasRenderingContext2D;

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    document.body.appendChild(this._canvas);

    const resizing = (entries?: ResizeObserverEntry[]) => {
      const realSize = entries
        ? entries[0].contentRect
        : this._canvas.getBoundingClientRect();

      const dpr = window.devicePixelRatio || 1;
      const width = realSize.width;
      const height = realSize.height;

      this._canvas.width = width * dpr;
      this._canvas.height = height * dpr;
      this._canvas.style.width = `${width}px`;
      this._canvas.style.height = `${height}px`;

      this.ctx.scale(dpr, dpr);
      this.sizeFactor = 1;
    };

    const resizeObserver = new ResizeObserver(resizing);

    resizeObserver.observe(this._canvas);
    resizing();
  }

  private async _loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((rs) => {
      const img = new Image();
      img.addEventListener('load', () => {
        rs(img);
      });
      img.src = url;
    });
  }

  private async _load(): Promise<void> {
    const loadPromises =
      [
        { name: '챔루', imgUrl: new URL('../assets/images/chamru.png', import.meta.url) },
        { name: '쿠빈', imgUrl: new URL('../assets/images/kubin.png', import.meta.url) },
        { name: '꽉변', imgUrl: new URL('../assets/images/kkwak.png', import.meta.url) },
        { name: '꽉변호사', imgUrl: new URL('../assets/images/kkwak.png', import.meta.url) },
        { name: '꽉 변호사', imgUrl: new URL('../assets/images/kkwak.png', import.meta.url) },
        { name: '주누피', imgUrl: new URL('../assets/images/junyoop.png', import.meta.url) },
        { name: '왈도쿤', imgUrl: new URL('../assets/images/waldokun.png', import.meta.url) },
      ].map(({ name, imgUrl }) => {
        return (async () => {
          this._images[name] = await this._loadImage(imgUrl.toString());
        })();
      });

    loadPromises.push((async () => {
      await this._loadImage(new URL('../assets/images/ff.svg', import.meta.url).toString());
    })());

    await Promise.all(loadPromises);
  }

  render(renderParameters: RenderParameters, uiObjects: UIObject[]) {
    this._theme = renderParameters.theme;

    const dpr = window.devicePixelRatio || 1;
    // 트랜스폼 초기화 후 전체 지우기
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.fillStyle = this._theme.background;
    this.ctx.fillRect(0, 0, this._canvas.width / dpr, this._canvas.height / dpr);

    this.ctx.save();
    this.ctx.scale(initialZoom, initialZoom);
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.font = '0.4pt sans-serif';
    this.ctx.lineWidth = 4.5 / (renderParameters.camera.zoom + initialZoom);

    renderParameters.camera.renderScene(this.ctx, () => {
      this.renderDots(renderParameters); // 격자 대신 도트 패턴 그리기
      this.renderFinishLine(renderParameters);
      if (renderParameters.showStartLine) {
        this.renderStartLine(renderParameters);
      }
      this.renderEntities(renderParameters.entities, renderParameters.camera);
      this.renderEffects(renderParameters);
      this.renderMarbles(renderParameters);
    });
    this.ctx.restore();

    uiObjects.forEach((obj) =>
      obj.render(
        this.ctx,
        renderParameters,
        this._canvas.width / dpr,
        this._canvas.height / dpr,
      ),
    );
    renderParameters.particleManager.render(this.ctx);

    // 카운트다운은 UI 레이어 (화면 중앙)
    if (renderParameters.countdown !== null) {
      this.renderCountdown(renderParameters.countdown);
    }

    this.renderWinner(renderParameters);
  }

  private renderDots(params: RenderParameters) {
    const { camera, size } = params;
    const dpr = window.devicePixelRatio || 1;
    const canvasW = size.x / dpr;
    const canvasH = size.y / dpr;

    const zoom = camera.zoom;
    const zoomFactor = initialZoom * 2 * zoom;

    const halfW = (canvasW / 2) / zoomFactor;
    const halfH = (canvasH / 2) / zoomFactor;

    const minX = camera.x - halfW;
    const maxX = camera.x + halfW;
    const minY = camera.y - halfH;
    const maxY = camera.y + halfH;

    const spacing = 1.75; // 30% 더 좁게 (2.5 -> 1.75)
    const startX = Math.floor(minX / spacing) * spacing;
    const endX = Math.ceil(maxX / spacing) * spacing;
    const startY = Math.floor(minY / spacing) * spacing;
    const endY = Math.ceil(maxY / spacing) * spacing;

    this.ctx.save();
    // 50% 더 밝게 조정 (0.06 -> 0.09)
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';

    // 도트 그리기
    const dotSize = 0.08;
    for (let x = startX; x <= endX; x += spacing) {
      for (let y = startY; y <= endY; y += spacing) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.ctx.restore();
  }

  private renderStartLine(params: RenderParameters) {
    const y = 2.5; // 구슬들 아래쪽 (출발 방향)

    // 코스 중앙 및 우측 계산
    let minX = 0;
    let maxX = 26;
    if (params.stage.entities) {
      const xs: number[] = [];
      params.stage.entities.forEach(e => {
        if (e.shape.type === 'polyline') {
          e.shape.points.forEach(p => {
            if (Math.abs(p[1] - y) < 10) xs.push(p[0]);
          });
        }
      });
      if (xs.length >= 2) {
        minX = Math.min(...xs);
        maxX = Math.max(...xs);
      }
    }
    const centerX = (minX + maxX) / 2;

    this.ctx.save();

    // 깃발 흔들기 효과 (도로 우측 배치)
    if (params.countdown !== null) {
      this.renderWavingFlag(maxX + 0.5, y, params.countdown);
    }

    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 0.3;
    this.ctx.beginPath();
    this.ctx.moveTo(minX, y);
    this.ctx.lineTo(maxX, y);
    this.ctx.stroke();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 1.6pt sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('START', centerX, y + 0.9);
    this.ctx.restore();
  }

  private renderWavingFlag(x: number, y: number, countdown: number) {
    const time = Date.now() / 200;
    const flagW = 3; // 크기 50% 축소 (6 -> 3)
    const flagH = 2; // 크기 50% 축소 (4 -> 2)
    const segments = 10;

    this.ctx.save();
    this.ctx.translate(x, y);

    // 깃대
    this.ctx.fillStyle = '#888';
    this.ctx.fillRect(-0.1, -flagH - 0.5, 0.2, flagH + 0.5);

    // 깃발 면 (물결 효과)
    this.ctx.translate(0, -flagH - 0.5);
    for (let i = 0; i < segments; i++) {
      const segX = (i / segments) * flagW;
      const nextSegX = ((i + 1) / segments) * flagW;
      const wave = Math.sin(time + i * 0.5) * 0.25;
      const nextWave = Math.sin(time + (i + 1) * 0.5) * 0.25;

      const rows = 4;

      // 각 세그먼트에서 체크무늬 그리기
      for (let j = 0; j < rows; j++) {
        const segY = (j / rows) * flagH + wave;
        const nextSegY = (j / rows) * flagH + nextWave;
        const h = flagH / rows;

        this.ctx.fillStyle = (i + j) % 2 === 0 ? '#fff' : '#000';
        this.ctx.beginPath();
        this.ctx.moveTo(segX, segY);
        this.ctx.lineTo(nextSegX, nextSegY);
        this.ctx.lineTo(nextSegX, nextSegY + h);
        this.ctx.lineTo(segX, segY + h);
        this.ctx.closePath();
        this.ctx.fill();
      }
    }
    this.ctx.restore();
  }

  private renderFinishLine(params: RenderParameters) {
    const y = params.stage.goalY;
    const height = 2;
    const cellSize = 0.5; // 더 세밀한 체크무늬

    // 코스 중앙 및 너비 계산
    let minX = 0;
    let maxX = 26;
    if (params.stage.entities) {
      const xs: number[] = [];
      params.stage.entities.forEach(e => {
        if (e.shape.type === 'polyline') {
          e.shape.points.forEach(p => {
            if (Math.abs(p[1] - y) < 5) xs.push(p[0]); // 골인 지점 근처의 점들 추출
          });
        }
      });
      if (xs.length >= 2) {
        minX = Math.min(...xs);
        maxX = Math.max(...xs);
      }
    }
    const width = (maxX - minX);
    const centerX = minX + width / 2;
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);

    this.ctx.save();
    this.ctx.translate(minX, y);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#000000';
        this.ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }
    this.ctx.restore();

    this.ctx.save();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 3pt sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.shadowBlur = 5;
    this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
    this.ctx.fillText('FINISH', centerX, y + height + 0.5);
    this.ctx.restore();
  }

  private renderCountdown(count: number) {
    const dpr = window.devicePixelRatio || 1;
    const centerX = (this._canvas.width / dpr) / 2;
    const centerY = (this._canvas.height / dpr) / 2;

    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // 외곽 광채
    this.ctx.shadowBlur = 50;
    this.ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';

    this.ctx.font = 'bold 150px sans-serif';
    this.ctx.fillStyle = '#ffffff';

    // 그라데이션 추가
    const grad = this.ctx.createLinearGradient(centerX, centerY - 100, centerX, centerY + 100);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#cccccc');
    this.ctx.fillStyle = grad;

    this.ctx.fillText(count.toString(), centerX, centerY);

    // 테두리
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 4;
    this.ctx.strokeText(count.toString(), centerX, centerY);

    this.ctx.restore();
  }

  private renderEntities(entities: MapEntityState[], camera: Camera) {
    this.ctx.save();
    entities.forEach((entity) => {
      const transform = this.ctx.getTransform();
      this.ctx.translate(entity.x, entity.y);
      this.ctx.rotate(entity.angle);
      this.ctx.fillStyle = entity.shape.color ?? this._theme.entity[entity.shape.type].fill;
      this.ctx.strokeStyle = entity.shape.color ?? this._theme.entity[entity.shape.type].outline;
      this.ctx.shadowBlur = (this._theme.entity[entity.shape.type].bloomRadius || 0) * (camera.zoom / initialZoom);
      this.ctx.shadowColor = entity.shape.bloomColor || entity.shape.color || this._theme.entity[entity.shape.type].bloom;

      const shape = entity.shape;
      switch (shape.type) {
        case 'polyline':
          if (shape.points.length > 0) {
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.beginPath();
            this.ctx.moveTo(shape.points[0][0], shape.points[0][1]);
            for (let i = 1; i < shape.points.length; i++) {
              this.ctx.lineTo(shape.points[i][0], shape.points[i][1]);
            }
            this.ctx.stroke();
          }
          break;
        case 'box':
          const w = shape.width * 2;
          const h = shape.height * 2;
          const radius = Math.min(w, h) * 0.5; // 반지름 설정
          this.ctx.rotate(shape.rotation);

          this.ctx.beginPath();
          if (this.ctx.roundRect) {
            this.ctx.roundRect(-w / 2, -h / 2, w, h, radius);
          } else {
            this.ctx.rect(-w / 2, -h / 2, w, h);
          }
          this.ctx.fill();
          this.ctx.stroke();

          // 중심축 표시 복구 (막대 두께의 2배)
          this.ctx.shadowBlur = 0;
          this.ctx.fillStyle = '#ffffff';
          this.ctx.beginPath();
          const axisRadius = shape.height * 2;
          this.ctx.arc(0, 0, axisRadius, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = '#000000';
          this.ctx.lineWidth = axisRadius * 0.1;
          this.ctx.stroke();
          break;
        case 'circle':
          this.ctx.beginPath();
          this.ctx.arc(0, 0, shape.radius, 0, Math.PI * 2, false);
          this.ctx.fill(); // 내부에 색을 채워 더 선명하게
          this.ctx.stroke();
          break;
      }

      this.ctx.shadowBlur = 0; // 성능을 위해 매번 초기화
      this.ctx.setTransform(transform);
    });
    this.ctx.restore();
  }

  private renderEffects({ effects, camera }: RenderParameters) {
    effects.forEach((effect) =>
      effect.render(this.ctx, camera.zoom * initialZoom, this._theme),
    );
  }

  private renderMarbles({
    marbles,
    camera,
    winnerRank,
    winners,
    size,
    countdown,
  }: RenderParameters) {
    const winnerIndex = winnerRank - winners.length;

    const viewPort = { x: camera.x, y: camera.y, w: size.x, h: size.y, zoom: camera.zoom * initialZoom };
    marbles.forEach((marble, i) => {
      this.ctx.save();

      // 출발 전 부르르 떠는 효과 (Vibration)
      if (countdown !== null) {
        const shakePower = 0.08;
        const shakeX = (Math.random() - 0.5) * shakePower;
        const shakeY = (Math.random() - 0.5) * shakePower;
        this.ctx.translate(shakeX, shakeY);
      }

      marble.render(
        this.ctx,
        camera.zoom * initialZoom,
        i === winnerIndex,
        false,
        this._images[marble.name] || undefined,
        viewPort,
        this._theme,
      );
      this.ctx.restore();
    });
  }

  private renderWinner({ winner, theme }: RenderParameters) {
    if (!winner) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = this._canvas.width / dpr;
    const canvasHeight = this._canvas.height / dpr;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    this.ctx.save();

    // 배경 어둡게 처리 (뿌연 원 제거)
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 초강력 방사형 색종이 가루 효과 (1200개)
    for (let i = 0; i < 1200; i++) {
      const angle = (i * 137.5) % 360;
      const speed = 0.8 + (i % 20) * 0.2; // 속도 대폭 증가
      const life = (Date.now() / 3 + i * 30) % 1500; // 진행 속도 및 생명주기 조정
      const radius = life * speed;

      const x = centerX + Math.cos(angle * Math.PI / 180) * radius;
      const y = centerY + Math.sin(angle * Math.PI / 180) * radius;

      const alpha = Math.max(0, 1 - life / 1500);
      const sizeW = 2 + (i % 10);
      const sizeH = 1 + (i % 6);
      const rotation = (Date.now() / 100 + i) % (Math.PI * 2); // 종이 조각 회전

      const hue = (i % 2 === 0) ? (45 + Math.random() * 15) : (winner.hue + i * 0.5) % 360; // 황금색 비중 높임
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(rotation);
      this.ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${alpha})`;

      // 종이 조각 느낌을 위해 사각형으로 변경
      this.ctx.fillRect(-sizeW / 2, -sizeH / 2, sizeW, sizeH);

      if (i % 20 === 0) {
        this.ctx.shadowBlur = sizeW;
        this.ctx.shadowColor = `hsl(50, 100%, 50%)`; // 황금색 발광
        this.ctx.fillRect(-sizeW / 2, -sizeH / 2, sizeW, sizeH);
      }
      this.ctx.restore();
    }

    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // "Winner" 텍스트 - 화려한 황금색 발광
    this.ctx.font = 'bold 60px sans-serif';
    this.ctx.shadowBlur = 35;
    this.ctx.shadowColor = '#FFD700'; // 황금색

    // 다중 그림자 효과
    for (let i = 0; i < 3; i++) {
      this.ctx.strokeStyle = `hsl(50, 100%, ${50 - i * 10}%)`;
      this.ctx.lineWidth = 8 - i * 2;
      this.ctx.strokeText('🏆 WINNER 🏆', centerX, centerY - 80);
    }

    const winnerGradient = this.ctx.createLinearGradient(
      centerX - 200, centerY - 80,
      centerX + 200, centerY - 80
    );
    winnerGradient.addColorStop(0, '#FFD700');
    winnerGradient.addColorStop(0.5, '#FFF');
    winnerGradient.addColorStop(1, '#FFD700');
    this.ctx.fillStyle = winnerGradient;
    this.ctx.fillText('🏆 WINNER 🏆', centerX, centerY - 80);

    // 우승자 이름 - 초대형 황금빛 표시
    this.ctx.font = 'bold 100px sans-serif';
    this.ctx.shadowBlur = 60;
    this.ctx.shadowColor = '#FFA500'; // 오렌지/골드 광채

    // 이름 다중 그림자
    for (let i = 0; i < 5; i++) {
      this.ctx.strokeStyle = `hsl(45, 100%, ${50 - i * 5}%)`;
      this.ctx.lineWidth = 12 - i * 2;
      this.ctx.strokeText(winner.name, centerX, centerY + 20);
    }

    // 이름 그라데이션
    const nameGradient = this.ctx.createLinearGradient(
      centerX - 300, centerY,
      centerX + 300, centerY
    );
    nameGradient.addColorStop(0, '#FFD700');
    nameGradient.addColorStop(0.5, '#FFFFFF');
    nameGradient.addColorStop(1, '#FFD700');
    this.ctx.fillStyle = nameGradient;
    this.ctx.fillText(winner.name, centerX, centerY + 20);

    // 축하 메시지
    this.ctx.font = 'bold 40px sans-serif';
    this.ctx.shadowBlur = 20;
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fillText('✨ CONGRATULATIONS ✨', centerX, centerY + 100);

    this.ctx.restore();
  }
}
