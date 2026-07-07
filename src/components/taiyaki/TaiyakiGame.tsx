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

// たい焼き型の中心
const CX = W / 2;
const CY = 345;

// 卵タイミング: 指示マークは sin で左右スイープ（-1〜+1）
const EGG_RANGE = 85; // ±px（型の中での黄身の可動域）
const CENTER_BAND = 0.15; // |ind| がこの帯なら「ど真ん中」
const BIG_MISS = 0.62; // これを超えるとコンボが切れる大ミス
const EGG_MAX = 60;
// スイープ角速度: 序盤 2.4 → 終盤 4.6 rad/s
const SWEEP_BASE = 2.4;
const SWEEP_RAMP = 2.2;

// 焼きタイミング: doneness 0→1。黄金ゾーンでタップ
const GOLD_LO = 0.7;
const GOLD_HI = 0.9;
const BAKE_GOLD = 60;
const BAKE_RAW = 30; // 生焼け（早すぎ）は半分
// 焼き速度: 序盤 1/2.8 → 終盤 ×1.6
const BASE_BAKE = 1 / 2.8;
const BAKE_RAMP = 0.6;

const ATARI_BONUS = 20; // 「尻尾まで具！」フラットボーナス（倍率外）
const COMBO_STEP = 0.15;
const COMBO_MAX_MULT = 2.5;
const RARE_CHANCE = 0.15;
const RARE_MULT = 1.5;

// 1匹の演出時間
const PREP_T = 0.55; // 生地＋ベーコンが乗る
const LID_T = 0.35; // フタが閉まる（この間はタップ無効）
const DONE_T = 0.7; // 完成演出 → 次の1匹へ

const TRAY = { x: W - 64, y: 64 };

type Phase = "ready" | "playing" | "result";
type Stage = "prep" | "egg" | "bake" | "done";
type Rare = "none" | "wyolk" | "cheese";
type BakeResult = "none" | "atari" | "kongari" | "raw" | "burnt";

type Taiyaki = {
  stage: Stage;
  stageT: number;
  rare: Rare;
  sweepW: number; // 卵スイープの角速度（生成時に確定）
  bakeSpeed: number; // 焼き速度（卵を割った時に確定）
  eggX: number | null; // 黄身の位置 -1〜+1（null = まだ）
  eggCentered: boolean;
  eggPts: number;
  doneness: number; // 0→1（1で自動焦げ）
  result: BakeResult;
  pts: number;
  seed: number;
};

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
  t: number;
  time: number;
  score: number;
  combo: number; // 連続「当たり」数
  bestCombo: number;
  atari: number;
  kongari: number; // 黄金焼きだが卵ははじっこ
  raw: number;
  burnt: number;
  tray: number; // 完成してお盆に乗った数（描画用）
  cur: Taiyaki;
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
  baked: number;
  atari: number;
  kongari: number;
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

function progOf(s: Sim): number {
  return s.phase === "playing"
    ? clamp((GAME_TIME - s.time) / GAME_TIME, 0, 1)
    : 0;
}

