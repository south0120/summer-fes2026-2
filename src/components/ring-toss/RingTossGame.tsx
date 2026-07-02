"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import GameShell from "@/components/game/GameShell";
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

/* ---------------------------------- 定数 ---------------------------------- */

/** 論理座標系（縦3:4） */
const W = 480;
const H = 640;

/** リングの待機位置・可動域 */
const RING_HOME_Y = 575;
const RING_MIN_X = 60;
const RING_MAX_X = 420;

const TOTAL_RINGS = 5;
const FLIGHT_MS = 700;
const GAUGE_PERIOD_S = 1.2;

type PegDef = {
  x: number;
  /** ペグ頭のy（着地判定の中心） */
  topY: number;
  h: number;
  w: number;
  score: number;
  gold: boolean;
  /** 着地判定の閾値（奥ほど狭い） */
  thr: number;
  /** 点数札のxオフセット */
  tagDx: number;
};

const PEGS: PegDef[] = [
  { x: 240, topY: 300, h: 46, w: 9, score: 50, gold: true, thr: 22, tagDx: 24 },
  { x: 150, topY: 380, h: 56, w: 11, score: 30, gold: false, thr: 26, tagDx: -58 },
  { x: 330, topY: 450, h: 64, w: 13, score: 10, gold: false, thr: 28, tagDx: 26 },
];

/* ---------------------------------- 型 ---------------------------------- */

type Phase = "ready" | "playing" | "result";

type Fly = {
  x: number;
  sy: number;
  ty: number;
  t0: number;
  dur: number;
  arc: number;
  seed: number;
};

type Settled = {
  x: number;
  y: number;
  /** 刺さったペグのindex。外れはnull（地面に転がる） */
  pegIndex: number | null;
  seed: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  w: number;
  h: number;
  born: number;
  life: number;
};

type GameState = {
  phase: Phase;
  pointerX: number;
  charging: boolean;
  chargeT0: number;
  power: number;
  fly: Fly | null;
  settled: Settled[];
  particles: Particle[];
  ringsLeft: number;
  score: number;
  ringSeed: number;
  finishAt: number;
};

function makeState(): GameState {
  return {
    phase: "ready",
    pointerX: W / 2,
    charging: false,
    chargeT0: 0,
    power: 0,
    fly: null,
    settled: [],
    particles: [],
    ringsLeft: TOTAL_RINGS,
    score: 0,
    ringSeed: 1,
    finishAt: 0,
  };
}

/* ------------------------------- 純粋ヘルパー ------------------------------- */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** 奥行きに応じたリングの縮尺（手前1.0 → 奥0.55） */
function depthScale(y: number): number {
  const t = clamp((y - 290) / (RING_HOME_Y - 290), 0, 1);
  return 0.55 + t * 0.45;
}

/** パワー(0-100) → 着地目標y（100→約290 / 20→約466） */
function targetYForPower(power: number): number {
  return clamp(510 - power * 2.2, 288, 512);
}

function rankFor(score: number): string {
  if (score >= 150) return "大当たり！景品ゲット！";
  if (score >= 90) return "いい感じ！";
  if (score >= 30) return "もうちょい！";
  return "また挑戦してね";
}

/* --------------------------------- 描画 --------------------------------- */

/**
 * 赤い紙のリング（太いドーナツ）。外周+内周の二重パスをevenoddで塗るので
 * 穴は本当に抜けており、背景・ペグがそのまま透ける。
 * squash: 1=正面向きの円 / 0.45前後=寝ている輪
 */
