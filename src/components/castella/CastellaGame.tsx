"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import GameShell from "@/components/game/GameShell";
import Leaderboard from "@/components/game/Leaderboard";
import ScoreSubmit from "@/components/game/ScoreSubmit";
import { P } from "@/components/game/palette";
import {
  drawLantern,
  drawNightSky,
  paperCircle,
  paperPoly,
  paperRect,
  seededJitter,
} from "@/components/game/paper";
import { ensureAudio, sfx } from "@/components/game/audio";

/* ================= 定数 ================= */

const W = 480;
const H = 640;
const GAME_TIME = 40;

// 黄金ゾーン: この doneness 帯でタップすると成功
const GOLD_LO = 0.7;
const GOLD_HI = 0.9;
// ど真ん中ボーナス帯
const PIN_LO = 0.76;
const PIN_HI = 0.84;
const PIN_BONUS = 15;
const BASE_PTS = 50;
const COMBO_STEP = 0.15;
const COMBO_MAX_MULT = 2.5;

// 焼き上がり速度: doneness/秒。終盤は 1 + DIFF_MAX_BONUS 倍まで加速
const BASE_COOK = 1 / 6.5;
const DIFF_MAX_BONUS = 0.85;

const MOLD_R = 56;
const BALL_R = 38;
const FLIGHT_T = 0.7; // 返した玉が袋へ飛ぶ時間
const BAG = { x: W - 64, y: 64 };

// 型（くぼみ）の配置: 2列×3段
const MOLD_POS: [number, number][] = [
  [150, 210],
  [330, 210],
  [150, 370],
  [330, 370],
  [150, 530],
  [330, 530],
];

type Phase = "ready" | "playing" | "result";

type Mold = {
  x: number;
  y: number;
  seed: number;
  cooking: boolean;
  doneness: number; // 0→1（1で自動焦げ）
  refillAt: number; // このシミュ時刻以降に生地を流す
};

type FlyBall = { x: number; y: number; t: number; seed: number };
type Puff = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  color: string;
};
type Pop = {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  seed: number;
};

type Sim = {
  phase: Phase;
  t: number; // 経過シミュ時間
  time: number; // 残り秒
  score: number;
  combo: number; // 連続成功数
  bestCombo: number;
  collected: number; // 袋づめ数（成功）
  raw: number; // 生焼け数
  burnt: number; // 焦げ数
  bag: number; // 袋に着地した数（描画用）
  molds: Mold[];
  flights: FlyBall[];
  puffs: Puff[];
  pops: Pop[];
  nextSeed: number;
};

type Ui = {
  phase: Phase;
  score: number;
  sec: number;
  combo: number;
  bestCombo: number;
  collected: number;
  raw: number;
  burnt: number;
};

/* ================= シミュレーション ================= */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function comboMult(combo: number): number {
  return Math.min(COMBO_MAX_MULT, 1 + COMBO_STEP * combo);
}

/** 焼き速度（経過秒で加速） */
function cookSpeed(elapsed: number): number {
  return BASE_COOK * (1 + DIFF_MAX_BONUS * clamp(elapsed / GAME_TIME, 0, 1));
}

/** 同時に焼ける最大数（3 → 6 に増える） */
function maxActive(elapsed: number): number {
  return Math.min(MOLD_POS.length, 3 + Math.floor(elapsed / 10));
}

/** 空いた型に次の生地を流すまでの待ち（だんだん短く） */
function refillDelay(elapsed: number): number {
  return 1.5 - 1.0 * clamp(elapsed / GAME_TIME, 0, 1) + Math.random() * 0.5;
}

function makeSim(): Sim {
  const molds: Mold[] = MOLD_POS.map(([x, y], i) => ({
    x,
    y,
    seed: i * 29 + 5,
    cooking: false,
    doneness: 0,
    refillAt: 0.3 + i * 0.9 + Math.random() * 0.4,
  }));
  return {
    phase: "ready",
    t: 0,
    time: GAME_TIME,
    score: 0,
    combo: 0,
    bestCombo: 0,
    collected: 0,
    raw: 0,
    burnt: 0,
    bag: 0,
    molds,
    flights: [],
    puffs: [],
    pops: [],
    nextSeed: 100,
  };
}