/** 卵指示マークの現在位置（-1〜+1）。stageT 駆動で決定的 */
function indOf(ty: Taiyaki): number {
  return Math.sin(ty.stageT * ty.sweepW);
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
    const a = Math.PI * 1.15 + Math.random() * Math.PI * 0.7;
    const sp = 30 + Math.random() * 50;
    const life = 0.5 + Math.random() * 0.3;
    s.puffs.push({
      x: x + (Math.random() - 0.5) * 40,
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

function newTaiyaki(s: Sim): Taiyaki {
  const prog = progOf(s);
  let rare: Rare = "none";
  if (s.phase === "playing" && Math.random() < RARE_CHANCE) {
    rare = Math.random() < 0.5 ? "wyolk" : "cheese";
    addPop(
      s,
      CX,
      CY - 160,
      rare === "wyolk" ? "W黄身！×1.5" : "チーズ増し！×1.5",
    );
  }
  return {
    stage: "prep",
    stageT: 0,
    rare,
    sweepW: SWEEP_BASE + SWEEP_RAMP * prog,
    bakeSpeed: BASE_BAKE,
    eggX: null,
    eggCentered: false,
    eggPts: 0,
    doneness: 0,
    result: "none",
    pts: 0,
    seed: s.nextSeed++ * 13 + 7,
  };
}

function makeSim(): Sim {
  const s: Sim = {
    phase: "ready",
    t: 0,
    time: GAME_TIME,
    score: 0,
    combo: 0,
    bestCombo: 0,
    atari: 0,
    kongari: 0,
    raw: 0,
    burnt: 0,
    tray: 0,
    cur: null as unknown as Taiyaki,
    puffs: [],
    pops: [],
    nextSeed: 100,
  };
  s.cur = newTaiyaki(s);
  return s;
}

function endGame(s: Sim): void {
  if (s.phase === "result") return;
  s.phase = "result";
  sfx.finish();
}

/** 焼き上がりの確定（黄金 / 生焼け / 焦げ） */
function finishTaiyaki(
  s: Sim,
  ty: Taiyaki,
  result: BakeResult,
  bakePts: number,
): void {
  ty.stage = "done";
  ty.stageT = 0;
  ty.result = result;
  // 結果画面の背後で焼けても集計しない（雰囲気のみ）
  if (s.phase !== "playing") return;

  if (result === "burnt") {
    s.burnt++;
    s.combo = 0;
    ty.pts = 0;
    spawnPuffs(s, CX, CY - 40, "#4A342B");
    addPop(s, CX, CY - 150, "焦げた…");
    sfx.pop();
    return;
  }

  const mult = comboMult(s.combo);
  const rareMul = ty.rare !== "none" ? RARE_MULT : 1;
  let pts = Math.round((ty.eggPts + bakePts) * rareMul * mult);
  if (result === "atari") pts += ATARI_BONUS;
  ty.pts = pts;
  s.score += pts;
  spawnPuffs(s, CX, CY - 40, P.paper);

  if (result === "atari") {
    s.atari++;
    s.combo++;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    addPop(s, CX, CY - 150, `+${pts}`);
    addPop(s, CX, CY - 186, "尻尾まで具！");
    sfx.bigHit();
  } else if (result === "kongari") {
    s.kongari++;
    addPop(s, CX, CY - 150, `+${pts} こんがり`);
    sfx.hit();
  } else {
    s.raw++;
    addPop(s, CX, CY - 150, `+${pts} 生焼け…`);
    sfx.miss();
  }
}

/** タップ#1: 卵を割る（指示マークの位置に黄身が落ちる） */
function crackEgg(s: Sim, ty: Taiyaki): void {
  const ind = indOf(ty);
  const off = Math.abs(ind);
  ty.eggX = clamp(ind, -1, 1);
  ty.eggCentered = off <= CENTER_BAND;
  ty.eggPts = ty.eggCentered
    ? EGG_MAX
    : Math.max(5, Math.round(EGG_MAX * (1 - off) * 0.85));
  ty.stage = "bake";
  ty.stageT = 0;
  ty.bakeSpeed = BASE_BAKE * (1 + BAKE_RAMP * progOf(s));
  sfx.pop(); // パカッ（卵割り）
  if (ty.eggCentered) {
    addPop(s, CX, CY - 150, "ど真ん中！");
    sfx.hit();
  } else if (off > BIG_MISS) {
    s.combo = 0;
    addPop(s, CX, CY - 150, "はじっこ…");
    sfx.miss();
  }
}

/** タップ#2: たい焼きを取り出す */
function pullOut(s: Sim, ty: Taiyaki): void {
  if (ty.stageT < LID_T) return; // フタが閉まりきるまで無効
  const d = ty.doneness;
  if (d < GOLD_LO) {
    finishTaiyaki(s, ty, "raw", BAKE_RAW);
  } else if (d <= GOLD_HI) {
    finishTaiyaki(s, ty, ty.eggCentered ? "atari" : "kongari", BAKE_GOLD);
  } else {
    finishTaiyaki(s, ty, "burnt", 0);
  }
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

  const ty = s.cur;
  ty.stageT += dt;
  if (ty.stage === "prep") {
    if (ty.stageT >= PREP_T) {
      ty.stage = "egg";
      ty.stageT = 0;
    }
  } else if (ty.stage === "bake") {
    if (ty.stageT > LID_T) {
      ty.doneness += ty.bakeSpeed * dt;
      if (ty.doneness >= 1) finishTaiyaki(s, ty, "burnt", 0);
    }
  } else if (ty.stage === "done") {
    if (ty.stageT >= DONE_T) {
      if (ty.result !== "burnt" && ty.result !== "none") s.tray++;
      s.cur = newTaiyaki(s);
    }
  }

  // 湯気・煙 / 紙タグポップ
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

/** doneness → 生地の色（クリーム → きつね色 → 焦げ茶） */
function crustColor(d: number): string {
  if (d <= GOLD_LO) return hexLerp(P.kraftLight, P.gold, d / GOLD_LO);
  return hexLerp(P.gold, "#5B3413", (d - GOLD_LO) / (1 - GOLD_LO));
}

// たい焼きの魚シルエット（頭が左・尾が右）。中心 (0,0) 基準
const FISH_SHAPE: [number, number][] = [
  [-128, -6],
  [-118, -34],
  [-92, -52],
  [-52, -62],
  [-8, -64],
  [34, -56],
  [64, -38],
  [92, -20],
  [128, -50],
  [138, -30],
  [112, 0],
  [138, 30],
  [128, 50],
  [92, 20],
  [64, 38],
  [30, 56],
  [-14, 62],
  [-60, 58],
  [-98, 42],
  [-122, 18],
];

function fishPts(cx: number, cy: number, k: number): [number, number][] {
  return FISH_SHAPE.map(([x, y]) => [cx + x * k, cy + y * k]);
}

/** 鉄板の焼き台 + 魚型のくぼみ */
function drawGriddle(ctx: CanvasRenderingContext2D): void {
  // 木枠 → 鉄板
  paperRect(ctx, 30, 150, W - 60, 400, {
    fill: P.woodDeep,
    edge: "#5E3D1D",
    edgeWidth: 2.5,
    jitter: 3,
    seed: 61,
    shadow: "rgba(0,0,0,.45)",
    shadowDy: 6,
  });
  paperRect(ctx, 44, 164, W - 88, 372, {
    fill: "#544B44",
    edge: "#332D28",
    edgeWidth: 2,
    jitter: 2.5,
    seed: 62,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
  });
  // 鉄板のリベット
  ctx.fillStyle = "rgba(0,0,0,.28)";
  for (let k = 0; k < 6; k++) {
    const rx = 66 + (k % 3) * ((W - 132) / 2);
    const ry = 186 + Math.floor(k / 3) * 328 + seededJitter(63, k, 3);
    ctx.beginPath();
    ctx.arc(rx, ry, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // 魚型のくぼみ（外周 → 内側の深い面）
  paperPoly(ctx, fishPts(CX, CY, 1.08), {
    fill: "#3B3430",
    edge: "#2A2521",
    edgeWidth: 2,
    jitter: 3,
    seed: 64,
    shadow: "rgba(0,0,0,.35)",
    shadowDy: 4,
  });
  paperPoly(ctx, fishPts(CX, CY, 0.98), {
    fill: "#2E2824",
    jitter: 2.5,
    seed: 65,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 2,
  });
}

/** 生地・ベーコン・チーズ・卵（型の中身） */
function drawContents(ctx: CanvasRenderingContext2D, ty: Taiyaki): void {
  const grow =
    ty.stage === "prep" ? 0.75 + 0.25 * clamp(ty.stageT / PREP_T, 0, 1) : 1;
  // 生地（焼き中はふちから色づく）
  const tint = ty.stage === "bake" ? clamp(ty.doneness * 0.5, 0, 0.5) : 0;
  paperPoly(ctx, fishPts(CX, CY, 0.86 * grow), {
    fill: hexLerp(P.kraftLight, P.gold, tint),
    edge: "rgba(251,240,218,.35)",
    edgeWidth: 1.4,
    jitter: 3,
    seed: ty.seed,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
  });

  // ベーコン（赤茶の帯 + 脂身の波線）
  const baconIn = ty.stage !== "prep" || ty.stageT > PREP_T * 0.45;
  if (baconIn) {
    ctx.save();
    ctx.translate(CX - 4, CY + 18);
    ctx.rotate(-0.1);
    paperRect(ctx, -74, -14, 148, 28, {
      fill: "#B34A35",
      edge: "#8C3325",
      edgeWidth: 1.5,
      jitter: 2,
      seed: ty.seed + 3,
      shadow: "rgba(0,0,0,.25)",
      shadowDy: 2,
    });
    ctx.strokeStyle = "#EFC9AF";
    ctx.lineWidth = 2.5;
    for (const oy of [-5, 5]) {
      ctx.beginPath();
      ctx.moveTo(-66, oy);
      for (let x = -66; x <= 66; x += 12) {
        ctx.lineTo(x, oy + seededJitter(ty.seed + 4, x + oy, 2.5));
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // チーズ増し（黄色い切り紙チップ）
  if (ty.rare === "cheese" && baconIn) {
    for (let i = 0; i < 4; i++) {
      const px = CX - 60 + i * 40 + seededJitter(ty.seed + 5, i, 8);
      const py = CY - 24 + seededJitter(ty.seed + 6, i, 10);
      paperRect(ctx, px - 8, py - 8, 16, 16, {
        fill: "#F5D061",
        edge: "#D9A72E",
        edgeWidth: 1,
        jitter: 1.5,
        seed: ty.seed + 7 + i,
        shadow: "rgba(0,0,0,.2)",
        shadowDy: 2,
      });
    }
  }

  // 卵（白身 + 黄身。W黄身は2つ）
  if (ty.eggX !== null) {
    const ex = CX + ty.eggX * EGG_RANGE;
    ctx.save();
    ctx.translate(ex, CY - 6);
    ctx.scale(1.25, 1);
    paperCircle(ctx, 0, 0, 26, {
      fill: "rgba(251,240,218,.95)",
      jitter: 3,
      seed: ty.seed + 11,
      shadow: "rgba(0,0,0,.2)",
      shadowDy: 2,
    });
    ctx.restore();
    const yolks = ty.rare === "wyolk" ? [-12, 12] : [0];
    for (const oy of yolks) {
      paperCircle(ctx, ex + oy, CY - 6, ty.rare === "wyolk" ? 11 : 14, {
        fill: P.gold,
        edge: P.goldDeep,
        edgeWidth: 1.5,
        jitter: 1.5,
        seed: ty.seed + 13 + oy,
        shadow: "rgba(0,0,0,.15)",
        shadowDy: 1,
      });
      ctx.fillStyle = "rgba(251,240,218,.6)";
      ctx.beginPath();
      ctx.arc(ex + oy - 4, CY - 10, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** 卵タイミングの指示（ど真ん中バンド + スイープする卵 + 点線） */
function drawEggIndicator(
  ctx: CanvasRenderingContext2D,
  ty: Taiyaki,
  t: number,
): void {
  const ind = indOf(ty);
  const ex = CX + ind * EGG_RANGE;
  const inBand = Math.abs(ind) <= CENTER_BAND;

  // ど真ん中バンド
  const bw = CENTER_BAND * EGG_RANGE;
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  ctx.fillStyle = `rgba(232,169,59,${0.16 + 0.1 * pulse})`;
  ctx.fillRect(CX - bw, CY - 74, bw * 2, 136);
  ctx.strokeStyle = `rgba(255,217,138,${0.5 + 0.3 * pulse})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(CX - bw, CY - 74, bw * 2, 136);

  // 落下点への点線
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "rgba(251,240,218,.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ex, CY - 96);
  ctx.lineTo(ex, CY - 36);
  ctx.stroke();
  ctx.restore();

  // スイープする卵（バンド内で金色に光る）
  const bob = Math.sin(t * 5) * 3;
  if (inBand) {
    const g = ctx.createRadialGradient(ex, CY - 122 + bob, 4, ex, CY - 122 + bob, 34);
    g.addColorStop(0, "rgba(255,217,138,.5)");
    g.addColorStop(1, "rgba(255,217,138,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ex, CY - 122 + bob, 34, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(ex, CY - 122 + bob);
  ctx.scale(1, 1.25);
  paperCircle(ctx, 0, 0, 15, {
    fill: P.paper,
    edge: inBand ? P.gold : P.kraftDeep,
    edgeWidth: 2,
    jitter: 1.5,
    seed: 71,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
  });
  ctx.restore();
}

/** フタ（魚型の鉄フタ）+ 黄金ゾーンの光る合図 */
function drawLid(ctx: CanvasRenderingContext2D, ty: Taiyaki, t: number): void {
  const lidK = clamp(ty.stageT / LID_T, 0, 1);
  const oy = -(1 - lidK) * 250;
  const d = ty.doneness;
  const inZone = d >= GOLD_LO && d <= GOLD_HI;

  // 黄金ゾーン: フタの周りが金色に光る
  if (inZone) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 9);
    const g = ctx.createRadialGradient(CX, CY, 60, CX, CY, 190);
    g.addColorStop(0, `rgba(255,217,138,${0.18 + 0.14 * pulse})`);
    g.addColorStop(1, "rgba(255,217,138,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(CX, CY, 190, 0, Math.PI * 2);
    ctx.fill();
  }

  paperPoly(ctx, fishPts(CX, CY + oy, 1.04), {
    fill: "#5A524B",
    edge: inZone ? "#FFD98A" : "#332D28",
    edgeWidth: inZone ? 3 : 2,
    jitter: 3,
    seed: 81,
    shadow: "rgba(0,0,0,.4)",
    shadowDy: 5,
  });
  // 取っ手
  paperCircle(ctx, CX - 8, CY + oy - 10, 13, {
    fill: P.woodDeep,
    edge: "#5E3D1D",
    edgeWidth: 1.5,
    jitter: 1.5,
    seed: 82,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
  });

  // 湯気（phase 駆動・状態レス）
  if (lidK >= 1 && d > 0.25) {
    const vis = clamp((d - 0.25) / 0.2, 0, 1);
    for (let k = 0; k < 3; k++) {
      const ph = t * 1.6 + k * 2.2;
      const cyc = (ph % 2) / 2;
      const wx = CX - 70 + k * 70 + Math.sin(ph * 3) * 6;
      const wy = CY - 70 - cyc * 30;
      ctx.globalAlpha = 0.3 * (1 - cyc) * vis;
      ctx.fillStyle = P.paper;
      ctx.beginPath();
      ctx.arc(wx, wy, 4 + cyc * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** 焼きゲージ（黄金ゾーン付き） */
function drawGauge(ctx: CanvasRenderingContext2D, ty: Taiyaki, t: number): void {
  const x0 = 90;
  const y0 = 588;
  const w = 300;
  const h = 18;
  const d = clamp(ty.doneness, 0, 1);
  paperRect(ctx, x0 - 4, y0 - 4, w + 8, h + 8, {
    fill: P.woodDeep,
    edge: "#5E3D1D",
    edgeWidth: 2,
    jitter: 2,
    seed: 91,
    shadow: "rgba(0,0,0,.4)",
    shadowDy: 4,
  });
  ctx.fillStyle = "#332D28";
  ctx.fillRect(x0, y0, w, h);
  // 黄金ゾーン
  const inZone = d >= GOLD_LO && d <= GOLD_HI;
  const zonePulse = inZone ? 0.25 + 0.25 * Math.sin(t * 9) : 0;
  ctx.fillStyle = `rgba(232,169,59,${0.45 + zonePulse})`;
  ctx.fillRect(x0 + GOLD_LO * w, y0, (GOLD_HI - GOLD_LO) * w, h);
  // 進行
  ctx.fillStyle = crustColor(d);
  ctx.fillRect(x0, y0 + 3, d * w, h - 6);
  // 針
  ctx.fillStyle = P.paper;
  ctx.fillRect(x0 + d * w - 1.5, y0 - 3, 3, h + 6);
  // ラベル
  ctx.font = "900 11px 'Zen Maru Gothic','Hiragino Maru Gothic ProN',sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = P.kraftLight;
  ctx.fillText("こんがり", x0 + ((GOLD_LO + GOLD_HI) / 2) * w, y0 - 8);
}

/** 焼き上がったたい焼き（完成演出・お盆へ飛ぶ） */
function drawFinished(ctx: CanvasRenderingContext2D, ty: Taiyaki): void {
  const burnt = ty.result === "burnt";
  const fill = burnt
    ? "#42301F"
    : ty.result === "raw"
      ? hexLerp(P.kraftLight, P.gold, 0.45)
      : P.gold;

  let px = CX;
  let py = CY;
  let k = 0.9;
  if (!burnt) {
    // 少し見せてからお盆へ放物線で飛ぶ
    const fk = clamp((ty.stageT - 0.18) / (DONE_T - 0.18), 0, 1);
    px = CX + (TRAY.x - CX) * fk;
    py = CY + (TRAY.y - CY) * fk - Math.sin(fk * Math.PI) * 90;
    k = 0.9 * (1 - 0.72 * fk);
  }

  paperPoly(ctx, fishPts(px, py, k), {
    fill,
    edge: burnt ? "rgba(0,0,0,.3)" : "rgba(251,240,218,.45)",
    edgeWidth: 1.6,
    jitter: 3,
    seed: ty.seed + 21,
    shadow: "rgba(0,0,0,.35)",
    shadowDy: 4,
  });
  // 目 + うろこ線
  ctx.fillStyle = burnt ? "#1E1712" : P.ink;
  ctx.beginPath();
  ctx.arc(px - 95 * k, py - 24 * k, 6 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = burnt ? "rgba(0,0,0,.35)" : "rgba(185,127,29,.55)";
  ctx.lineWidth = 2 * k;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(px + (-30 + i * 34) * k, py - 4 * k, 26 * k, -0.6, 0.6);
    ctx.stroke();
  }
}

/** 右上のお盆（完成したたい焼きが並ぶ） */
function drawTray(ctx: CanvasRenderingContext2D, tray: number): void {
  const { x, y } = TRAY;
  paperCircle(ctx, x, y, 46, {
    fill: P.kraft,
    edge: P.kraftDeep,
    edgeWidth: 2,
    jitter: 2.5,
    seed: 95,
    shadow: "rgba(0,0,0,.4)",
    shadowDy: 5,
  });
  paperCircle(ctx, x, y, 36, {
    fill: P.kraftLight,
    jitter: 2,
    seed: 96,
    shadow: "rgba(0,0,0,.2)",
    shadowDy: 2,
  });
  // ミニたい焼き（最大8匹）
  const n = Math.min(tray, 8);
  for (let i = 0; i < n; i++) {
    const a = i * 0.82 - 1.2;
    const rr = i < 4 ? 12 : 24;
    const ix = x + Math.cos(a) * rr;
    const iy = y + Math.sin(a) * rr;
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(a * 0.4);
    ctx.fillStyle = P.gold;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(13, -4.5);
    ctx.lineTo(13, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.arc(-5, -1.5, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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

/** 紙タグポップ（+120 / 尻尾まで具！ / 焦げた…） */
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
  drawNightSky(ctx, W, H, 13);
  drawLantern(ctx, 56, 62, 20);
  drawTray(ctx, s.tray);
  drawGriddle(ctx);

  const ty = s.cur;
  if (ty.stage === "done") {
    drawFinished(ctx, ty);
  } else {
    drawContents(ctx, ty);
    if (ty.stage === "egg") drawEggIndicator(ctx, ty, s.t);
    if (ty.stage === "bake") {
      drawLid(ctx, ty, s.t);
      drawGauge(ctx, ty, s.t);
    }
  }

  drawPuffs(ctx, s);
  drawPops(ctx, s);
}

/* ================= コンポーネント ================= */

function rankTitle(score: number): string {
  if (score >= 1500) return "たい焼き職人！";
  if (score >= 800) return "いい焼き上がり！";
  if (score >= 300) return "もうちょい！";
  return "また挑戦してね";
}

const CARD_CLASS =
  "torn border-[3px] border-kraft-paper bg-kraft paper-grain shadow-paper text-fes-ink p-6 text-center max-w-xs";
const BTN_CLASS =
  "rounded-full bg-fes-red border-2 border-fes-red-deep text-kraft-paper font-maru font-black px-8 py-2.5 shadow-paper-sm hover:-translate-y-0.5 transition-transform";

export default function TaiyakiGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<Sim | null>(null);
  const uiKeyRef = useRef("");
  const [ui, setUi] = useState<Ui>({
    phase: "ready",
    score: 0,
    sec: GAME_TIME,
    combo: 0,
    bestCombo: 0,
    baked: 0,
    atari: 0,
    kongari: 0,
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
      baked: s.atari + s.kongari + s.raw,
      atari: s.atari,
      kongari: s.kongari,
      raw: s.raw,
      burnt: s.burnt,
    };
    const key = `${next.phase}|${next.score}|${next.sec}|${next.combo}|${next.bestCombo}|${next.atari}|${next.kongari}|${next.raw}|${next.burnt}`;
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

    // どこをタップしても「今の工程」を進める（卵割り → 取り出し）
    const onDown = () => {
      const s = simRef.current;
      if (!s || s.phase !== "playing") return;
      const ty = s.cur;
      if (ty.stage === "egg") crackEgg(s, ty);
      else if (ty.stage === "bake") pullOut(s, ty);
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
      <span>焼けた {ui.baked}匹</span>
    </div>
  );

  const overlay =
    ui.phase === "ready" ? (
      <div className={CARD_CLASS}>
        <h2 className="font-maru font-black text-2xl text-fes-indigo">
          🐟 ベーコンエッグたい焼き
        </h2>
        <p className="mt-3 font-maru text-sm font-bold">
          卵を真ん中に落とす→きつね色で取り出す！
        </p>
        <p className="mt-1.5 font-maru text-xs font-bold">制限時間は40秒</p>
        <ul className="mt-2 space-y-0.5 text-left font-maru text-xs font-bold text-fes-ink/80">
          <li>・タップ1: 動く卵がど真ん中に来たら割る</li>
          <li>・タップ2: ゲージがきつね色ゾーンで取り出す</li>
          <li>・両方きめると「当たり」でコンボ倍率UP（最大×2.5）</li>
          <li>・焦がすor大はずしでコンボが切れる</li>
          <li>・たまに W黄身/チーズ増し（点数×1.5）</li>
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
          当たり×{ui.atari}　こんがり×{ui.kongari}
        </p>
        <p className="mt-0.5 font-maru text-sm font-bold">
          生焼け×{ui.raw}　焦げ×{ui.burnt}
        </p>
        <p className="mt-1 font-maru text-xs font-bold text-fes-ink/75">
          さいだいコンボ {ui.bestCombo}
        </p>
        <div className="mt-4 space-y-3 text-left">
          <ScoreSubmit game="taiyaki" score={ui.score} />
          <Leaderboard game="taiyaki" />
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
      title="ベーコンエッグたい焼き"
      tagline="卵はど真ん中、焼きはきつね色！"
      scoreboard={scoreboard}
      overlay={overlay}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-pointer touch-none"
        aria-label="ベーコンエッグたい焼きのゲーム画面"
      />
    </GameShell>
  );
}
