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
  paperRect,
  seededJitter,
} from "@/components/game/paper";
import { ensureAudio, sfx } from "@/components/game/audio";

/* ================= 定数 ================= */

const W = 480;
const H = 640;
const GAME_TIME = 30;
// ザラメの釜（この中でぐるぐる回す）
const KETTLE = { x: W / 2, y: 352, r: 188 };
const SPIN_MIN_R = 46; // これより中心に近いと「回転」とみなさない
const MAX_MASS_SOFT = 1.7; // これ以上は巻きすぎ（効率ダウン + 固まりやすい）

type Phase = "ready" | "playing" | "result";

// 綿あめのパステル（palette P の紙色をベースにした綿色）
const COTTON = {
  pink: "#F5C1D0",
  pinkDeep: "#E999B4",
  white: P.paper,
  blue: "#BFE0E6",
} as const;
const PUFF_COLORS = [COTTON.white, COTTON.pink, COTTON.blue, COTTON.pink];

// 完成サイズ段階（mass = 巻いた綿量）
const TIERS = [
  { mass: 0.3, name: "ミニ", bonus: 0 },
  { mass: 0.7, name: "ふつう", bonus: 25 },
  { mass: 1.1, name: "大玉", bonus: 60 },
  { mass: 1.5, name: "特大", bonus: 130 },
] as const;

function tierOf(mass: number): number {
  let t = -1;
  for (let i = 0; i < TIERS.length; i++) if (mass >= TIERS[i].mass) t = i;
  return t;
}

type Pop = {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  seed: number;
};
type Scrap = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  color: string;
};
// ザラメの粒: 釜の中から綿あめへ吸い込まれていく
type Mote = {
  sx: number;
  sy: number;
  life: number;
  maxLife: number;
  r: number;
  color: string;
};

type Sim = {
  phase: Phase;
  t: number;
  time: number;
  score: number;
  sticks: number; // 完成した本数
  done: number[]; // 完成した各本の tier
  // いま育てている1本
  mass: number; // 巻いた綿量
  fluff: number; // ふわふわ度 0..1
  heat: number; // 回しすぎメーター 0..1（1で固まる）
  momentum: number; // 同方向に回し続けた勢い 0..1
  wind: number; // 綿の見た目の回転角
  lastTier: number;
  candy: { x: number; y: number };
  // 回転検出
  spin: {
    has: boolean; // prevAng が有効か
    prevAng: number;
    vel: number; // 平滑化した角速度 rad/s
    dir: number; // 現在の回転方向 (+1/-1/0)
    revAcc: number; // 逆方向に動いた累積角（反転判定用）
    rS: number; // 平滑化した回転半径（きれいな円判定用）
    turnAcc: number; // 1周カウント用の累積角
  };
  ptr: { x: number; y: number; on: boolean; down: boolean };
  motes: Mote[];
  pops: Pop[];
  scraps: Scrap[];
};

type Ui = {
  phase: Phase;
  score: number;
  sec: number;
  sticks: number;
  tier: number; // 現在の綿の tier（-1 = まだ完成できない）
  counts: [number, number, number, number];
};

/* ================= シミュレーション ================= */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function makeSim(): Sim {
  return {
    phase: "ready",
    t: 0,
    time: GAME_TIME,
    score: 0,
    sticks: 0,
    done: [],
    mass: 0,
    fluff: 1,
    heat: 0,
    momentum: 0,
    wind: 0,
    lastTier: -1,
    candy: { x: KETTLE.x, y: KETTLE.y },
    spin: { has: false, prevAng: 0, vel: 0, dir: 0, revAcc: 0, rS: 120, turnAcc: 0 },
    ptr: { x: KETTLE.x, y: KETTLE.y, on: false, down: false },
    motes: [],
    pops: [],
    scraps: [],
  };
}

function candyRadius(mass: number): number {
  return Math.min(120, 16 + Math.sqrt(Math.max(0, mass)) * 76);
}

