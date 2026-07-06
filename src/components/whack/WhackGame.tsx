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
const GAME_TIME = 30;

// 穴グリッド（3×3）
const COLS = [105, 240, 375];
const ROWS = [252, 398, 544];
const GROUND_Y = 168;

// 出現アニメーション
const RISE_T = 0.14; // せり上がり
const HIDE_T = 0.16; // 引っ込み
const HIT_T = 0.45; // 叩かれ演出
const RISE_H = 86; // 全開時にせり上がる高さ
const HIT_R = 50; // 当たり判定の半径
const STUN_T = 1.0; // お邪魔を叩いた時のしびれ秒数

// 難化（経過0秒 → 30秒で線形補間）
const SPAWN_IV0 = 0.95;
const SPAWN_IV1 = 0.48;
const TANUKI_UP0 = 1.15;
const TANUKI_UP1 = 0.7;
const GOLD_UP = 0.62;
const GHOST_UP = 1.3;
const DOUBLE_SPAWN_FROM = 12; // この経過秒以降、2匹同時が出る

type Phase = "ready" | "playing" | "result";
type CharKind = "tanuki" | "gold" | "ghost";
type HoleState = "empty" | "rising" | "up" | "hiding" | "hit";

const CHAR_PTS: Record<CharKind, number> = {
  tanuki: 10,
  gold: 30,
  ghost: -20,
};

type Hole = {
  x: number;
  y: number;
  state: HoleState;
  kind: CharKind;
  t: number; // 現在stateの経過秒
  upTime: number; // "up" の持続秒
  hitK: number; // 叩かれた瞬間のせり上がり率（演出用に固定）
  seed: number;
};

type Ring = { x: number; y: number; r: number; vr: number; alpha: number };
type Star = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  r: number;
  life: number;
  maxLife: number;
  color: string;
};
type PopKind = "score" | "gold" | "bad" | "info";
type Pop = {
  x: number;
  y: number;
  text: string;
  kind: PopKind;
  life: number;
  maxLife: number;
  seed: number;
};
type Hammer = { x: number; y: number; t: number };

type Counts = { tanuki: number; gold: number; ghost: number; miss: number };

type Sim = {
  phase: Phase;
  t: number; // 経過シミュ時間
  time: number; // 残り秒
  score: number;
  combo: number;
  maxCombo: number;
  stunT: number; // >0 の間は叩けない
  counts: Counts;
  holes: Hole[];
  nextSpawnAt: number;
  rings: Ring[];
  stars: Star[];
  pops: Pop[];
  hammer: Hammer | null;
  nextId: number;
};

type Ui = {
  phase: Phase;
  score: number;
  sec: number;
  combo: number;
  mult: number;
  maxCombo: number;
  counts: Counts;
};

/* ================= シミュレーション ================= */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * clamp(k, 0, 1);
}

/** コンボ倍率: 4連続で×1.5 / 8連続で×2 */
function multFor(combo: number): number {
  return combo >= 8 ? 2 : combo >= 4 ? 1.5 : 1;
}

function makeSim(): Sim {
  const holes: Hole[] = [];
  let seed = 1;
  for (const y of ROWS) {
    for (const x of COLS) {
      holes.push({
        x,
        y,
        state: "empty",
        kind: "tanuki",
        t: 0,
        upTime: 1,
        hitK: 1,
        seed: seed++ * 19 + 5,
      });
    }
  }
  return {
    phase: "ready",
    t: 0,
    time: GAME_TIME,
    score: 0,
    combo: 0,
    maxCombo: 0,
    stunT: 0,
    counts: { tanuki: 0, gold: 0, ghost: 0, miss: 0 },
    holes,
    nextSpawnAt: 0.6,
    rings: [],
    stars: [],
    pops: [],
    hammer: null,
    nextId: 1,
  };
}

/** せり上がり率 0（穴の中）〜 1（全開） */
function riseK(h: Hole): number {
  if (h.state === "rising") return clamp(h.t / RISE_T, 0, 1);
  if (h.state === "up") return 1;
  if (h.state === "hiding") return 1 - clamp(h.t / HIDE_T, 0, 1);
  if (h.state === "hit") return h.hitK;
  return 0;
}