function endGame(s: Sim): void {
  if (s.phase === "result") return;
  s.phase = "result";
  sfx.finish();
}

function addPop(s: Sim, x: number, y: number, text: string): void {
  s.pops.push({
    x: clamp(x, 84, W - 84),
    y: clamp(y, 48, H - 40),
    text,
    life: 1.15,
    maxLife: 1.15,
    seed: s.nextSeed++,
  });
}

function spawnPuffs(s: Sim, x: number, y: number, color: string): void {
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * 1.15 + Math.random() * Math.PI * 0.7; // 上方向中心
    const sp = 30 + Math.random() * 50;
    const life = 0.5 + Math.random() * 0.3;
    s.puffs.push({
      x: x + (Math.random() - 0.5) * 24,
      y: y - 6,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 30,
      r: 5 + Math.random() * 5,
      life,
      maxLife: life,
      color,
    });
  }
}

function emptyMold(s: Sim, m: Mold): void {
  m.cooking = false;
  m.doneness = 0;
  const elapsed = clamp(GAME_TIME - s.time, 0, GAME_TIME);
  m.refillAt = s.t + refillDelay(elapsed);
}

/** 焦げ（タップ遅れ / 放置で doneness 1.0 到達） */
function burnMold(s: Sim, m: Mold): void {
  s.burnt++;
  s.combo = 0;
  spawnPuffs(s, m.x, m.y, "#4A342B");
  if (s.phase === "playing") {
    addPop(s, m.x, m.y - MOLD_R - 16, "焦げた…");
    sfx.pop();
  }
  emptyMold(s, m);
}

/** pointerdown: 型をタップした時の解決 */
function tapMold(s: Sim, m: Mold): void {
  if (!m.cooking) return;
  const d = m.doneness;
  if (d < GOLD_LO) {
    // 生焼け
    s.raw++;
    s.combo = 0;
    spawnPuffs(s, m.x, m.y, "#EFE0C2");
    addPop(s, m.x, m.y - MOLD_R - 16, "生焼け…");
    sfx.miss();
    emptyMold(s, m);
  } else if (d <= GOLD_HI) {
    // 黄金色: 返して袋へ
    const mult = comboMult(s.combo);
    const pin = d >= PIN_LO && d <= PIN_HI;
    const pts = Math.round(BASE_PTS * mult) + (pin ? PIN_BONUS : 0);
    s.score += pts;
    s.combo++;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.collected++;
    s.flights.push({ x: m.x, y: m.y, t: 0, seed: s.nextSeed++ });
    addPop(s, m.x, m.y - MOLD_R - 16, `+${pts}`);
    if (pin) addPop(s, m.x, m.y - MOLD_R - 52, "ドンピシャ！");
    if (pin || mult >= 2) sfx.bigHit();
    else sfx.hit();
    emptyMold(s, m);
  } else {
    // 遅すぎ = 焦げ
    burnMold(s, m);
  }
}

