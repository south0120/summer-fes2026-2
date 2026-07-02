"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import GameShell from "@/components/game/GameShell";
import { ensureAudio, sfx } from "@/components/game/audio";
import { P } from "@/components/game/palette";
import {
  drawLantern,
  drawNightSky,
  paperCircle,
  paperPoly,
  paperRect,
} from "@/components/game/paper";

/* ============================== 定数 ============================== */

const W = 480;
const H = 640;
const GAME_SECONDS = 30;
const COOLDOWN = 0.35; // 連射クールダウン(s)
const RESPAWN_DELAY = 1.2; // 倒してからrespawnまで(s)
const SHELF_YS = [300, 440] as const; // 棚の天板y
const SLOT_XS = [96, 192, 288, 384] as const; // 棚の4スロットx
const STAR_Y = 370; // 星が流れる高さ（棚の間）
const BALLOON_COLORS = [P.red, P.teal, P.gold] as const;
const POINTS = { balloon: 10, can: 20, star: 30 } as const;

/* ============================== 型 ============================== */

type Phase = "ready" | "playing" | "result";
type SlotKind = "balloon" | "can";

type SlotTarget = {
  kind: SlotKind;
  shelf: number; // 0 | 1
  slot: number; // 0..3
  color: string; // 風船の色
  seed: number; // 紙ジッターのseed（respawnごとに変わる）
  phase: number; // 揺れアニメの位相
  alive: boolean;
  respawnAt: number; // aliveでない時、この時刻(秒)に復活
};

type Star = {
  alive: boolean;
  x: number;
  vx: number;
  seed: number;
  respawnAt: number;
};

type Confetti = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  age: number;
  ttl: number;
};

type Hole = { x: number; y: number; until: number };

/* ============================== 純関数ヘルパー ============================== */

let genSeed = 1;

function makeSlotTarget(shelf: number, slot: number): SlotTarget {
  genSeed += 1;
  const kind: SlotKind = Math.random() < 0.55 ? "balloon" : "can";
  return {
    kind,
    shelf,
    slot,
    color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
    seed: shelf * 131 + slot * 17 + genSeed * 7.3,
    phase: Math.random() * Math.PI * 2,
    alive: true,
    respawnAt: 0,
  };
}

function makeTargets(): SlotTarget[] {
  const out: SlotTarget[] = [];
  for (let shelf = 0; shelf < SHELF_YS.length; shelf++) {
    for (let slot = 0; slot < SLOT_XS.length; slot++) {
      out.push(makeSlotTarget(shelf, slot));
    }
  }
  return out;
}

/** 的の現在の中心座標（描画と当たり判定で共有） */
function slotCenter(t: SlotTarget, now: number): { x: number; y: number } {
  const baseX = SLOT_XS[t.slot];
  const shelfY = SHELF_YS[t.shelf];
  if (t.kind === "balloon") {
    return {
      x: baseX + Math.sin(now * 1.4 + t.phase) * 7,
      y: shelfY - 58 + Math.sin(now * 2.2 + t.phase) * 3,
    };
  }
  // 缶: たまに小刻みに揺れる
  const cycle = (now + t.phase * 1.7) % 4.2;
  const jiggle = cycle < 0.3 ? Math.sin(now * 45) * 1.5 : 0;
  return { x: baseX + jiggle, y: shelfY - 20 };
}

function starPos(star: Star, now: number): { x: number; y: number } {
  return { x: star.x, y: STAR_Y + Math.sin(now * 3 + star.seed) * 8 };
}

/** 五芒星の頂点列 */
function starPts(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  rot: number,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let k = 0; k < 10; k++) {
    const a = rot + (k / 10) * Math.PI * 2 - Math.PI / 2;
    const r = k % 2 === 0 ? rOuter : rInner;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function titleFor(score: number): string {
  if (score >= 200) return "射的マスター！";
  if (score >= 120) return "いい腕前！";
  if (score >= 50) return "もうちょい！";
  return "また挑戦してね";
}

function burst(list: Confetti[], x: number, y: number, colors: string[]): void {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 160;
    list.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 70,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 12,
      size: 3 + Math.random() * 4.5,
      color: colors[i % colors.length],
      age: 0,
      ttl: 0.7 + Math.random() * 0.4,
    });
  }
}