/** キャラ中心のY座標（k=1 で穴の上に全開） */
function charCy(h: Hole, k: number): number {
  return h.y + 30 - k * RISE_H;
}

function addPop(s: Sim, x: number, y: number, text: string, kind: PopKind): void {
  s.pops.push({
    x: clamp(x, 80, W - 80),
    y: clamp(y, 46, H - 40),
    text,
    kind,
    life: 1.1,
    maxLife: 1.1,
    seed: s.nextId++ * 11 + 3,
  });
}

function burstStars(s: Sim, x: number, y: number, n: number, color: string): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 70 + Math.random() * 140;
    s.stars.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 60,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 9,
      r: 3.5 + Math.random() * 3,
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
      color,
    });
  }
}

/** 出現キャラの抽選（経過秒で金の比率が上がる） */
function pickKind(elapsed: number): CharKind {
  const goldP = elapsed < 8 ? 0.07 : 0.12;
  const r = Math.random();
  if (r < 0.18) return "ghost";
  if (r < 0.18 + goldP) return "gold";
  return "tanuki";
}

function upTimeFor(kind: CharKind, elapsed: number): number {
  if (kind === "gold") return GOLD_UP;
  if (kind === "ghost") return GHOST_UP;
  return lerp(TANUKI_UP0, TANUKI_UP1, elapsed / GAME_TIME);
}

function spawnOne(s: Sim, elapsed: number): boolean {
  const empty = s.holes.filter((h) => h.state === "empty");
  if (empty.length === 0) return false;
  const h = empty[Math.floor(Math.random() * empty.length)];
  h.kind = pickKind(elapsed);
  h.state = "rising";
  h.t = 0;
  h.upTime = upTimeFor(h.kind, elapsed);
  return true;
}

/** pointerdown: 叩き判定 */
function whack(s: Sim, x: number, y: number): void {
  if (s.phase !== "playing") return;
  if (s.stunT > 0) return; // しびれ中は叩けない
  s.hammer = { x, y, t: 0 };
  s.rings.push({ x, y, r: 14, vr: 150, alpha: 0.45 });

  let target: Hole | null = null;
  let bestD2 = HIT_R * HIT_R;
  for (const h of s.holes) {
    if (h.state !== "up" && h.state !== "rising") continue;
    const k = riseK(h);
    if (k < 0.35) continue; // まだほぼ穴の中
    const cy = charCy(h, k);
    const d2 = (h.x - x) ** 2 + (cy - y) ** 2;
    if (d2 <= bestD2) {
      bestD2 = d2;
      target = h;
    }
  }

  if (!target) {
    sfx.whoosh(); // 空振り
    return;
  }

  const k = riseK(target);
  const cy = charCy(target, k);
  target.hitK = k;
  target.state = "hit";
  target.t = 0;

  if (target.kind === "ghost") {
    // お邪魔: 減点 + コンボリセット + しびれ
    s.score = Math.max(0, s.score + CHAR_PTS.ghost);
    s.combo = 0;
    s.stunT = STUN_T;
    s.counts.ghost++;
    addPop(s, target.x, cy - 58, "おばけ！-20 びりびり…", "bad");
    burstStars(s, target.x, cy, 8, P.redDeep);
    sfx.pop();
    sfx.miss();
    return;
  }

  // 通常/金たぬき
  s.combo++;
  s.maxCombo = Math.max(s.maxCombo, s.combo);
  const mult = multFor(s.combo);
  const pts = Math.round(CHAR_PTS[target.kind] * mult);
  s.score += pts;
  if (target.kind === "gold") {
    s.counts.gold++;
    addPop(s, target.x, cy - 58, `金たぬき！+${pts}`, "gold");
    burstStars(s, target.x, cy, 12, P.gold);
    sfx.bigHit();
  } else {
    s.counts.tanuki++;
    addPop(s, target.x, cy - 58, mult > 1 ? `+${pts} ×${mult}` : `+${pts}`, "score");
    burstStars(s, target.x, cy, 6, P.kraftLight);
    if (s.combo === 4 || s.combo === 8) sfx.bigHit();
    else sfx.hit();
  }
}