function addPop(s: Sim, x: number, y: number, text: string): void {
  s.pops.push({
    x: clamp(x, 90, W - 90),
    y: clamp(y, 48, H - 40),
    text,
    life: 1.2,
    maxLife: 1.2,
    seed: 7 + s.pops.length * 13 + Math.floor(s.t * 10),
  });
}

function spawnConfetti(s: Sim, x: number, y: number): void {
  const colors = [COTTON.pink, COTTON.white, COTTON.blue, P.gold];
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 70 + Math.random() * 130;
    s.scraps.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 60,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 10,
      life: 0.6 + Math.random() * 0.3,
      color: colors[i % colors.length],
    });
  }
}

function spawnMote(s: Sim): void {
  const a = Math.random() * Math.PI * 2;
  const rr = KETTLE.r * (0.55 + Math.random() * 0.4);
  s.motes.push({
    sx: KETTLE.x + Math.cos(a) * rr,
    sy: KETTLE.y + Math.sin(a) * rr * 0.9,
    life: 0.45 + Math.random() * 0.2,
    maxLife: 0.6,
    r: 1.6 + Math.random() * 2,
    color: Math.random() < 0.5 ? COTTON.pink : COTTON.white,
  });
}

/** 1本完成（スコア確定→新しい割り箸へ）。tier未満なら何もしない */
function commitCandy(s: Sim): void {
  const tier = tierOf(s.mass);
  if (tier < 0) return;
  const pts = Math.round(
    (s.mass * 100 + TIERS[tier].bonus) * (0.55 + 0.45 * s.fluff),
  );
  s.score += pts;
  s.sticks++;
  s.done.push(tier);
  addPop(s, s.candy.x, s.candy.y - candyRadius(s.mass) - 26, `${TIERS[tier].name}かんせい！+${pts}`);
  spawnConfetti(s, s.candy.x, s.candy.y);
  if (tier >= 2) sfx.bigHit();
  else sfx.hit();
  // 新しい割り箸
  s.mass = 0;
  s.fluff = 1;
  s.heat = Math.max(0, s.heat - 0.4);
  s.lastTier = -1;
  s.momentum *= 0.6;
  s.spin.turnAcc = 0;
}

function endGame(s: Sim): void {
  if (s.phase === "result") return;
  // 育てかけの綿も、完成サイズに達していれば加算してあげる
  commitCandy(s);
  s.phase = "result";
  s.ptr.down = false;
  s.spin.has = false;
  sfx.finish();
}