function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  squash: number,
  seed: number,
): void {
  const rO = 34 * scale;
  const rI = 19 * scale;
  const trace = (dx: number, dy: number) => {
    ctx.beginPath();
    const n = 20;
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = rO + seededJitter(seed, k % n, rO * 0.055);
      const px = cx + Math.cos(a) * rr + dx;
      const py = cy + Math.sin(a) * rr * squash + dy;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = rI + seededJitter(seed + 5, k % n, rI * 0.06);
      const px = cx + Math.cos(a) * rr + dx;
      const py = cy + Math.sin(a) * rr * squash + dy;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  // 落ち影
  trace(0, 4 * scale);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fill("evenodd");
  // 本体
  trace(0, 0);
  ctx.fillStyle = P.red;
  ctx.fill("evenodd");
  ctx.strokeStyle = P.paper;
  ctx.lineWidth = 2;
  ctx.stroke();
  // 上側のハイライト（紙の照り）
  ctx.strokeStyle = "rgba(251,240,218,.3)";
  ctx.lineWidth = 4 * scale;
  ctx.beginPath();
  ctx.ellipse(
    cx,
    cy,
    (rO + rI) / 2,
    ((rO + rI) / 2) * squash,
    0,
    Math.PI * 1.1,
    Math.PI * 1.9,
  );
  ctx.stroke();
}

/** 木のペグ（棒 + 楕円ベース + 頭）と点数札 */
function drawPeg(ctx: CanvasRenderingContext2D, peg: PegDef, seed: number): void {
  const baseY = peg.topY + peg.h;
  // 根元の楕円ベース
  ctx.save();
  ctx.translate(peg.x, baseY + 2);
  ctx.scale(1, 0.38);
  paperCircle(ctx, 0, 0, peg.w * 2.4, {
    fill: P.woodDeep,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 6,
    jitter: 2,
    seed: seed + 1,
  });
  ctx.restore();
  // 棒
  paperRect(ctx, peg.x - peg.w / 2, peg.topY, peg.w, peg.h, {
    fill: P.wood,
    edge: P.paper,
    edgeWidth: 2,
    jitter: 1.4,
    seed,
    shadowDy: 3,
  });
  // 頭の丸
  paperCircle(ctx, peg.x, peg.topY, peg.w * 0.95, {
    fill: P.woodDeep,
    edge: P.paper,
    edgeWidth: 2,
    jitter: 1,
    seed: seed + 2,
    shadowDy: 2,
  });
  // 50点ペグは金色の飾り
  if (peg.gold) {
    paperCircle(ctx, peg.x, peg.topY - peg.w * 1.5, peg.w * 0.75, {
      fill: P.gold,
      edge: P.goldDeep,
      edgeWidth: 2,
      jitter: 1,
      seed: seed + 3,
      shadowDy: 2,
    });
  }
  // 点数札（小さな紙タグ）
  const tx = peg.x + peg.tagDx;
  const ty = peg.topY - 2;
  paperRect(ctx, tx, ty, 34, 22, {
    fill: P.paper,
    jitter: 1.6,
    seed: seed + 4,
    shadowDy: 3,
  });
  ctx.fillStyle = P.ink;
  ctx.font = '900 14px "Zen Maru Gothic", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(peg.score), tx + 17, ty + 12);
}

/** 1フレーム描画 */
function render(ctx: CanvasRenderingContext2D, g: GameState, now: number): void {
  // 夜空 + 提灯
  drawNightSky(ctx, W, H, 11);
  drawLantern(ctx, 80, 66, 24, P.red);
  drawLantern(ctx, 238, 46, 19, P.gold);
  drawLantern(ctx, 400, 70, 24, P.teal);

  // クラフト紙の地面（手前に広がる台形）
  paperPoly(
    ctx,
    [
      [76, 250],
      [404, 250],
      [480, 640],
      [0, 640],
    ],
    { fill: P.kraft, shadow: "rgba(0,0,0,.4)", shadowDy: 6, jitter: 3, seed: 21 },
  );
  // 奥の縁に一段暗い帯（奥行き）
  paperPoly(
    ctx,
    [
      [78, 250],
      [402, 250],
      [412, 266],
      [66, 266],
    ],
    { fill: P.kraftDeep, shadow: "", jitter: 2, seed: 22 },
  );

  // ペグ（奥→手前）と刺さったリング
  PEGS.forEach((peg, i) => {
    drawPeg(ctx, peg, 100 + i * 17);
    const baseY = peg.topY + peg.h;
    let stack = 0;
    for (const s of g.settled) {
      if (s.pegIndex !== i) continue;
      drawRing(ctx, peg.x, baseY - 6 - stack * 7, depthScale(baseY) * 0.95, 0.45, s.seed);
      stack++;
    }
  });

  // 外して地面に転がったリング
  for (const s of g.settled) {
    if (s.pegIndex !== null) continue;
    drawRing(ctx, s.x, s.y, depthScale(s.y), 0.45, s.seed);
  }

  // 手持ち / 飛行中のリング
  if (g.phase === "playing") {
    if (g.fly) {
      const f = g.fly;
      const t = clamp((now - f.t0) / f.dur, 0, 1);
      const e = 1 - (1 - t) * (1 - t); // ease-out
      const y = f.sy + (f.ty - f.sy) * e - Math.sin(Math.PI * t) * f.arc;
      const sc = 1 + (depthScale(f.ty) - 1) * e;
      const squash = 1 - 0.55 * e;
      drawRing(ctx, f.x, y, sc, squash, f.seed);
    } else if (g.ringsLeft > 0) {
      const pulse = g.charging
        ? 1 + (g.power / 100) * 0.16
        : 1 + Math.sin(now / 320) * 0.02;
      const bobY = RING_HOME_Y + (g.charging ? 0 : Math.sin(now / 430) * 3);
      drawRing(ctx, g.pointerX, bobY, pulse, 1, g.ringSeed);
    }
  }

  // パワーゲージ（右端の紙バー）
  if (g.charging) {
    paperRect(ctx, 440, 200, 26, 340, {
      fill: P.night700,
      edge: P.paper,
      edgeWidth: 2,
      jitter: 2,
      seed: 31,
    });
    const fh = (g.power / 100) * 332;
    ctx.fillStyle = g.power > 75 ? P.red : g.power > 40 ? P.gold : P.teal;
    ctx.fillRect(444, 536 - fh, 18, fh);
  }

  // 紙吹雪
  for (const p of g.particles) {
    const age = (now - p.born) / p.life;
    ctx.save();
    ctx.globalAlpha = clamp(1 - age, 0, 1);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(-p.w / 2 + 1, -p.h / 2 + 2, p.w, p.h);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function spawnConfetti(g: GameState, x: number, y: number, now: number): void {
  const colors = [P.red, P.gold, P.teal, P.paper, P.goldDeep];
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 160;
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 120,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 10,
      color: colors[i % colors.length],
      w: 5 + Math.random() * 5,
      h: 7 + Math.random() * 6,
      born: now,
      life: 1200 + Math.random() * 600,
    });
  }
}