function update(s: Sim, dt: number): void {
  s.t += dt;
  const elapsed = clamp(GAME_TIME - s.time, 0, GAME_TIME);

  if (s.phase === "playing") {
    const prevSec = Math.ceil(s.time);
    s.time -= dt;
    const sec = Math.max(0, Math.ceil(s.time));
    if (sec !== prevSec && sec <= 5 && sec >= 1) sfx.tick();
    if (s.time <= 0) endGame(s);
  }

  // 焼き上げ（ready/result 中も屋台の雰囲気として回し続ける）
  const speed = cookSpeed(s.phase === "playing" ? elapsed : 0);
  let active = 0;
  for (const m of s.molds) if (m.cooking) active++;
  const cap = maxActive(s.phase === "playing" ? elapsed : 0);
  for (const m of s.molds) {
    if (m.cooking) {
      m.doneness += speed * dt;
      if (m.doneness >= 1) burnMold(s, m);
    } else if (s.t >= m.refillAt && active < cap) {
      m.cooking = true;
      m.doneness = 0;
      active++;
    }
  }

  // 袋へ飛ぶ玉
  for (let i = s.flights.length - 1; i >= 0; i--) {
    const fl = s.flights[i];
    fl.t += dt;
    if (fl.t >= FLIGHT_T) {
      s.bag++;
      s.flights.splice(i, 1);
    }
  }

  // 湯気・煙
  s.puffs = s.puffs.filter((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= 20 * dt;
    p.r += 6 * dt;
    p.life -= dt;
    return p.life > 0;
  });
  s.pops = s.pops.filter((p) => {
    p.y -= 26 * dt;
    p.life -= dt;
    return p.life > 0;
  });
}

/* ================= 描画 ================= */