function update(s: Sim, dt: number): void {
  s.t += dt;

  if (s.phase === "playing") {
    const prevSec = Math.ceil(s.time);
    s.time -= dt;
    const sec = Math.max(0, Math.ceil(s.time));
    if (sec !== prevSec && sec <= 5 && sec >= 1) sfx.tick();
    if (s.time <= 0) endGame(s);
  }

  /* ---- 回転検出（角度の連続変化を積算） ---- */
  const spinning = s.phase === "playing" && s.ptr.down;
  if (spinning) {
    const dx = s.ptr.x - KETTLE.x;
    const dy = s.ptr.y - KETTLE.y;
    const r = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    if (s.spin.has) {
      let d = ang - s.spin.prevAng;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const inst = clamp(d / Math.max(dt, 1e-4), -32, 32);
      s.spin.vel += (inst - s.spin.vel) * Math.min(1, dt * 10);

      // 方向の一貫性: 反転すると勢い（momentum）を失う
      const sgn = d > 0.0005 ? 1 : d < -0.0005 ? -1 : 0;
      if (sgn !== 0) {
        if (s.spin.dir === 0) {
          s.spin.dir = sgn;
        } else if (sgn !== s.spin.dir) {
          s.spin.revAcc += Math.abs(d);
          if (s.spin.revAcc > 0.5) {
            s.spin.dir = sgn;
            s.spin.revAcc = 0;
            s.spin.turnAcc = 0;
            s.momentum = Math.min(s.momentum, 0.25);
          }
        } else {
          s.spin.revAcc = Math.max(0, s.spin.revAcc - Math.abs(d) * 0.6);
        }
      }

      // きれいな円ほど効率UP（半径のブレをみる）
      s.spin.rS += (r - s.spin.rS) * Math.min(1, dt * 4);
      const dev = Math.abs(r - s.spin.rS);
      const circleEff = clamp(1 - dev / 46, 0.35, 1);

      const rev = Math.abs(s.spin.vel) / (Math.PI * 2); // 回/秒
      // 速度効率: ゆっくりすぎは育たない、速すぎも効率ダウン
      const speedEff =
        rev <= 0.15
          ? 0
          : rev < 0.7
            ? (rev - 0.15) / 0.55
            : rev <= 2.2
              ? 1
              : Math.max(0.35, 1 - (rev - 2.2) * 0.45);

      const inBand = r >= SPIN_MIN_R && r <= KETTLE.r - 6;
      if (rev > 0.3 && inBand) s.momentum = Math.min(1, s.momentum + dt * 0.45);
      else s.momentum = Math.max(0, s.momentum - dt * 0.6);

      // 回しすぎ・巻きすぎで熱がたまる
      if (rev > 2.4) s.heat += (rev - 2.4) * 0.34 * dt;
      const over = s.mass > MAX_MASS_SOFT;
      if (over && rev > 0.5) s.heat += dt * 0.25;

      // 綿の積算: 同方向の角度変化ぶんだけ育つ（1周 = 2π で1単位）
      if (inBand && sgn !== 0 && sgn === s.spin.dir) {
        const eff =
          speedEff * circleEff * (0.5 + 0.5 * s.momentum) * (over ? 0.25 : 1);
        const gain = (Math.abs(d) / (Math.PI * 2)) * (0.14 + s.mass * 0.05) * eff;
        s.mass += gain;
        // ちょうどいい速度で回せているとふわふわ度が回復
        if (rev <= 2.2) s.fluff = Math.min(1, s.fluff + dt * 0.035 * speedEff);
        s.spin.turnAcc += Math.abs(d);
        if (s.spin.turnAcc >= Math.PI * 2) s.spin.turnAcc -= Math.PI * 2;
        if (gain > 0 && Math.random() < eff * Math.min(1, rev) * dt * 22) {
          spawnMote(s);
        }
      }
      s.wind += s.spin.vel * dt * 0.5;
    } else {
      s.spin.rS = clamp(r, SPIN_MIN_R, KETTLE.r);
      s.spin.revAcc = 0;
    }
    s.spin.prevAng = ang;
    s.spin.has = true;
  } else {
    s.spin.has = false;
    s.spin.vel *= Math.max(0, 1 - dt * 4);
    s.momentum = Math.max(0, s.momentum - dt * 0.4);
  }

  // 熱の冷却 & 固まり判定
  const revNow = Math.abs(s.spin.vel) / (Math.PI * 2);
  if (revNow < 2.3) s.heat = Math.max(0, s.heat - dt * 0.2);
  if (s.heat >= 1 && s.phase === "playing") {
    s.heat = 0.35;
    s.fluff = Math.max(0.3, s.fluff - 0.28);
    s.mass = Math.max(0, s.mass - 0.08);
    sfx.pop();
    addPop(s, s.candy.x, s.candy.y - candyRadius(s.mass) - 26, "回しすぎ！固まった…");
  }

  // サイズ段階アップの通知
  if (s.phase === "playing") {
    const tier = tierOf(s.mass);
    if (tier > s.lastTier) {
      s.lastTier = tier;
      sfx.hit();
      addPop(s, s.candy.x, s.candy.y - candyRadius(s.mass) - 26, `${TIERS[tier].name}サイズ！`);
    }
  }

  // 綿あめの位置: 回している間は指に追従、はなすと釜の中央へ
  let tx = KETTLE.x;
  let ty = KETTLE.y;
  if (spinning) {
    const dx = s.ptr.x - KETTLE.x;
    const dy = s.ptr.y - KETTLE.y;
    const r = Math.hypot(dx, dy);
    const rc = Math.min(r, KETTLE.r - 24);
    if (r > 1) {
      tx = KETTLE.x + (dx / r) * rc;
      ty = KETTLE.y + (dy / r) * rc;
    }
  }
  const k = Math.min(1, dt * 7);
  s.candy.x += (tx - s.candy.x) * k;
  s.candy.y += (ty - s.candy.y) * k;

  // パーティクル類
  s.motes = s.motes.filter((m) => {
    m.life -= dt;
    return m.life > 0;
  });
  s.scraps = s.scraps.filter((sc) => {
    sc.x += sc.vx * dt;
    sc.y += sc.vy * dt;
    sc.vy += 80 * dt;
    sc.rot += sc.vr * dt;
    sc.life -= dt;
    return sc.life > 0;
  });
  s.pops = s.pops.filter((p) => {
    p.y -= 26 * dt;
    p.life -= dt;
    return p.life > 0;
  });
}