/* ============================== 描画 ============================== */

/** 屋台テントの紅白ストライプ庇（下端スカラップ） */
function drawAwning(ctx: CanvasRenderingContext2D): void {
  // 紙の下地（全幅・落ち影つき）
  paperRect(ctx, -8, -14, W + 16, 62, {
    fill: P.paper,
    seed: 91,
    jitter: 2,
    shadowDy: 5,
  });
  // 赤ストライプを貼る（コラージュ風・影なし）
  for (let i = 0; i < 10; i += 2) {
    paperRect(ctx, i * 48 - 2, -12, 50, 58, {
      fill: P.red,
      seed: 92 + i,
      jitter: 2,
      shadow: "",
    });
  }
  // 裾のスカラップ（各ストライプ色に合わせた半円）
  for (let i = 0; i < 10; i++) {
    paperCircle(ctx, i * 48 + 24, 45, 13, {
      fill: i % 2 === 0 ? P.red : P.paper,
      seed: 120 + i,
      jitter: 1.4,
      shadowDy: 3,
    });
  }
}

function drawLanterns(ctx: CanvasRenderingContext2D, now: number): void {
  const sway1 = Math.sin(now * 0.9) * 4;
  const sway2 = Math.sin(now * 0.9 + 1.7) * 4;
  // 吊りひも
  ctx.strokeStyle = "rgba(251,240,218,.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(74, 54);
  ctx.lineTo(74 + sway1, 92);
  ctx.moveTo(406, 54);
  ctx.lineTo(406 + sway2, 92);
  ctx.stroke();
  // 本体（translateで揺らし、drawLantern内部のseedは固定に保つ）
  ctx.save();
  ctx.translate(sway1, 0);
  drawLantern(ctx, 74, 116, 21);
  ctx.restore();
  ctx.save();
  ctx.translate(sway2, 0);
  drawLantern(ctx, 406, 116, 21, P.gold);
  ctx.restore();
}

function drawShelves(ctx: CanvasRenderingContext2D): void {
  for (const y of SHELF_YS) {
    // 前板（支え）
    paperRect(ctx, 52, y + 12, 376, 26, {
      fill: P.woodDeep,
      seed: 300 + y,
      jitter: 2.5,
      shadowDy: 5,
    });
    // 天板
    paperRect(ctx, 36, y, 408, 16, {
      fill: P.wood,
      seed: 310 + y,
      jitter: 2.5,
      shadowDy: 4,
    });
  }
}