function hexLerp(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const kk = clamp(k, 0, 1);
  const ch = (sh: number) => {
    const va = (pa >> sh) & 255;
    const vb = (pb >> sh) & 255;
    return Math.round(va + (vb - va) * kk);
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** doneness → 玉の色（生地クリーム → 黄金 → 焦げ茶） */
function ballColor(d: number): string {
  if (d <= GOLD_LO) return hexLerp(P.kraftLight, P.gold, d / GOLD_LO);
  return hexLerp(P.gold, "#5B3413", (d - GOLD_LO) / (1 - GOLD_LO));
}

/** 銅板の焼き台 + 型のくぼみ */
function drawGriddle(ctx: CanvasRenderingContext2D, s: Sim): void {
  // 外枠（木）→ 焼き板
  paperRect(ctx, 28, 118, W - 56, 484, {
    fill: P.woodDeep,
    edge: "#5E3D1D",
    edgeWidth: 2.5,
    jitter: 3,
    seed: 61,
    shadow: "rgba(0,0,0,.45)",
    shadowDy: 6,
  });
  paperRect(ctx, 42, 132, W - 84, 456, {
    fill: P.wood,
    jitter: 2.5,
    seed: 62,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
  });
  // 板の木目（うすい線）
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = P.woodDeep;
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 5; k++) {
    const yy = 168 + k * 88 + seededJitter(63, k, 8);
    ctx.beginPath();
    ctx.moveTo(52, yy);
    for (let x = 52; x <= W - 52; x += 24) {
      ctx.lineTo(x, yy + seededJitter(64 + k, x, 3));
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 型のくぼみ
  for (const m of s.molds) {
    paperCircle(ctx, m.x, m.y, MOLD_R, {
      fill: P.woodDeep,
      edge: "#5E3D1D",
      edgeWidth: 2,
      jitter: 2.5,
      seed: m.seed,
      shadow: "rgba(0,0,0,.35)",
      shadowDy: 4,
    });
    paperCircle(ctx, m.x, m.y, MOLD_R - 10, {
      fill: "#4F3319",
      jitter: 2,
      seed: m.seed + 1,
      shadow: "rgba(0,0,0,.3)",
      shadowDy: 2,
    });
  }
}

/** 黄金ゾーンの合図（型のまわりの光るリング） */
function drawGoldenCue(ctx: CanvasRenderingContext2D, m: Mold, t: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(t * 9 + m.seed);
  // ふわっと光る面
  const g = ctx.createRadialGradient(m.x, m.y, MOLD_R * 0.4, m.x, m.y, MOLD_R + 18);
  g.addColorStop(0, `rgba(255,217,138,${0.16 + 0.12 * pulse})`);
  g.addColorStop(1, "rgba(255,217,138,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(m.x, m.y, MOLD_R + 18, 0, Math.PI * 2);
  ctx.fill();
  // パルスリング
  ctx.globalAlpha = 0.35 + 0.4 * pulse;
  ctx.strokeStyle = "#FFD98A";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(m.x, m.y, MOLD_R + 6 + pulse * 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** 焼けているカステラ玉 */
function drawBall(ctx: CanvasRenderingContext2D, m: Mold, t: number): void {
  const d = m.doneness;
  // 生地が流れて膨らむ（d=0.5 で満球）
  const sc = 0.72 + 0.28 * clamp(d / 0.5, 0, 1);
  const r = BALL_R * sc;
  paperCircle(ctx, m.x, m.y, r, {
    fill: ballColor(d),
    edge: "rgba(251,240,218,.35)",
    edgeWidth: 1.4,
    jitter: r * 0.06,
    seed: m.seed + 2,
    shadow: "rgba(0,0,0,.35)",
    shadowDy: 3,
  });
  // 照りハイライト
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = P.paper;
  ctx.beginPath();
  ctx.ellipse(m.x - r * 0.3, m.y - r * 0.35, r * 0.32, r * 0.18, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // 湯気（phase 駆動・状態レス）
  if (d > 0.35) {
    const vis = clamp((d - 0.35) / 0.2, 0, 1);
    for (let k = 0; k < 2; k++) {
      const ph = t * 1.6 + m.seed * 2.1 + k * 2.6;
      const cyc = (ph % 2) / 2;
      const wx = m.x + Math.sin(ph * 3) * 6 + (k - 0.5) * 18;
      const wy = m.y - r - 6 - cyc * 26;
      ctx.globalAlpha = 0.3 * (1 - cyc) * vis;
      ctx.fillStyle = P.paper;
      ctx.beginPath();
      ctx.arc(wx, wy, 3 + cyc * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** 袋へ飛ぶ玉 */
function drawFlight(ctx: CanvasRenderingContext2D, fl: FlyBall): void {
  const k = clamp(fl.t / FLIGHT_T, 0, 1);
  const px = fl.x + (BAG.x - fl.x) * k;
  const py = fl.y + (BAG.y - fl.y) * k - Math.sin(k * Math.PI) * 110;
  const r = BALL_R * (1 - 0.55 * k);
  paperCircle(ctx, px, py, r, {
    fill: P.gold,
    edge: "rgba(251,240,218,.4)",
    edgeWidth: 1.2,
    jitter: r * 0.06,
    seed: fl.seed,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
  });
}

/** 右上の紙袋（袋づめした玉が積み上がる） */
function drawBag(ctx: CanvasRenderingContext2D, bag: number): void {
  const { x, y } = BAG;
  const body: [number, number][] = [
    [x - 30, y - 24],
    [x + 30, y - 24],
    [x + 38, y + 34],
    [x - 38, y + 34],
  ];
  paperPoly(ctx, body, {
    fill: P.kraftLight,
    edge: P.kraftDeep,
    edgeWidth: 2,
    jitter: 2.5,
    seed: 81,
    shadow: "rgba(0,0,0,.4)",
    shadowDy: 5,
  });
  // 折り返し口
  paperRect(ctx, x - 33, y - 28, 66, 10, {
    fill: P.kraftDeep,
    jitter: 1.5,
    seed: 82,
    shadow: "rgba(0,0,0,.2)",
    shadowDy: 2,
  });
  // 玉のピラミッド（最大10個表示）
  const rows: [number, number][] = [];
  const layout = [4, 3, 2, 1];
  let placed = 0;
  layout.forEach((n, ri) => {
    for (let c = 0; c < n; c++) {
      if (placed >= Math.min(bag, 10)) return;
      rows.push([x + (c - (n - 1) / 2) * 15, y + 22 - ri * 12]);
      placed++;
    }
  });
  for (const [bx, by] of rows) {
    ctx.fillStyle = P.gold;
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(251,240,218,.5)";
    ctx.beginPath();
    ctx.arc(bx - 2, by - 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPuffs(ctx: CanvasRenderingContext2D, s: Sim): void {
  for (const p of s.puffs) {
    ctx.globalAlpha = 0.5 * clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 紙タグポップ（+120 / ドンピシャ！ / 焦げた…） */
function drawPops(ctx: CanvasRenderingContext2D, s: Sim): void {
  for (const p of s.pops) {
    const born = p.maxLife - p.life;
    const appear = Math.min(1, born / 0.12);
    const alpha = clamp(p.life / 0.35, 0, 1) * appear;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(seededJitter(p.seed, 0, 0.07));
    ctx.scale(0.75 + 0.25 * appear, 0.75 + 0.25 * appear);
    ctx.globalAlpha = alpha;
    ctx.font =
      "900 17px 'Zen Maru Gothic','Hiragino Maru Gothic ProN',sans-serif";
    const w = ctx.measureText(p.text).width;
    paperRect(ctx, -w / 2 - 11, -15, w + 22, 30, {
      fill: P.kraftLight,
      edge: P.red,
      edgeWidth: 2,
      jitter: 2,
      seed: p.seed,
      shadow: "rgba(0,0,0,.35)",
      shadowDy: 3,
    });
    ctx.fillStyle = P.redDeep;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.text, 0, 1);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function render(ctx: CanvasRenderingContext2D, s: Sim): void {
  drawNightSky(ctx, W, H, 9);
  drawLantern(ctx, 56, 62, 20);
  drawGriddle(ctx, s);
  for (const m of s.molds) {
    if (!m.cooking) continue;
    if (m.doneness >= GOLD_LO && m.doneness <= GOLD_HI) {
      drawGoldenCue(ctx, m, s.t);
    }
    drawBall(ctx, m, s.t);
  }
  drawBag(ctx, s.bag);
  for (const fl of s.flights) drawFlight(ctx, fl);
  drawPuffs(ctx, s);
  drawPops(ctx, s);
}

/* ================= コンポーネント ================= */

function rankTitle(score: number): string {
  if (score >= 1200) return "カステラ職人！";
  if (score >= 600) return "いい焼き加減！";
  if (score >= 200) return "もうちょい！";
  return "また挑戦してね";
}

const CARD_CLASS =
  "torn border-[3px] border-kraft-paper bg-kraft paper-grain shadow-paper text-fes-ink p-6 text-center max-w-xs";
const BTN_CLASS =
  "rounded-full bg-fes-red border-2 border-fes-red-deep text-kraft-paper font-maru font-black px-8 py-2.5 shadow-paper-sm hover:-translate-y-0.5 transition-transform";

export default function CastellaGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<Sim | null>(null);
  const uiKeyRef = useRef("");
  const [ui, setUi] = useState<Ui>({
    phase: "ready",
    score: 0,
    sec: GAME_TIME,
    combo: 0,
    bestCombo: 0,
    collected: 0,
    raw: 0,
    burnt: 0,
  });

  const pushUi = useCallback(() => {
    const s = simRef.current;
    if (!s) return;
    const next: Ui = {
      phase: s.phase,
      score: s.score,
      sec: Math.max(0, Math.ceil(s.time)),
      combo: s.combo,
      bestCombo: s.bestCombo,
      collected: s.collected,
      raw: s.raw,
      burnt: s.burnt,
    };
    const key = `${next.phase}|${next.score}|${next.sec}|${next.combo}|${next.bestCombo}|${next.collected}|${next.raw}|${next.burnt}`;
    if (key !== uiKeyRef.current) {
      uiKeyRef.current = key;
      setUi(next);
    }
  }, []);

  const start = useCallback(() => {
    ensureAudio();
    sfx.tap();
    const s = makeSim();
    s.phase = "playing";
    simRef.current = s;
    pushUi();
  }, [pushUi]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stage = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    if (!ctx || !stage) return;
    if (!simRef.current) simRef.current = makeSim();

    const scale = { x: 1, y: 1 };
    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      scale.x = canvas.width / W;
      scale.y = canvas.height / H;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    resize();

    const toLocal = (e: PointerEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      return [
        ((e.clientX - r.left) / r.width) * W,
        ((e.clientY - r.top) / r.height) * H,
      ];
    };
    const onDown = (e: PointerEvent) => {
      const s = simRef.current;
      if (!s || s.phase !== "playing") return;
      const [x, y] = toLocal(e);
      // 一番近い型（判定は少し甘め）
      let best: Mold | null = null;
      let bestD2 = Infinity;
      const hitR = MOLD_R * 1.18;
      for (const m of s.molds) {
        const d2 = (m.x - x) ** 2 + (m.y - y) ** 2;
        if (d2 <= hitR * hitR && d2 < bestD2) {
          best = m;
          bestD2 = d2;
        }
      }
      if (best) tapMold(s, best);
    };
    canvas.addEventListener("pointerdown", onDown);

    let raf = 0;
    let prev = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const s = simRef.current;
      if (s) {
        update(s, dt);
        ctx.setTransform(scale.x, 0, 0, scale.y, 0, 0);
        render(ctx, s);
        pushUi();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, [pushUi]);

  const mult = comboMult(ui.combo);

  const scoreboard = (
    <div className="flex items-center justify-between font-maru text-sm font-black">
      <span>⏱ のこり {ui.sec}</span>
      <span aria-label={`コンボ倍率 ×${mult.toFixed(1)}`}>
        🔥 ×{mult.toFixed(1)}
      </span>
      <span>袋 {ui.collected}こ</span>
    </div>
  );

  const overlay =
    ui.phase === "ready" ? (
      <div className={CARD_CLASS}>
        <h2 className="font-maru font-black text-2xl text-fes-indigo">
          🥮 ベビーカステラ
        </h2>
        <p className="mt-3 font-maru text-sm font-bold">
          黄金色になったら返す！焦げる前にタップ！
        </p>
        <p className="mt-1.5 font-maru text-xs font-bold">制限時間は40秒</p>
        <ul className="mt-2 space-y-0.5 text-left font-maru text-xs font-bold text-fes-ink/80">
          <li>・きつね色のリングが光ったらタップ</li>
          <li>・早いと生焼け、遅れると焦げてコンボが切れる</li>
          <li>・れんぞく成功で倍率アップ（最大×3）</li>
          <li>・ど真ん中で返すと +30 ボーナス</li>
          <li>・時間がたつと焼けるのが速くなる</li>
        </ul>
        <button type="button" onClick={start} className={`mt-5 ${BTN_CLASS}`}>
          はじめる
        </button>
      </div>
    ) : ui.phase === "result" ? (
      <div className={CARD_CLASS}>
        <p className="font-maru text-xs font-bold text-fes-ink/75">けっか</p>
        <p className="mt-1 font-maru font-black text-5xl text-fes-red">
          {ui.score}
          <span className="ml-1 text-base">てん</span>
        </p>
        <h2 className="mt-2 font-maru font-black text-2xl text-fes-indigo">
          {rankTitle(ui.score)}
        </h2>
        <p className="mt-2 font-maru text-sm font-bold">
          袋づめ×{ui.collected}　生焼け×{ui.raw}　焦げ×{ui.burnt}
        </p>
        <p className="mt-1 font-maru text-xs font-bold text-fes-ink/75">
          さいだいコンボ {ui.bestCombo}
        </p>
        <div className="mt-4 space-y-3 text-left">
          <ScoreSubmit game="castella" score={ui.score} />
          <Leaderboard game="castella" />
        </div>
        <button type="button" onClick={start} className={`mt-5 ${BTN_CLASS}`}>
          もう一回
        </button>
        <Link
          href="/"
          className="mt-4 block font-maru text-xs font-bold underline underline-offset-2"
        >
          ← 会場にもどる
        </Link>
      </div>
    ) : null;

  return (
    <GameShell
      title="ベビーカステラ"
      tagline="きつね色でひっくり返せ！"
      scoreboard={scoreboard}
      overlay={overlay}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-pointer touch-none"
        aria-label="ベビーカステラのゲーム画面"
      />
    </GameShell>
  );
}