function endGame(s: Sim): void {
  if (s.phase === "result") return;
  s.phase = "result";
  sfx.finish();
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
    if (s.stunT > 0) s.stunT = Math.max(0, s.stunT - dt);
  }

  // 出現スケジューラ（ready/result 中も背景でひょっこりさせる）
  if (s.t >= s.nextSpawnAt) {
    const ok = spawnOne(s, elapsed);
    if (ok && s.phase === "playing" && elapsed >= DOUBLE_SPAWN_FROM && Math.random() < 0.3) {
      spawnOne(s, elapsed); // 終盤は2匹同時も
    }
    const iv =
      s.phase === "playing"
        ? lerp(SPAWN_IV0, SPAWN_IV1, elapsed / GAME_TIME)
        : 1.4; // 待機中はのんびり
    s.nextSpawnAt = s.t + (ok ? iv : 0.15);
  }

  // 穴のステート遷移
  for (const h of s.holes) {
    if (h.state === "empty") continue;
    h.t += dt;
    if (h.state === "rising" && h.t >= RISE_T) {
      h.state = "up";
      h.t = 0;
    } else if (h.state === "up" && h.t >= h.upTime) {
      // 叩けずに引っ込む = miss（お邪魔は見送り正解なのでノーカウント）
      if (s.phase === "playing" && h.kind !== "ghost") {
        s.counts.miss++;
        if (s.combo > 0) {
          addPop(s, h.x, h.y - RISE_H, "にげた…", "info");
        }
        s.combo = 0;
      }
      h.state = "hiding";
      h.t = 0;
    } else if (h.state === "hiding" && h.t >= HIDE_T) {
      h.state = "empty";
      h.t = 0;
    } else if (h.state === "hit" && h.t >= HIT_T) {
      h.state = "empty";
      h.t = 0;
    }
  }

  // ハンマー・波紋・星・ポップ
  if (s.hammer) {
    s.hammer.t += dt;
    if (s.hammer.t > 0.3) s.hammer = null;
  }
  s.rings = s.rings.filter((rg) => {
    rg.r += rg.vr * dt;
    rg.alpha -= dt * 1.6;
    return rg.alpha > 0;
  });
  s.stars = s.stars.filter((st) => {
    st.x += st.vx * dt;
    st.y += st.vy * dt;
    st.vy += 260 * dt;
    st.rot += st.vr * dt;
    st.life -= dt;
    return st.life > 0;
  });
  s.pops = s.pops.filter((p) => {
    p.y -= 28 * dt;
    p.life -= dt;
    return p.life > 0;
  });
}

/* ================= 描画 ================= */

/** 提灯のロープと夜空 */
function drawBackdrop(ctx: CanvasRenderingContext2D, t: number): void {
  drawNightSky(ctx, W, H, 11);

  // ロープ
  ctx.strokeStyle = "rgba(238,210,172,.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, 44);
  ctx.quadraticCurveTo(W / 2, 78, W + 10, 44);
  ctx.stroke();

  // 提灯（ゆらゆら）
  const lan: [number, number, number, string][] = [
    [92, 82, 19, P.red],
    [240, 92, 16, P.gold],
    [388, 82, 19, P.red],
  ];
  lan.forEach(([lx, ly, lr, col], i) => {
    const sway = Math.sin(t * 0.9 + i * 2.1) * 4;
    drawLantern(ctx, lx + sway, ly, lr, col);
  });
}

/** 地面（土＋草むら） */
function drawGround(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  g.addColorStop(0, "#3B2C1E");
  g.addColorStop(1, "#241A10");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + seededJitter(21, 0, 5));
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    ctx.lineTo((W / steps) * i, GROUND_Y + seededJitter(21, i, 5));
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // 地面のふち（ちぎり紙の帯）
  const edge: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    edge.push([(W / steps) * i, GROUND_Y + seededJitter(21, i, 5)]);
  }
  for (let i = steps; i >= 0; i--) {
    edge.push([(W / steps) * i, GROUND_Y + 10 + seededJitter(22, i, 4)]);
  }
  paperPoly(ctx, edge, {
    fill: P.tealDeep,
    jitter: 0,
    seed: 23,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
  });

  // 草むら（seed固定でちらつかない）
  for (let i = 0; i < 10; i++) {
    const gx = (seededJitter(31, i * 2, 0.5) + 0.5) * W;
    const gy = GROUND_Y + 30 + (seededJitter(31, i * 2 + 1, 0.5) + 0.5) * (H - GROUND_Y - 60);
    ctx.strokeStyle = "rgba(31,126,107,.5)";
    ctx.lineWidth = 2;
    for (let b = -1; b <= 1; b++) {
      ctx.beginPath();
      ctx.moveTo(gx + b * 4, gy);
      ctx.quadraticCurveTo(gx + b * 6, gy - 7, gx + b * 8, gy - 12);
      ctx.stroke();
    }
  }
}

