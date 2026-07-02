/**
 * ペーパークラフト風 Canvas 描画ヘルパー。
 * 「切り紙を貼った」見た目 = 輪郭を少し不揃いにする + 下に落ち影を敷く。
 */

/** 決定的な擬似乱数（seed毎に同じ揺らぎ→ちらつかない） */
export function seededJitter(seed: number, i: number, amp: number): number {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * amp;
}

type PaperShapeOpts = {
  fill: string;
  /** 切り口の白フチ。省略で無し */
  edge?: string;
  edgeWidth?: number;
  /** 落ち影。省略でrgba黒 */
  shadow?: string;
  shadowDx?: number;
  shadowDy?: number;
  /** 輪郭の揺らぎ量(px)。0でまっすぐ */
  jitter?: number;
  /** 揺らぎのseed（同じ図形は同じ値を渡す） */
  seed?: number;
};

/** ちぎり紙風の多角形（矩形ベース）を描く */
export function paperRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: PaperShapeOpts,
): void {
  const { jitter = Math.min(w, h) * 0.04, seed = x * 7 + y * 13 } = opts;
  const pts: [number, number][] = [];
  const per = 2 * (w + h);
  const step = Math.max(10, per / 22);
  let i = 0;
  const push = (px: number, py: number) => {
    pts.push([
      px + seededJitter(seed, i * 2, jitter),
      py + seededJitter(seed, i * 2 + 1, jitter),
    ]);
    i++;
  };
  for (let t = 0; t < w; t += step) push(x + t, y);
  for (let t = 0; t < h; t += step) push(x + w, y + t);
  for (let t = 0; t < w; t += step) push(x + w - t, y + h);
  for (let t = 0; t < h; t += step) push(x, y + h - t);
  paperPath(ctx, pts, opts);
}

/** ちぎり紙風の円を描く */
export function paperCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  opts: PaperShapeOpts,
): void {
  const { jitter = r * 0.06, seed = cx * 7 + cy * 13 } = opts;
  const n = Math.max(12, Math.floor(r / 2.2));
  const pts: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rr = r + seededJitter(seed, k, jitter);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  paperPath(ctx, pts, opts);
}

/** 任意頂点のちぎり紙ポリゴン */
export function paperPoly(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  opts: PaperShapeOpts,
): void {
  const { jitter = 2, seed = points[0][0] * 7 + points[0][1] * 13 } = opts;
  const pts: [number, number][] = points.map(([px, py], k) => [
    px + seededJitter(seed, k * 2, jitter),
    py + seededJitter(seed, k * 2 + 1, jitter),
  ]);
  paperPath(ctx, pts, opts);
}

function paperPath(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  opts: PaperShapeOpts,
): void {
  const {
    fill,
    edge,
    edgeWidth = 2.5,
    shadow = "rgba(0,0,0,.35)",
    shadowDx = 0,
    shadowDy = 4,
  } = opts;
  const trace = (dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0] + dx, pts[k][1] + dy);
    ctx.closePath();
  };
  if (shadow) {
    trace(shadowDx, shadowDy);
    ctx.fillStyle = shadow;
    ctx.fill();
  }
  trace(0, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = edgeWidth;
    ctx.stroke();
  }
}

/** 夜空背景（藍グラデ + 星）をステージ全面に敷く */
export function drawNightSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed = 7,
): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#03122A");
  g.addColorStop(0.55, "#072341");
  g.addColorStop(1, "#0C2E52");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,244,214,.8)";
  for (let k = 0; k < 26; k++) {
    const sx = (seededJitter(seed, k * 2, 0.5) + 0.5) * w;
    const sy = (seededJitter(seed, k * 2 + 1, 0.5) + 0.5) * h * 0.55;
    const r = 0.8 + Math.abs(seededJitter(seed + 1, k, 1.2));
    ctx.globalAlpha = 0.35 + Math.abs(seededJitter(seed + 2, k, 0.5));
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 提灯（切り紙風）を描く */
export function drawLantern(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color = "#C4372A",
): void {
  // グロー
  const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.2);
  g.addColorStop(0, "rgba(255,190,110,.4)");
  g.addColorStop(1, "rgba(255,190,110,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
  ctx.fill();
  // 本体
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 1.14);
  paperCircle(ctx, 0, 0, r, {
    fill: color,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
    seed: cx,
  });
  ctx.restore();
  // 蓋
  ctx.fillStyle = "#3A2E2A";
  ctx.fillRect(cx - r * 0.4, cy - r * 1.3, r * 0.8, r * 0.18);
  ctx.fillRect(cx - r * 0.36, cy + r * 1.12, r * 0.72, r * 0.16);
  // ハイライト
  ctx.fillStyle = "rgba(255,214,140,.5)";
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.15, r * 0.42, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}