/* ================= 描画 ================= */

const FONT_MARU = "'Zen Maru Gothic','Hiragino Maru Gothic ProN',sans-serif";

/** ザラメの釜（木のリム + 暗い内側 + 熱で光る砂糖 + きらきらザラメ） */
function drawKettle(ctx: CanvasRenderingContext2D, s: Sim): void {
  paperCircle(ctx, KETTLE.x, KETTLE.y, KETTLE.r + 16, {
    fill: P.wood,
    edge: P.woodDeep,
    edgeWidth: 2.5,
    jitter: 4,
    seed: 11,
    shadow: "rgba(0,0,0,.45)",
    shadowDy: 7,
  });
  paperCircle(ctx, KETTLE.x, KETTLE.y, KETTLE.r, {
    fill: P.indigo,
    jitter: 3,
    seed: 12,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 2,
  });
  // 中央の熱: ほんのりピンクに光る（heatが高いほど赤く強く）
  const heatGlow = 0.16 + s.heat * 0.3;
  const g = ctx.createRadialGradient(
    KETTLE.x,
    KETTLE.y,
    10,
    KETTLE.x,
    KETTLE.y,
    KETTLE.r * 0.95,
  );
  g.addColorStop(0, `rgba(245,168,180,${heatGlow})`);
  g.addColorStop(1, "rgba(245,168,180,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(KETTLE.x, KETTLE.y, KETTLE.r * 0.95, 0, Math.PI * 2);
  ctx.fill();

  // 中央の回転ノズル（ゆっくり回る）
  paperCircle(ctx, KETTLE.x, KETTLE.y, 18, {
    fill: P.kraftDeep,
    edge: P.kraft,
    edgeWidth: 1.5,
    jitter: 1.6,
    seed: 13,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
  });
  ctx.strokeStyle = "rgba(58,46,42,.5)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a = s.t * 1.6 + (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(KETTLE.x + Math.cos(a) * 5, KETTLE.y + Math.sin(a) * 5);
    ctx.lineTo(KETTLE.x + Math.cos(a) * 14, KETTLE.y + Math.sin(a) * 14);
    ctx.stroke();
  }

  // ザラメのきらきら（seed固定・twinkle）
  for (let k = 0; k < 34; k++) {
    const a = seededJitter(21, k * 2, Math.PI);
    const rr = (Math.abs(seededJitter(22, k, 0.5)) + 0.28) * KETTLE.r * 1.28;
    if (rr > KETTLE.r - 12) continue;
    const sx = KETTLE.x + Math.cos(a) * rr;
    const sy = KETTLE.y + Math.sin(a) * rr;
    const tw = 0.5 + 0.5 * Math.sin(s.t * 2.2 + k * 1.7);
    ctx.globalAlpha = 0.14 + tw * 0.3;
    ctx.fillStyle = k % 3 === 0 ? COTTON.pink : COTTON.white;
    ctx.beginPath();
    ctx.arc(sx, sy, 1 + tw * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 回転中の砂糖の筋（速いほど濃く） */
function drawStreaks(ctx: CanvasRenderingContext2D, s: Sim): void {
  const rev = Math.abs(s.spin.vel) / (Math.PI * 2);
  if (!s.spin.has || rev < 0.3) return;
  const alpha = clamp((rev - 0.3) / 1.5, 0, 1) * 0.4;
  const dir = s.spin.vel >= 0 ? 1 : -1;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const rr = clamp(s.spin.rS + (i - 1) * 12, SPIN_MIN_R, KETTLE.r - 10);
    const sweep = (1.1 + i * 0.35) * dir;
    ctx.globalAlpha = alpha * (1 - i * 0.22);
    ctx.strokeStyle = i === 1 ? COTTON.pink : COTTON.white;
    ctx.lineWidth = 3 - i * 0.6;
    ctx.beginPath();
    ctx.arc(
      KETTLE.x,
      KETTLE.y,
      rr,
      s.spin.prevAng - sweep,
      s.spin.prevAng,
      dir < 0,
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = "butt";
}

/** ザラメの粒が綿あめへ吸い込まれる */
function drawMotes(ctx: CanvasRenderingContext2D, s: Sim): void {
  for (const m of s.motes) {
    const p = 1 - m.life / m.maxLife;
    const e = p * p; // 加速して吸い込まれる
    const x = m.sx + (s.candy.x - m.sx) * e;
    const y = m.sy + (s.candy.y - m.sy) * e;
    ctx.globalAlpha = 0.75 * (1 - e * 0.5);
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.arc(x, y, m.r * (1 - e * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 綿あめ本体（割り箸 + 半透明パフの雲。ふわふわ度で見た目が変わる） */
function drawCandy(ctx: CanvasRenderingContext2D, s: Sim): void {
  const { x, y } = s.candy;
  const rc = candyRadius(s.mass);
  const seed = 7 + s.sticks * 31;

  // 割り箸（下向き・綿の後ろ）
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI * 0.5 + Math.sin(s.wind * 0.2) * 0.05);
  paperRect(ctx, rc * 0.15, -5, rc * 0.6 + 92, 10, {
    fill: P.wood,
    edge: P.woodDeep,
    edgeWidth: 1.5,
    jitter: 1.3,
    seed: seed + 1,
    shadow: "rgba(0,0,0,.35)",
    shadowDy: 3,
  });
  ctx.restore();

  if (s.mass <= 0.01) {
    // まだ綿がない: 箸先に小さな白い巻き始め
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = COTTON.white;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  // ふわっとした外側のグロー
  const g = ctx.createRadialGradient(x, y, rc * 0.2, x, y, rc * 1.35);
  g.addColorStop(0, "rgba(246,200,216,.20)");
  g.addColorStop(1, "rgba(246,200,216,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rc * 1.35, 0, Math.PI * 2);
  ctx.fill();

  // パフの雲: 半透明円の重なり。ふわふわ度が低いと締まって固そうに見える
  const n = 10 + Math.floor(Math.min(s.mass, 2) * 22);
  const spread = 0.8 + 0.2 * s.fluff;
  for (let k = 0; k < n; k++) {
    const a = k * 2.39996 + s.wind * 0.6;
    const fr = k === 0 ? 0 : 0.2 + 0.72 * ((k * 0.618) % 1);
    const dist = rc * fr * spread;
    const pr =
      rc * (0.52 - 0.3 * fr) * (0.72 + 0.34 * s.fluff) +
      seededJitter(seed, k, rc * 0.05);
    if (pr <= 1) continue;
    ctx.globalAlpha = s.fluff < 0.55 ? 0.62 : 0.48;
    ctx.fillStyle = PUFF_COLORS[k % PUFF_COLORS.length];
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * dist, y + Math.sin(a) * dist * 0.94, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ふちのふわ毛（回転に追従）
  ctx.strokeStyle = "rgba(251,240,218,.5)";
  ctx.lineWidth = 1.4;
  for (let k = 0; k < 7; k++) {
    const a = k * 0.9 + s.wind * 0.8;
    const bx = x + Math.cos(a) * rc * 0.96;
    const by = y + Math.sin(a) * rc * 0.92;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(
      bx + Math.cos(a + 0.5) * 9,
      by + Math.sin(a + 0.5) * 9,
      bx + Math.cos(a) * (13 + s.fluff * 7),
      by + Math.sin(a) * (13 + s.fluff * 7),
    );
    ctx.stroke();
  }
}

/** 右上のメーター2本: ふわふわ度 / 回しすぎ */
function drawMeters(ctx: CanvasRenderingContext2D, s: Sim): void {
  const bx = 366;
  const bw = 98;
  const drawBar = (
    y: number,
    label: string,
    ratio: number,
    fill: string,
    warn: boolean,
  ) => {
    ctx.font = `900 11px ${FONT_MARU}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(251,240,218,.85)";
    ctx.fillText(label, bx - 8, y + 7);
    paperRect(ctx, bx, y, bw, 13, {
      fill: "rgba(251,240,218,.16)",
      jitter: 1.4,
      seed: y,
      shadow: "rgba(0,0,0,.3)",
      shadowDy: 2,
    });
    ctx.fillStyle = fill;
    ctx.fillRect(bx + 2, y + 2.5, (bw - 4) * clamp(ratio, 0, 1), 8);
    if (warn) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(s.t * 10);
      ctx.strokeStyle = P.red;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx - 1, y - 1, bw + 2, 15);
      ctx.globalAlpha = 1;
    }
  };
  drawBar(18, "ふわふわ", s.fluff, COTTON.pinkDeep, false);
  drawBar(42, "まきすぎ", s.heat, P.red, s.heat > 0.72);
}

/** 開始直後のぐるぐるガイド */
function drawGuide(ctx: CanvasRenderingContext2D, s: Sim): void {
  if (s.phase !== "playing" || s.sticks > 0 || s.mass > 0.06 || s.t > 6) return;
  const a0 = s.t * 2.4;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = COTTON.white;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.arc(KETTLE.x, KETTLE.y, 118, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // 回転方向の矢じり
  const hx = KETTLE.x + Math.cos(a0) * 118;
  const hy = KETTLE.y + Math.sin(a0) * 118;
  ctx.translate(hx, hy);
  ctx.rotate(a0 + Math.PI * 0.5);
  ctx.fillStyle = COTTON.white;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(-7, -6);
  ctx.lineTo(7, -6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.font = `900 16px ${FONT_MARU}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = COTTON.white;
  ctx.fillText("おして ぐるぐる！", KETTLE.x, KETTLE.y - 148);
  ctx.globalAlpha = 1;
}

/** 紙タグポップ（「大玉かんせい！+180」等） */
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
    ctx.font = `900 17px ${FONT_MARU}`;
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

function drawScraps(ctx: CanvasRenderingContext2D, s: Sim): void {
  for (const sc of s.scraps) {
    ctx.save();
    ctx.globalAlpha = clamp(sc.life / 0.6, 0, 1);
    ctx.translate(sc.x, sc.y);
    ctx.rotate(sc.rot);
    ctx.fillStyle = sc.color;
    ctx.fillRect(-4, -3, 8, 6);
    ctx.restore();
  }
}

function render(ctx: CanvasRenderingContext2D, s: Sim): void {
  drawNightSky(ctx, W, H, 5);
  drawLantern(ctx, 44, 66, 17);
  drawLantern(ctx, 88, 50, 12, P.gold);
  drawKettle(ctx, s);
  drawStreaks(ctx, s);
  drawMotes(ctx, s);
  drawCandy(ctx, s);
  drawGuide(ctx, s);
  drawMeters(ctx, s);
  drawScraps(ctx, s);
  drawPops(ctx, s);
}

/* ================= コンポーネント ================= */

function rankTitle(score: number): string {
  if (score >= 600) return "わたあめ名人！";
  if (score >= 350) return "いい感じ！";
  if (score >= 120) return "もうちょい！";
  return "また挑戦してね";
}

const CARD_CLASS =
  "torn border-[3px] border-kraft-paper bg-kraft paper-grain shadow-paper text-fes-ink p-6 text-center max-w-xs";
const BTN_CLASS =
  "rounded-full bg-fes-red border-2 border-fes-red-deep text-kraft-paper font-maru font-black px-8 py-2.5 shadow-paper-sm hover:-translate-y-0.5 transition-transform";

export default function CottonCandyGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<Sim | null>(null);
  const uiKeyRef = useRef("");
  const [ui, setUi] = useState<Ui>({
    phase: "ready",
    score: 0,
    sec: GAME_TIME,
    sticks: 0,
    tier: -1,
    counts: [0, 0, 0, 0],
  });

  const pushUi = useCallback(() => {
    const s = simRef.current;
    if (!s) return;
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    for (const t of s.done) counts[t]++;
    const next: Ui = {
      phase: s.phase,
      score: s.score,
      sec: Math.max(0, Math.ceil(s.time)),
      sticks: s.sticks,
      tier: tierOf(s.mass),
      counts,
    };
    const key = `${next.phase}|${next.score}|${next.sec}|${next.sticks}|${next.tier}|${counts.join(",")}`;
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

  const commitNow = useCallback(() => {
    const s = simRef.current;
    if (!s || s.phase !== "playing") return;
    commitCandy(s);
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
      s.ptr.x = x;
      s.ptr.y = y;
      s.ptr.on = true;
      s.ptr.down = true;
      s.spin.has = false; // 角度の基準を取り直す
    };
    const onMove = (e: PointerEvent) => {
      const s = simRef.current;
      if (!s) return;
      const [x, y] = toLocal(e);
      s.ptr.x = x;
      s.ptr.y = y;
      s.ptr.on = true;
    };
    const onUp = () => {
      const s = simRef.current;
      if (!s) return;
      s.ptr.down = false;
      s.spin.has = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

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
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [pushUi]);

  const scoreboard = (
    <div className="flex items-center justify-between font-maru text-sm font-black">
      <span>⏱ のこり {ui.sec}</span>
      <span>かんせい {ui.sticks}本</span>
      <span>スコア {ui.score}</span>
    </div>
  );

  const overlay =
    ui.phase === "ready" ? (
      <div className={CARD_CLASS}>
        <h2 className="font-maru font-black text-2xl text-fes-indigo">
          🍭 わたあめづくり
        </h2>
        <p className="mt-3 font-maru text-sm font-bold">
          釜の上で ぐるぐる円をかくと綿がふくらむ！
        </p>
        <p className="mt-1.5 font-maru text-xs font-bold">30秒スコアアタック</p>
        <ul className="mt-2 space-y-0.5 text-left font-maru text-xs font-bold text-fes-ink/80">
          <li>・同じ向きにリズムよく回すと効率アップ</li>
          <li>・回しすぎると固まってふわふわダウン</li>
          <li>・育ったら「かんせい！」でスコア確定→次の1本</li>
          <li>・大玉・特大ほどボーナス大</li>
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
          🍭 {ui.sticks}本かんせい
        </p>
        <p className="mt-1 font-maru text-xs font-bold text-fes-ink/75">
          ミニ×{ui.counts[0]}　ふつう×{ui.counts[1]}　大玉×{ui.counts[2]}　特大×
          {ui.counts[3]}
        </p>
        <div className="mt-4 space-y-3 text-left">
          <ScoreSubmit game="cotton-candy" score={ui.score} />
          <Leaderboard game="cotton-candy" />
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
      title="わ た あ め"
      tagline="ぐるぐる回してふわふわに育てよう"
      scoreboard={scoreboard}
      overlay={overlay}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        aria-label="わたあめづくりのゲーム画面"
      />
      {ui.phase === "playing" && ui.tier >= 0 && (
        <button
          type="button"
          onClick={commitNow}
          className="absolute bottom-3 left-1/2 z-[5] -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-fes-red-deep bg-fes-red px-6 py-2 font-maru text-sm font-black text-kraft-paper shadow-paper-sm transition-transform active:translate-y-0.5"
        >
          🍭 {TIERS[ui.tier].name}でかんせい！
        </button>
      )}
    </GameShell>
  );
}