/** たぬき/金たぬき（正面・ペーパークラフト調） */
function drawTanuki(
  ctx: CanvasRenderingContext2D,
  kind: "tanuki" | "gold",
  seed: number,
  bob: number,
  simT: number,
): void {
  const body = kind === "gold" ? P.gold : P.wood;
  const dark = kind === "gold" ? P.goldDeep : "#7C5228";
  const belly = kind === "gold" ? "#FBEBC0" : P.kraftLight;
  const mask = kind === "gold" ? P.goldDeep : "#33261F";

  // 耳
  for (const dir of [-1, 1]) {
    const ear: [number, number][] = [
      [dir * 12, -30],
      [dir * 32, -52],
      [dir * 34, -24],
    ];
    paperPoly(ctx, ear, {
      fill: dark,
      jitter: 1.6,
      seed: seed + (dir > 0 ? 3 : 4),
      shadow: "rgba(0,0,0,.3)",
      shadowDy: 3,
    });
  }

  // 体（頭と一体の丸）
  paperCircle(ctx, 0, bob, 38, {
    fill: body,
    edge: "rgba(251,240,218,.45)",
    edgeWidth: 1.6,
    jitter: 2.6,
    seed,
    shadow: "rgba(0,0,0,.35)",
    shadowDy: 5,
  });

  // おなか
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(0, bob + 17, 21, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // 目のまわりの隈取り
  ctx.fillStyle = mask;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * 14, bob - 8, 12, 8.5, dir * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // 目・鼻・口もと
  for (const dir of [-1, 1]) {
    ctx.fillStyle = P.paper;
    ctx.beginPath();
    ctx.arc(dir * 13, bob - 8, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.arc(dir * 12, bob - 7.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = P.paper;
  ctx.beginPath();
  ctx.ellipse(0, bob + 4, 9, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.ink;
  ctx.beginPath();
  ctx.arc(0, bob + 1, 3.4, 0, Math.PI * 2);
  ctx.fill();

  // 金たぬきのきらきら（phase駆動でちらつきなし）
  if (kind === "gold") {
    for (let i = 0; i < 3; i++) {
      const ph = simT * 4 + i * 2.1 + seed;
      const tw = 0.5 + 0.5 * Math.sin(ph);
      const sx = Math.sin(ph * 0.7) * 34;
      const sy = bob - 26 + Math.cos(ph * 0.9) * 16;
      const r = 2 + tw * 2.4;
      ctx.globalAlpha = 0.35 + tw * 0.55;
      ctx.fillStyle = "#FFE9A8";
      ctx.beginPath();
      ctx.moveTo(sx, sy - r * 1.8);
      ctx.lineTo(sx + r * 0.5, sy - r * 0.5);
      ctx.lineTo(sx + r * 1.8, sy);
      ctx.lineTo(sx + r * 0.5, sy + r * 0.5);
      ctx.lineTo(sx, sy + r * 1.8);
      ctx.lineTo(sx - r * 0.5, sy + r * 0.5);
      ctx.lineTo(sx - r * 1.8, sy);
      ctx.lineTo(sx - r * 0.5, sy - r * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** 提灯お化け（お邪魔。叩いちゃダメ） */
function drawGhost(
  ctx: CanvasRenderingContext2D,
  seed: number,
  bob: number,
  simT: number,
): void {
  // ぼんやり光る
  const g = ctx.createRadialGradient(0, bob, 8, 0, bob, 62);
  g.addColorStop(0, "rgba(255,190,110,.3)");
  g.addColorStop(1, "rgba(255,190,110,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, bob, 62, 0, Math.PI * 2);
  ctx.fill();

  // 提灯ボディ
  ctx.save();
  ctx.translate(0, bob);
  ctx.scale(1, 1.16);
  paperCircle(ctx, 0, 0, 34, {
    fill: P.red,
    edge: "rgba(251,240,218,.4)",
    edgeWidth: 1.6,
    jitter: 2.4,
    seed,
    shadow: "rgba(0,0,0,.35)",
    shadowDy: 4,
  });
  ctx.restore();

  // 提灯の骨
  ctx.strokeStyle = "rgba(147,34,26,.55)";
  ctx.lineWidth = 1.6;
  for (const ry of [-16, 0, 16]) {
    ctx.beginPath();
    ctx.ellipse(0, bob + ry, 32 * Math.sqrt(1 - (ry / 40) ** 2), 6, 0, 0, Math.PI, false);
    ctx.stroke();
  }

  // 蓋
  ctx.fillStyle = P.ink;
  ctx.fillRect(-14, bob - 46, 28, 7);
  ctx.fillRect(-12, bob + 39, 24, 6);

  // ひとつ目（きょろきょろ）
  const look = Math.sin(simT * 2.2 + seed) * 3;
  ctx.fillStyle = P.paper;
  ctx.beginPath();
  ctx.arc(0, bob - 10, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.ink;
  ctx.beginPath();
  ctx.arc(look, bob - 9, 5, 0, Math.PI * 2);
  ctx.fill();

  // 口とベロ
  ctx.fillStyle = P.redDeep;
  ctx.beginPath();
  ctx.ellipse(0, bob + 14, 13, 8, 0, 0, Math.PI, false);
  ctx.fill();
  paperPoly(
    ctx,
    [
      [-6, bob + 16],
      [6, bob + 16],
      [5, bob + 36],
      [-3, bob + 34],
    ],
    {
      fill: "#E08D80",
      jitter: 1.2,
      seed: seed + 9,
      shadow: "rgba(0,0,0,.25)",
      shadowDy: 2,
    },
  );
}

/** 穴 + せり上がるキャラ（クリップで穴から出る見た目に） */
function drawHole(ctx: CanvasRenderingContext2D, h: Hole, s: Sim): void {
  // 土のマウンド
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.scale(1, 0.4);
  paperCircle(ctx, 0, 0, 62, {
    fill: "#54402B",
    edge: "rgba(238,210,172,.25)",
    edgeWidth: 1.6,
    jitter: 3,
    seed: h.seed,
    shadow: "rgba(0,0,0,.35)",
    shadowDy: 8,
  });
  ctx.restore();

  // 穴（暗い楕円）
  ctx.fillStyle = P.night950;
  ctx.beginPath();
  ctx.ellipse(h.x, h.y, 48, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // キャラ（穴の上端でクリップ）
  const k = riseK(h);
  if (h.state !== "empty" && k > 0.01) {
    const cy = charCy(h, k);
    ctx.save();
    ctx.beginPath();
    ctx.rect(h.x - 80, h.y - 190, 160, 196);
    ctx.clip();
    ctx.translate(h.x, cy);
    if (h.state === "hit") {
      // ぺしゃんこ演出: つぶれて沈みつつ消える
      const p = clamp(h.t / HIT_T, 0, 1);
      ctx.globalAlpha = 1 - p;
      ctx.translate(0, p * 26);
      ctx.rotate(seededJitter(h.seed, 1, 0.14));
      ctx.scale(1 + p * 0.35, 1 - p * 0.55);
    }
    // 原点 = キャラ中心 (h.x, cy)。bob は up 中だけの上下ゆれ
    const bob = h.state === "up" ? Math.sin(s.t * 9 + h.seed) * 2 : 0;
    if (h.kind === "ghost") drawGhost(ctx, h.seed, bob, s.t);
    else drawTanuki(ctx, h.kind, h.seed, bob, s.t);
    ctx.restore();
  }

  // 穴の手前のふち（キャラより手前に重ねて「中から出てる」見た目に）
  ctx.strokeStyle = "#6B5236";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(h.x, h.y + 1, 48, 18, 0, 0.15, Math.PI - 0.15, false);
  ctx.stroke();
}

function drawStarShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.8);
  ctx.lineTo(x + r * 0.55, y - r * 0.55);
  ctx.lineTo(x + r * 1.8, y);
  ctx.lineTo(x + r * 0.55, y + r * 0.55);
  ctx.lineTo(x, y + r * 1.8);
  ctx.lineTo(x - r * 0.55, y + r * 0.55);
  ctx.lineTo(x - r * 1.8, y);
  ctx.lineTo(x - r * 0.55, y - r * 0.55);
  ctx.closePath();
}

function drawStars(ctx: CanvasRenderingContext2D, s: Sim): void {
  for (const st of s.stars) {
    ctx.save();
    ctx.globalAlpha = clamp(st.life / 0.4, 0, 1);
    ctx.translate(st.x, st.y);
    ctx.rotate(st.rot);
    ctx.fillStyle = st.color;
    drawStarShape(ctx, 0, 0, st.r);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawRings(ctx: CanvasRenderingContext2D, s: Sim): void {
  for (const rg of s.rings) {
    ctx.globalAlpha = Math.max(0, rg.alpha);
    ctx.strokeStyle = "rgba(251,240,218,.9)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** 木づち（タップ位置に振り下ろすアニメ） */
function drawHammer(ctx: CanvasRenderingContext2D, hm: Hammer): void {
  const p = clamp(hm.t / 0.3, 0, 1);
  const swing = p < 0.35 ? lerp(-1.0, 0.08, p / 0.35) : 0.08;
  const alpha = p > 0.55 ? 1 - (p - 0.55) / 0.45 : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(hm.x + 8, hm.y - 6);
  ctx.rotate(swing);
  // 柄（右上へ）
  paperRect(ctx, 14, -66, 11, 60, {
    fill: P.wood,
    edge: P.woodDeep,
    edgeWidth: 1.5,
    jitter: 1.4,
    seed: 61,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
  });
  // 頭
  paperRect(ctx, -12, -30, 44, 28, {
    fill: P.kraftDeep,
    edge: P.kraftLight,
    edgeWidth: 2,
    jitter: 1.8,
    seed: 62,
    shadow: "rgba(0,0,0,.35)",
    shadowDy: 4,
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** しびれ中の演出（画面が暗くなり星がまわる） */
function drawStun(ctx: CanvasRenderingContext2D, s: Sim): void {
  if (s.stunT <= 0) return;
  const p = s.stunT / STUN_T;
  ctx.fillStyle = `rgba(3,18,42,${0.32 * p})`;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 3; i++) {
    const a = s.t * 6 + (i * Math.PI * 2) / 3;
    const sx = W / 2 + Math.cos(a) * 52;
    const sy = 120 + Math.sin(a) * 14;
    ctx.globalAlpha = 0.75 * p;
    ctx.fillStyle = P.gold;
    drawStarShape(ctx, sx, sy, 5);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 紙タグポップ（+10 ×1.5 / 金たぬき！ / おばけ！等） */
function drawPops(ctx: CanvasRenderingContext2D, s: Sim): void {
  const style: Record<PopKind, { fill: string; edge: string; text: string }> = {
    score: { fill: P.kraftLight, edge: P.teal, text: P.tealDeep },
    gold: { fill: "#FFF3CD", edge: P.goldDeep, text: P.goldDeep },
    bad: { fill: P.kraftLight, edge: P.red, text: P.redDeep },
    info: { fill: P.kraftLight, edge: P.indigo, text: P.indigo },
  };
  for (const p of s.pops) {
    const born = p.maxLife - p.life;
    const appear = Math.min(1, born / 0.12);
    const alpha = clamp(p.life / 0.35, 0, 1) * appear;
    const st = style[p.kind];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(seededJitter(p.seed, 0, 0.07));
    ctx.scale(0.75 + 0.25 * appear, 0.75 + 0.25 * appear);
    ctx.globalAlpha = alpha;
    ctx.font =
      "900 16px 'Zen Maru Gothic','Hiragino Maru Gothic ProN',sans-serif";
    const w = ctx.measureText(p.text).width;
    paperRect(ctx, -w / 2 - 10, -14, w + 20, 28, {
      fill: st.fill,
      edge: st.edge,
      edgeWidth: 2,
      jitter: 2,
      seed: p.seed,
      shadow: "rgba(0,0,0,.35)",
      shadowDy: 3,
    });
    ctx.fillStyle = st.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.text, 0, 1);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function render(ctx: CanvasRenderingContext2D, s: Sim): void {
  drawBackdrop(ctx, s.t);
  drawGround(ctx);
  // 上の段から描く（下の段のキャラが手前に重なる）
  for (const h of s.holes) drawHole(ctx, h, s);
  drawRings(ctx, s);
  drawStars(ctx, s);
  if (s.hammer) drawHammer(ctx, s.hammer);
  drawStun(ctx, s);
  drawPops(ctx, s);
}

/* ================= コンポーネント ================= */

function rankTitle(score: number): string {
  if (score >= 500) return "たぬき叩き名人！";
  if (score >= 300) return "いい感じ！";
  if (score >= 120) return "もうちょい！";
  return "また挑戦してね";
}

const CARD_CLASS =
  "torn border-[3px] border-kraft-paper bg-kraft paper-grain shadow-paper text-fes-ink p-6 text-center max-w-xs";
const BTN_CLASS =
  "rounded-full bg-fes-red border-2 border-fes-red-deep text-kraft-paper font-maru font-black px-8 py-2.5 shadow-paper-sm hover:-translate-y-0.5 transition-transform";

export default function WhackGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<Sim | null>(null);
  const uiKeyRef = useRef("");
  const [ui, setUi] = useState<Ui>({
    phase: "ready",
    score: 0,
    sec: GAME_TIME,
    combo: 0,
    mult: 1,
    maxCombo: 0,
    counts: { tanuki: 0, gold: 0, ghost: 0, miss: 0 },
  });

  const pushUi = useCallback(() => {
    const s = simRef.current;
    if (!s) return;
    const next: Ui = {
      phase: s.phase,
      score: s.score,
      sec: Math.max(0, Math.ceil(s.time)),
      combo: s.combo,
      mult: multFor(s.combo),
      maxCombo: s.maxCombo,
      counts: { ...s.counts },
    };
    const c = next.counts;
    const key = `${next.phase}|${next.score}|${next.sec}|${next.combo}|${next.maxCombo}|${c.tanuki},${c.gold},${c.ghost},${c.miss}`;
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
      if (!s) return;
      const [x, y] = toLocal(e);
      whack(s, x, y);
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

  const scoreboard = (
    <div className="flex items-center justify-between font-maru text-sm font-black">
      <span>⏱ のこり {ui.sec}</span>
      <span>
        コンボ {ui.combo}
        {ui.mult > 1 ? `（×${ui.mult}）` : ""}
      </span>
      <span>スコア {ui.score}</span>
    </div>
  );

  const overlay =
    ui.phase === "ready" ? (
      <div className={CARD_CLASS}>
        <h2 className="font-maru font-black text-2xl text-fes-indigo">
          🦝 たぬき叩き
        </h2>
        <p className="mt-3 font-maru text-sm font-bold">
          穴から出てくるたぬきをタップで叩こう！
        </p>
        <p className="mt-1.5 font-maru text-xs font-bold">30秒勝負</p>
        <ul className="mt-2 space-y-0.5 text-left font-maru text-xs font-bold text-fes-ink/80">
          <li>・たぬき10点 / ✨金たぬき30点（すぐ隠れる）</li>
          <li>・連続ヒットで倍率（4連続×1.5 / 8連続×2）</li>
          <li>・👻 ちょうちんお化けを叩くと −20点＆しびれる</li>
          <li>・にげられるとコンボが切れる</li>
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
          🦝×{ui.counts.tanuki}　✨×{ui.counts.gold}　👻×{ui.counts.ghost}
          　にげられ×{ui.counts.miss}
        </p>
        <p className="mt-1 font-maru text-xs font-bold text-fes-ink/75">
          さいだいコンボ {ui.maxCombo}
        </p>
        <div className="mt-4 space-y-3 text-left">
          <ScoreSubmit game="whack" score={ui.score} />
          <Leaderboard game="whack" />
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
      title="た ぬ き 叩 き"
      tagline="おばけは叩いちゃダメ！"
      scoreboard={scoreboard}
      overlay={overlay}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        aria-label="たぬき叩きのゲーム画面"
      />
    </GameShell>
  );
}