/* ------------------------------ コンポーネント ------------------------------ */

export default function RingTossGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gref = useRef<GameState>(makeState());
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [ringsLeft, setRingsLeft] = useState(TOTAL_RINGS);

  /* ゲームループ + 入力 + リサイズ */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const toLogicalX = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return ((e.clientX - rect.left) / rect.width) * W;
    };

    const onDown = (e: PointerEvent) => {
      const g = gref.current;
      if (g.phase !== "playing" || g.fly || g.ringsLeft <= 0) return;
      ensureAudio();
      g.pointerX = clamp(toLogicalX(e), RING_MIN_X, RING_MAX_X);
      g.charging = true;
      g.chargeT0 = performance.now();
      g.power = 0;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // pointer capture 非対応環境は無視
      }
    };

    const onMove = (e: PointerEvent) => {
      const g = gref.current;
      if (g.phase !== "playing" || g.fly) return;
      g.pointerX = clamp(toLogicalX(e), RING_MIN_X, RING_MAX_X);
    };

    const onUp = () => {
      const g = gref.current;
      if (!g.charging) return;
      g.charging = false;
      if (g.phase !== "playing" || g.fly || g.ringsLeft <= 0) return;
      const ty = targetYForPower(g.power);
      g.fly = {
        x: g.pointerX,
        sy: RING_HOME_Y,
        ty,
        t0: performance.now(),
        dur: FLIGHT_MS,
        arc: Math.max(30, (RING_HOME_Y - ty) * 0.32),
        seed: g.ringSeed,
      };
      g.ringsLeft -= 1;
      setRingsLeft(g.ringsLeft);
      sfx.whoosh();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      const g = gref.current;

      // パワーゲージ往復（0→100→0 / 周期1.2s）
      if (g.charging) {
        const ph = ((now - g.chargeT0) / 1000 / GAUGE_PERIOD_S) % 1;
        g.power = (ph < 0.5 ? ph * 2 : (1 - ph) * 2) * 100;
      }

      // 着地判定
      if (g.fly && now - g.fly.t0 >= g.fly.dur) {
        const f = g.fly;
        g.fly = null;
        let hit = -1;
        let best = Infinity;
        PEGS.forEach((peg, i) => {
          const d = Math.hypot(f.x - peg.x, f.ty - peg.topY);
          if (d <= peg.thr && d < best) {
            best = d;
            hit = i;
          }
        });
        if (hit >= 0) {
          const peg = PEGS[hit];
          g.settled.push({ x: peg.x, y: peg.topY + peg.h, pegIndex: hit, seed: f.seed });
          g.score += peg.score;
          setScore(g.score);
          if (peg.score === 50) {
            sfx.bigHit();
            spawnConfetti(g, peg.x, peg.topY, now);
          } else {
            sfx.hit();
          }
        } else {
          g.settled.push({ x: f.x, y: f.ty, pegIndex: null, seed: f.seed });
          sfx.miss();
        }
        g.ringSeed += 7;
        if (g.ringsLeft <= 0) g.finishAt = now + 1000;
      }

      // 全投擲終了 → リザルト
      if (g.finishAt && now >= g.finishAt && g.phase === "playing") {
        g.finishAt = 0;
        g.phase = "result";
        setPhase("result");
        sfx.finish();
      }

      // 紙吹雪更新
      if (g.particles.length) {
        g.particles = g.particles.filter((p) => now - p.born < p.life);
        for (const p of g.particles) {
          p.vy += 380 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
        }
      }

      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
      render(ctx, g, now);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const start = useCallback(() => {
    const g = gref.current;
    g.settled = [];
    g.particles = [];
    g.fly = null;
    g.charging = false;
    g.power = 0;
    g.score = 0;
    g.ringsLeft = TOTAL_RINGS;
    g.finishAt = 0;
    g.ringSeed = 1;
    g.pointerX = W / 2;
    g.phase = "playing";
    setScore(0);
    setRingsLeft(TOTAL_RINGS);
    setPhase("playing");
    ensureAudio();
    sfx.tap();
  }, []);

  /* ------------------------------- UI 部品 ------------------------------- */

  const scoreboard = (
    <div className="flex items-center justify-between font-maru font-black">
      <span className="text-sm">
        のこり{" "}
        {Array.from({ length: TOTAL_RINGS }).map((_, i) => (
          <span
            key={i}
            className={i < ringsLeft ? "text-fes-red" : "text-fes-ink/25"}
            aria-hidden
          >
            ●
          </span>
        ))}
        <span className="sr-only">{ringsLeft}本</span>
      </span>
      <span className="text-sm">
        スコア <span className="text-xl text-fes-red">{score}</span>
      </span>
    </div>
  );

  const overlay =
    phase === "playing" ? null : phase === "ready" ? (
      <div className="torn max-w-xs border-[3px] border-kraft-paper bg-kraft paper-grain p-6 text-center text-fes-ink shadow-paper">
        <p className="text-4xl" aria-hidden>
          🪀
        </p>
        <h2 className="mt-2 font-maru text-2xl font-black tracking-wider">輪投げ</h2>
        <p className="mt-3 font-maru text-sm font-bold leading-6">
          ながおしでパワーをためて、
          <br />
          はなして投げる！
          <br />
          おくの棒ほど高得点。リングは5本。
        </p>
        <button
          type="button"
          onClick={start}
          className="mt-5 rounded-full border-2 border-fes-red-deep bg-fes-red px-8 py-2.5 font-maru font-black text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5"
        >
          はじめる
        </button>
      </div>
    ) : (
      <div className="torn max-w-xs border-[3px] border-kraft-paper bg-kraft paper-grain p-6 text-center text-fes-ink shadow-paper">
        <p className="font-maru text-sm font-bold">スコア</p>
        <p className="mt-1 font-maru text-5xl font-black text-fes-red">{score}</p>
        <p className="mt-3 font-maru text-lg font-black">{rankFor(score)}</p>
        <button
          type="button"
          onClick={start}
          className="mt-5 rounded-full border-2 border-fes-red-deep bg-fes-red px-8 py-2.5 font-maru font-black text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5"
        >
          もう一回
        </button>
        <Link
          href="/"
          className="mt-3 block font-maru text-sm font-bold text-fes-ink/70 underline underline-offset-2"
        >
          ← 会場にもどる
        </Link>
      </div>
    );

  return (
    <GameShell
      title="輪 投 げ"
      tagline="ながおしでパワーをためて投げよう"
      scoreboard={scoreboard}
      overlay={overlay}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </GameShell>
  );
}