function drawBalloon(
  ctx: CanvasRenderingContext2D,
  t: SlotTarget,
  now: number,
): void {
  const c = slotCenter(t, now);
  const anchorX = SLOT_XS[t.slot];
  const shelfY = SHELF_YS[t.shelf];
  // ひも
  ctx.strokeStyle = "rgba(251,240,218,.55)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y + 26);
  ctx.quadraticCurveTo(anchorX + (c.x - anchorX) * 0.4, (c.y + shelfY) / 2 + 8, anchorX, shelfY);
  ctx.stroke();
  // 結び目
  paperPoly(
    ctx,
    [
      [c.x - 5, c.y + 28],
      [c.x + 5, c.y + 28],
      [c.x, c.y + 20],
    ],
    { fill: t.color, seed: t.seed + 1, jitter: 0.8, shadow: "" },
  );
  // 本体
  paperCircle(ctx, c.x, c.y, 24, {
    fill: t.color,
    seed: t.seed,
    jitter: 1.6,
    shadowDy: 4,
  });
  // ハイライト
  ctx.fillStyle = "rgba(251,240,218,.45)";
  ctx.beginPath();
  ctx.ellipse(c.x - 8, c.y - 8, 6, 9, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawCan(
  ctx: CanvasRenderingContext2D,
  t: SlotTarget,
  now: number,
): void {
  const c = slotCenter(t, now);
  // 本体 32x40
  paperRect(ctx, c.x - 16, c.y - 20, 32, 40, {
    fill: P.teal,
    seed: t.seed,
    jitter: 1.8,
    shadowDy: 4,
  });
  // 上蓋
  paperRect(ctx, c.x - 15, c.y - 21, 30, 5, {
    fill: P.tealDeep,
    seed: t.seed + 3,
    jitter: 1,
    shadow: "",
  });
  // 紙ラベル
  paperRect(ctx, c.x - 16, c.y - 7, 32, 14, {
    fill: P.paper,
    seed: t.seed + 1,
    jitter: 1.2,
    shadow: "",
  });
  // ラベルの丸マーク
  paperCircle(ctx, c.x, c.y, 4.2, {
    fill: P.red,
    seed: t.seed + 2,
    jitter: 0.6,
    shadow: "",
  });
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  seed: number,
  now: number,
): void {
  paperPoly(ctx, starPts(pos.x, pos.y, 17, 7.5, now * 2.4), {
    fill: P.gold,
    seed: 400 + seed,
    jitter: 1,
    edge: P.paper,
    edgeWidth: 1.8,
    shadowDy: 3,
  });
  paperCircle(ctx, pos.x, pos.y, 3.5, {
    fill: P.goldDeep,
    seed: 401 + seed,
    jitter: 0.5,
    shadow: "",
  });
}

function drawConfetti(ctx: CanvasRenderingContext2D, list: Confetti[]): void {
  for (const c of list) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - c.age / c.ttl);
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.7);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawHoles(ctx: CanvasRenderingContext2D, list: Hole[]): void {
  for (const hole of list) {
    ctx.fillStyle = "rgba(70,70,72,.75)";
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(251,240,218,.35)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

/** 照準（紙風の丸 + 十字 + 中心の赤丸）。scaleでしぼむ演出 */
function drawReticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "rgba(251,240,218,.95)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-28, 0);
  ctx.lineTo(-10, 0);
  ctx.moveTo(10, 0);
  ctx.lineTo(28, 0);
  ctx.moveTo(0, -28);
  ctx.lineTo(0, -10);
  ctx.moveTo(0, 10);
  ctx.lineTo(0, 28);
  ctx.stroke();
  ctx.fillStyle = P.red;
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ============================== コンポーネント ============================== */

export default function ShootingGame() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(GAME_SECONDS);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("ready");
  const scoreRef = useRef(0);
  const secondsShownRef = useRef(GAME_SECONDS);
  const endAtRef = useRef(0);
  const lastShotRef = useRef(-1e9);
  const aimRef = useRef({ x: W / 2, y: H * 0.6, visible: false });
  const targetsRef = useRef<SlotTarget[]>([]);
  const starRef = useRef<Star>({
    alive: false,
    x: -40,
    vx: 170,
    seed: 3,
    respawnAt: 0,
  });
  const confettiRef = useRef<Confetti[]>([]);
  const holesRef = useRef<Hole[]>([]);

  const startGame = () => {
    ensureAudio();
    sfx.tap();
    const now = performance.now() / 1000;
    endAtRef.current = now + GAME_SECONDS;
    scoreRef.current = 0;
    setScore(0);
    secondsShownRef.current = GAME_SECONDS;
    setSecondsLeft(GAME_SECONDS);
    lastShotRef.current = -1e9;
    confettiRef.current = [];
    holesRef.current = [];
    targetsRef.current = makeTargets();
    starRef.current = {
      alive: false,
      x: -30,
      vx: 170,
      seed: Math.floor(Math.random() * 100),
      respawnAt: now + 1.6,
    };
    phaseRef.current = "playing";
    setPhase("playing");
  };

  /* canvasサイズ追従（devicePixelRatio対応） */
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = canvas?.parentElement;
    if (!canvas || !stage) return;
    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  /* メインループ（rAF 1本） + 入力 */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (targetsRef.current.length === 0) targetsRef.current = makeTargets();

    const addScore = (pts: number) => {
      scoreRef.current += pts;
      setScore(scoreRef.current);
    };

    const toLogical = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * W,
        y: ((e.clientY - rect.top) / rect.height) * H,
      };
    };

    const shoot = (x: number, y: number) => {
      if (phaseRef.current !== "playing") return;
      const now = performance.now() / 1000;
      if (now - lastShotRef.current < COOLDOWN) return;
      lastShotRef.current = now;
      sfx.whoosh();

      type Hit = { dist: number; apply: () => void };
      let best: Hit | null = null;
      const consider = (dist: number, limit: number, apply: () => void) => {
        if (dist <= limit && (best === null || dist < best.dist)) {
          best = { dist, apply };
        }
      };

      const star = starRef.current;
      if (star.alive) {
        const sp = starPos(star, now);
        consider(Math.hypot(x - sp.x, y - sp.y), 24, () => {
          star.alive = false;
          star.respawnAt = now + RESPAWN_DELAY;
          addScore(POINTS.star);
          burst(confettiRef.current, sp.x, sp.y, [P.gold, P.paper, P.goldDeep]);
          sfx.bigHit();
        });
      }
      for (const t of targetsRef.current) {
        if (!t.alive) continue;
        const c = slotCenter(t, now);
        consider(
          Math.hypot(x - c.x, y - c.y),
          t.kind === "balloon" ? 27 : 26,
          () => {
            t.alive = false;
            t.respawnAt = now + RESPAWN_DELAY;
            addScore(POINTS[t.kind]);
            if (t.kind === "balloon") {
              burst(confettiRef.current, c.x, c.y, [t.color, P.paper, P.kraftLight]);
              sfx.pop();
            } else {
              burst(confettiRef.current, c.x, c.y, [P.teal, P.paper, P.tealDeep]);
              sfx.hit();
            }
          },
        );
      }
      if (best !== null) {
        (best as Hit).apply();
      } else {
        // ミス: 小さな紙の穴のみ（連射で耳障りなので無音）
        holesRef.current.push({ x, y, until: now + 0.5 });
      }
    };

    const onMove = (e: PointerEvent) => {
      const p = toLogical(e);
      aimRef.current = { x: p.x, y: p.y, visible: true };
    };
    const onDown = (e: PointerEvent) => {
      const p = toLogical(e);
      aimRef.current = { x: p.x, y: p.y, visible: true };
      shoot(p.x, p.y);
    };
    const onLeave = () => {
      aimRef.current.visible = false;
    };

    const update = (now: number, dt: number) => {
      // 紙吹雪・穴はフェーズに関わらず消化
      const conf = confettiRef.current;
      for (let i = conf.length - 1; i >= 0; i--) {
        const c = conf[i];
        c.age += dt;
        if (c.age >= c.ttl) {
          conf.splice(i, 1);
          continue;
        }
        c.vy += 480 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += c.vr * dt;
      }
      const holes = holesRef.current;
      for (let i = holes.length - 1; i >= 0; i--) {
        if (now >= holes[i].until) holes.splice(i, 1);
      }

      if (phaseRef.current !== "playing") return;

      // タイマー
      const remain = endAtRef.current - now;
      const shown = Math.max(0, Math.ceil(remain));
      if (shown !== secondsShownRef.current) {
        secondsShownRef.current = shown;
        setSecondsLeft(shown);
        if (shown <= 5 && shown >= 1) sfx.tick();
      }
      if (remain <= 0) {
        phaseRef.current = "result";
        setPhase("result");
        sfx.finish();
        return;
      }

      // 星（棚の間を左右に流れる・最大1個）
      const star = starRef.current;
      if (star.alive) {
        star.x += star.vx * dt;
        if (star.vx > 0 && star.x > W + 40) star.x = -40;
        if (star.vx < 0 && star.x < -40) star.x = W + 40;
      } else if (now >= star.respawnAt) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        star.alive = true;
        star.vx = dir * (150 + Math.random() * 50);
        star.x = dir > 0 ? -30 : W + 30;
        star.seed = Math.floor(Math.random() * 1000);
      }

      // 棚スロットのrespawn
      const targets = targetsRef.current;
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (!t.alive && now >= t.respawnAt) {
          targets[i] = makeSlotTarget(t.shelf, t.slot);
        }
      }
    };

    const render = (now: number) => {
      const cw = canvas.width;
      const ch = canvas.height;
      if (cw === 0 || ch === 0) return;
      ctx.setTransform(cw / W, 0, 0, ch / H, 0, 0);
      ctx.clearRect(0, 0, W, H);

      drawNightSky(ctx, W, H, 11);
      drawAwning(ctx);
      drawLanterns(ctx, now);
      drawShelves(ctx);

      for (const t of targetsRef.current) {
        if (!t.alive) continue;
        if (t.kind === "balloon") drawBalloon(ctx, t, now);
        else drawCan(ctx, t, now);
      }
      const star = starRef.current;
      if (star.alive) drawStar(ctx, starPos(star, now), star.seed, now);

      drawConfetti(ctx, confettiRef.current);
      drawHoles(ctx, holesRef.current);

      if (phaseRef.current === "playing" && aimRef.current.visible) {
        const cd = Math.min(1, (now - lastShotRef.current) / COOLDOWN);
        drawReticle(ctx, aimRef.current.x, aimRef.current.y, 0.55 + 0.45 * cd);
      }
    };

    let raf = 0;
    let last = performance.now() / 1000;
    const frame = () => {
      const now = performance.now() / 1000;
      const dt = Math.min(0.05, now - last);
      last = now;
      update(now, dt);
      render(now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  /* オーバーレイ */
  let overlay: ReactNode = null;
  if (phase === "ready") {
    overlay = (
      <div className="torn max-w-xs border-[3px] border-kraft-paper bg-kraft paper-grain p-6 text-center text-fes-ink shadow-paper">
        <h2 className="font-maru text-2xl font-black text-fes-indigo">🎯 射的</h2>
        <p className="mt-3 font-maru text-sm font-bold">
          ねらってタップ！ 30秒でどれだけ倒せる？
        </p>
        <p className="mt-2 font-maru text-xs font-bold text-fes-ink/70">
          風船10点・缶20点・星30点
        </p>
        <button
          type="button"
          onClick={startGame}
          className="mt-5 rounded-full border-2 border-fes-red-deep bg-fes-red px-8 py-2.5 font-maru font-black text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5"
        >
          はじめる
        </button>
      </div>
    );
  } else if (phase === "result") {
    overlay = (
      <div className="torn max-w-xs border-[3px] border-kraft-paper bg-kraft paper-grain p-6 text-center text-fes-ink shadow-paper">
        <p className="font-maru text-sm font-bold">スコア</p>
        <p className="font-maru text-5xl font-black text-fes-red">
          {score}
          <span className="text-xl">点</span>
        </p>
        <p className="mt-2 font-maru text-2xl font-black text-fes-indigo">
          {titleFor(score)}
        </p>
        <button
          type="button"
          onClick={startGame}
          className="mt-5 rounded-full border-2 border-fes-red-deep bg-fes-red px-8 py-2.5 font-maru font-black text-kraft-paper shadow-paper-sm transition-transform hover:-translate-y-0.5"
        >
          もう一回
        </button>
        <Link
          href="/"
          className="mt-4 block font-maru text-xs font-bold text-fes-ink/70 underline underline-offset-2"
        >
          ← 会場にもどる
        </Link>
      </div>
    );
  }

  return (
    <GameShell
      title="射 的"
      tagline="ねらってタップ！"
      scoreboard={
        <div className="flex items-center justify-between font-maru text-sm font-black">
          <span>⏱ のこり{secondsLeft}秒</span>
          <span>スコア {score}</span>
        </div>
      }
      overlay={overlay}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </GameShell>
  );
}
