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
const RESPAWN_DELAY = 1.2; // 倒してからrespawnまで(s)
const MAX_AMMO = 6; // コルクの装填数
const CORK_FLIGHT = 0.18; // コルクの飛翔時間(s)。この間は次弾発射不可
const RELOAD_TIME = 1.2; // リロード所要時間(s)
const AIM_OFFSET_Y = 70; // 照準は指の位置よりこのpx分上に出す
const DROP_Y = 14; // 弾道落下: 着弾点は照準より下にずれる(px)
// リロードボタンは右上（下側だと操作中の指で隠れる）。rは当たり判定半径
const RELOAD_BTN = { x: W - 52, y: 174, r: 36 } as const;
const SHELF_YS = [300, 440] as const; // 棚の天板y
const SLOT_XS = [96, 192, 288, 384] as const; // 棚の4スロットx
const STAR_Y = 370; // 星が流れる高さ（棚の間）
const BALLOON_COLORS = [P.red, P.teal, P.gold] as const;
const POINTS = { balloon: 10, can: 20, star: 30, shiba: 100 } as const;
const MAX_COMBO_STEPS = 10; // コンボ倍率の上限段数（最大×2.0）

/** ウェーブ設定（30秒を3分割）。size=的サイズ係数 / speed=揺れ・流れ速度係数 / mult=得点倍率 */
const WAVES = [
  { size: 1, speed: 1, mult: 1 },
  { size: 0.85, speed: 1.3, mult: 1.5 },
  { size: 0.7, speed: 1.6, mult: 2 },
] as const;
const SHIBA_MAX_SPAWNS = 2; // 金のしばは1ゲーム計2回まで

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

type Shiba = {
  alive: boolean;
  x: number;
  vx: number; // 基準速度。ウェーブ速度係数はupdate側で乗算
  seed: number;
  spawnsLeft: number;
  nextAt: number; // aliveでない時、この時刻(秒)以降に出現可
};

type WaveBanner = { text: string; sub: string; start: number; until: number };

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

/** ドラッグ照準。fx/fyは指の生座標（照準位置は-70px+手ブレで導出） */
type Aim = {
  active: boolean;
  pointerId: number;
  fx: number;
  fy: number;
  phase: number; // 手ブレ揺れの位相（ドラッグ開始ごとにランダム）
};

/** 飛翔中のコルク（下端→着弾点へ直線補間） */
type Cork = {
  active: boolean;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  start: number;
};

type Reload = { active: boolean; start: number };

/* ============================== 純関数ヘルパー ============================== */

let genSeed = 1;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

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

/** 経過秒→ウェーブindex(0..2) */
function waveIndexAt(elapsed: number): number {
  return elapsed >= 20 ? 2 : elapsed >= 10 ? 1 : 0;
}

/** コンボ倍率 = 1 + 0.1 × min(combo - 1, 10)（最大×2.0） */
function comboMultiplier(combo: number): number {
  return 1 + 0.1 * Math.min(Math.max(combo, 1) - 1, MAX_COMBO_STEPS);
}

/** 的の現在の中心座標（描画と当たり判定で共有）。speedK=揺れ速度係数 sizeK=サイズ係数 */
function slotCenter(
  t: SlotTarget,
  now: number,
  speedK: number,
  sizeK: number,
): { x: number; y: number } {
  const baseX = SLOT_XS[t.slot];
  const shelfY = SHELF_YS[t.shelf];
  if (t.kind === "balloon") {
    return {
      x: baseX + Math.sin(now * 1.4 * speedK + t.phase) * 7,
      y: shelfY - 58 + Math.sin(now * 2.2 * speedK + t.phase) * 3,
    };
  }
  // 缶: たまに小刻みに揺れる（縮んでも棚に接地させる）
  const cycle = (now * speedK + t.phase * 1.7) % 4.2;
  const jiggle = cycle < 0.3 ? Math.sin(now * 45) * 1.5 : 0;
  return { x: baseX + jiggle, y: shelfY - 20 * sizeK };
}

function starPos(star: Star, now: number): { x: number; y: number } {
  return { x: star.x, y: STAR_Y + Math.sin(now * 3 + star.seed) * 8 };
}

/** 金のしばのy（棚の間を小走りで横切る） */
function shibaY(now: number): number {
  return STAR_Y + 4 - Math.abs(Math.sin(now * 9)) * 5;
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
  if (score >= 500) return "射的マスター！";
  if (score >= 300) return "いい腕前！";
  if (score >= 100) return "もうちょい！";
  return "また挑戦してね";
}

function burst(
  list: Confetti[],
  x: number,
  y: number,
  colors: string[],
  count = 14,
): void {
  for (let i = 0; i < count; i++) {
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
  speedK: number,
  sizeK: number,
): void {
  const c = slotCenter(t, now, speedK, sizeK);
  const anchorX = SLOT_XS[t.slot];
  const shelfY = SHELF_YS[t.shelf];
  // ひも
  ctx.strokeStyle = "rgba(251,240,218,.55)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y + 26 * sizeK);
  ctx.quadraticCurveTo(anchorX + (c.x - anchorX) * 0.4, (c.y + shelfY) / 2 + 8, anchorX, shelfY);
  ctx.stroke();
  // 結び目
  paperPoly(
    ctx,
    [
      [c.x - 5 * sizeK, c.y + 28 * sizeK],
      [c.x + 5 * sizeK, c.y + 28 * sizeK],
      [c.x, c.y + 20 * sizeK],
    ],
    { fill: t.color, seed: t.seed + 1, jitter: 0.8, shadow: "" },
  );
  // 本体
  paperCircle(ctx, c.x, c.y, 24 * sizeK, {
    fill: t.color,
    seed: t.seed,
    jitter: 1.6,
    shadowDy: 4,
  });
  // ハイライト
  ctx.fillStyle = "rgba(251,240,218,.45)";
  ctx.beginPath();
  ctx.ellipse(
    c.x - 8 * sizeK,
    c.y - 8 * sizeK,
    6 * sizeK,
    9 * sizeK,
    -0.5,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

function drawCan(
  ctx: CanvasRenderingContext2D,
  t: SlotTarget,
  now: number,
  speedK: number,
  sizeK: number,
): void {
  const c = slotCenter(t, now, speedK, sizeK);
  const k = sizeK;
  // 本体 32x40
  paperRect(ctx, c.x - 16 * k, c.y - 20 * k, 32 * k, 40 * k, {
    fill: P.teal,
    seed: t.seed,
    jitter: 1.8,
    shadowDy: 4,
  });
  // 上蓋
  paperRect(ctx, c.x - 15 * k, c.y - 21 * k, 30 * k, 5 * k, {
    fill: P.tealDeep,
    seed: t.seed + 3,
    jitter: 1,
    shadow: "",
  });
  // 紙ラベル
  paperRect(ctx, c.x - 16 * k, c.y - 7 * k, 32 * k, 14 * k, {
    fill: P.paper,
    seed: t.seed + 1,
    jitter: 1.2,
    shadow: "",
  });
  // ラベルの丸マーク
  paperCircle(ctx, c.x, c.y, 4.2 * k, {
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
  sizeK: number,
): void {
  paperPoly(ctx, starPts(pos.x, pos.y, 17 * sizeK, 7.5 * sizeK, now * 2.4), {
    fill: P.gold,
    seed: 400 + seed,
    jitter: 1,
    edge: P.paper,
    edgeWidth: 1.8,
    shadowDy: 3,
  });
  paperCircle(ctx, pos.x, pos.y, 3.5 * sizeK, {
    fill: P.goldDeep,
    seed: 401 + seed,
    jitter: 0.5,
    shadow: "",
  });
}

/** 金のしば（丸い頭+三角耳2つ+小さい体のシンプルな犬シルエット）。進行方向を向く */
function drawShiba(
  ctx: CanvasRenderingContext2D,
  shiba: Shiba,
  y: number,
): void {
  const dir = shiba.vx >= 0 ? 1 : -1;
  const s = shiba.seed;
  ctx.save();
  ctx.translate(shiba.x, y);
  ctx.scale(dir, 1);
  // しっぽ（三角で簡略化）
  paperPoly(
    ctx,
    [
      [-22, -4],
      [-30, -15],
      [-18, -11],
    ],
    { fill: P.goldDeep, seed: s + 5, jitter: 1, shadow: "" },
  );
  // 小さい体
  paperRect(ctx, -22, -8, 30, 19, {
    fill: P.gold,
    seed: s + 1,
    jitter: 1.6,
    shadowDy: 3,
  });
  // 脚
  paperRect(ctx, -18, 9, 6, 7, { fill: P.goldDeep, seed: s + 6, jitter: 0.8, shadow: "" });
  paperRect(ctx, -2, 9, 6, 7, { fill: P.goldDeep, seed: s + 7, jitter: 0.8, shadow: "" });
  // 三角耳 ×2
  paperPoly(
    ctx,
    [
      [4, -16],
      [8, -28],
      [13, -16],
    ],
    { fill: P.goldDeep, seed: s + 3, jitter: 1, shadow: "" },
  );
  paperPoly(
    ctx,
    [
      [13, -15],
      [18, -27],
      [22, -14],
    ],
    { fill: P.goldDeep, seed: s + 4, jitter: 1, shadow: "" },
  );
  // 丸い頭
  paperCircle(ctx, 13, -8, 11, {
    fill: P.gold,
    seed: s + 2,
    jitter: 1.2,
    edge: P.paper,
    edgeWidth: 1.6,
    shadowDy: 3,
  });
  // マズル
  paperCircle(ctx, 19, -4, 4, { fill: P.paper, seed: s + 8, jitter: 0.6, shadow: "" });
  // 目・鼻
  ctx.fillStyle = P.ink;
  ctx.beginPath();
  ctx.arc(12, -10, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(21, -6, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 照準上のコンボ紙タグ「5 COMBO ×1.5」。popでヒット直後に少し膨らむ */
function drawComboTag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  combo: number,
  pop: number,
): void {
  const label = `${combo} COMBO ×${comboMultiplier(combo).toFixed(1)}`;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  ctx.rotate(-0.05);
  ctx.font = '900 13px "Zen Maru Gothic", sans-serif';
  const w = ctx.measureText(label).width + 18;
  paperRect(ctx, -w / 2, -12, w, 24, {
    fill: P.paper,
    seed: 777,
    jitter: 1.3,
    shadowDy: 3,
  });
  ctx.fillStyle = P.red;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

/** ウェーブ切替の紙タグ演出（1秒・ポップイン→フェードアウト） */
function drawWaveBanner(
  ctx: CanvasRenderingContext2D,
  banner: WaveBanner,
  now: number,
): void {
  const t = (now - banner.start) / (banner.until - banner.start);
  if (t < 0 || t >= 1) return;
  const popIn = Math.min(1, t / 0.12);
  const scale = 0.7 + 0.3 * popIn + (t < 0.2 ? Math.sin((t / 0.2) * Math.PI) * 0.06 : 0);
  const alpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(W / 2, H * 0.42);
  ctx.scale(scale, scale);
  ctx.rotate(-0.03);
  paperRect(ctx, -110, -44, 220, 88, {
    fill: P.paper,
    seed: 888,
    jitter: 2.4,
    shadowDy: 6,
  });
  paperRect(ctx, -110, -44, 220, 10, {
    fill: P.red,
    seed: 889,
    jitter: 1.5,
    shadow: "",
  });
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = P.indigo;
  ctx.font = '900 34px "Zen Maru Gothic", sans-serif';
  ctx.fillText(banner.text, 0, -4);
  ctx.fillStyle = P.red;
  ctx.font = '900 15px "Zen Maru Gothic", sans-serif';
  ctx.fillText(banner.sub, 0, 26);
  ctx.restore();
  ctx.globalAlpha = 1;
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

/** 飛翔中のコルク（クラフト紙色の小円・奥へ飛ぶほど縮む） */
function drawCork(ctx: CanvasRenderingContext2D, cork: Cork, now: number): void {
  const t = clamp((now - cork.start) / CORK_FLIGHT, 0, 1);
  const x = cork.sx + (cork.tx - cork.sx) * t;
  const y = cork.sy + (cork.ty - cork.sy) * t;
  const scale = 1 - 0.45 * t; // 1.0 → 0.55
  paperCircle(ctx, x, y, 7 * scale, {
    fill: P.kraftLight,
    seed: 940,
    jitter: 0.8,
    edge: P.kraftDeep,
    edgeWidth: 1.2,
    shadowDy: 2,
  });
}

/** 左上の残弾表示（コルク6個。使った分は空枠）。下側だと操作中の指で隠れる */
function drawAmmo(ctx: CanvasRenderingContext2D, ammo: number): void {
  for (let i = 0; i < MAX_AMMO; i++) {
    const x = 26 + i * 24;
    const y = 174;
    if (i < ammo) {
      paperCircle(ctx, x, y, 7, {
        fill: P.kraftLight,
        seed: 950 + i,
        jitter: 0.8,
        edge: P.kraftDeep,
        edgeWidth: 1.2,
        shadowDy: 2,
      });
    } else {
      ctx.strokeStyle = "rgba(251,240,218,.4)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** 右下のリロードボタン（クラフト紙の丸 + 進捗の弧）。emphasize=残弾0を促す強調 */
function drawReloadButton(
  ctx: CanvasRenderingContext2D,
  now: number,
  reload: Reload,
  emphasize: boolean,
): void {
  const scale = emphasize ? 1 + 0.14 * Math.abs(Math.sin(now * 8)) : 1;
  ctx.save();
  ctx.translate(RELOAD_BTN.x, RELOAD_BTN.y);
  ctx.scale(scale, scale);
  paperCircle(ctx, 0, 0, 30, {
    fill: P.kraftLight,
    seed: 970,
    jitter: 1.6,
    edge: emphasize ? P.red : P.kraftDeep,
    edgeWidth: emphasize ? 3 : 1.6,
    shadowDy: 4,
  });
  ctx.fillStyle = emphasize ? P.red : P.indigo;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '900 10px "Zen Maru Gothic", sans-serif';
  ctx.fillText("リロード", 0, 1);
  if (reload.active) {
    const frac = clamp((now - reload.start) / RELOAD_TIME, 0, 1);
    ctx.strokeStyle = P.red;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 24, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/* ============================== コンポーネント ============================== */

export default function ShootingGame() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(GAME_SECONDS);
  const [maxCombo, setMaxCombo] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("ready");
  const scoreRef = useRef(0);
  const secondsShownRef = useRef(GAME_SECONDS);
  const startAtRef = useRef(0);
  const endAtRef = useRef(0);
  const aimRef = useRef<Aim>({
    active: false,
    pointerId: -1,
    fx: W / 2,
    fy: H * 0.6,
    phase: 0,
  });
  const corkRef = useRef<Cork>({
    active: false,
    sx: 0,
    sy: H,
    tx: 0,
    ty: 0,
    start: 0,
  });
  const ammoRef = useRef(MAX_AMMO);
  const reloadRef = useRef<Reload>({ active: false, start: 0 });
  const emptyFlashUntilRef = useRef(-1e9); // 残弾0発射でこの時刻までボタン強調
  const targetsRef = useRef<SlotTarget[]>([]);
  const starRef = useRef<Star>({
    alive: false,
    x: -40,
    vx: 170,
    seed: 3,
    respawnAt: 0,
  });
  const shibaRef = useRef<Shiba>({
    alive: false,
    x: -60,
    vx: 260,
    seed: 0,
    spawnsLeft: 0,
    nextAt: 0,
  });
  const waveRef = useRef(0); // WAVES のindex(0..2)
  const waveBannerRef = useRef<WaveBanner | null>(null);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const comboHitAtRef = useRef(-1e9); // タグのポップ演出用
  const confettiRef = useRef<Confetti[]>([]);
  const holesRef = useRef<Hole[]>([]);

  const startGame = () => {
    ensureAudio();
    sfx.tap();
    const now = performance.now() / 1000;
    startAtRef.current = now;
    endAtRef.current = now + GAME_SECONDS;
    scoreRef.current = 0;
    setScore(0);
    secondsShownRef.current = GAME_SECONDS;
    setSecondsLeft(GAME_SECONDS);
    aimRef.current = { active: false, pointerId: -1, fx: W / 2, fy: H * 0.6, phase: 0 };
    corkRef.current = { active: false, sx: 0, sy: H, tx: 0, ty: 0, start: 0 };
    ammoRef.current = MAX_AMMO;
    reloadRef.current = { active: false, start: 0 };
    emptyFlashUntilRef.current = -1e9;
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
    shibaRef.current = {
      alive: false,
      x: -60,
      vx: 260,
      seed: Math.floor(Math.random() * 1000),
      spawnsLeft: SHIBA_MAX_SPAWNS,
      nextAt: now + 11 + Math.random() * 6, // WAVE2に入って少ししてから
    };
    waveRef.current = 0;
    waveBannerRef.current = null;
    comboRef.current = 0;
    maxComboRef.current = 0;
    setMaxCombo(0);
    comboHitAtRef.current = -1e9;
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

    /** 指の生座標→照準の基準位置（70px上・ステージ内にクランプ） */
    const aimBase = () => ({
      x: clamp(aimRef.current.fx, 0, W),
      y: clamp(aimRef.current.fy - AIM_OFFSET_Y, 0, H),
    });

    /** 手ブレ揺れ込みの照準位置（押している間ずっと揺れる） */
    const aimShaken = (now: number) => {
      const b = aimBase();
      const ph = aimRef.current.phase;
      return {
        x: b.x + Math.sin(now * 1.7 + ph) * 6,
        y: b.y + Math.cos(now * 2.3 + ph) * 5,
      };
    };

    /** コルク着弾時のヒット判定（consider方式・的中心との距離） */
    const resolveImpact = (x: number, y: number, now: number) => {
      if (phaseRef.current !== "playing") return;

      const wave = WAVES[waveRef.current];

      // ヒット共通処理: コンボ更新 → 得点 = round(基礎点 × ウェーブ倍率 × コンボ倍率)
      const registerHit = (base: number) => {
        comboRef.current += 1;
        comboHitAtRef.current = now;
        if (comboRef.current > maxComboRef.current) {
          maxComboRef.current = comboRef.current;
          setMaxCombo(comboRef.current);
        }
        addScore(Math.round(base * wave.mult * comboMultiplier(comboRef.current)));
      };

      type Hit = { dist: number; apply: () => void };
      let best: Hit | null = null;
      const consider = (dist: number, limit: number, apply: () => void) => {
        if (dist <= limit && (best === null || dist < best.dist)) {
          best = { dist, apply };
        }
      };

      const shiba = shibaRef.current;
      if (shiba.alive) {
        const sy = shibaY(now);
        consider(Math.hypot(x - shiba.x, y - sy), 27, () => {
          shiba.alive = false;
          shiba.nextAt = now + 2.5 + Math.random() * 5;
          registerHit(POINTS.shiba);
          burst(
            confettiRef.current,
            shiba.x,
            sy,
            [P.gold, P.goldDeep, P.paper, P.red],
            32,
          );
          sfx.bigHit();
        });
      }
      const star = starRef.current;
      if (star.alive) {
        const sp = starPos(star, now);
        consider(Math.hypot(x - sp.x, y - sp.y), 24 * wave.size, () => {
          star.alive = false;
          star.respawnAt = now + RESPAWN_DELAY;
          registerHit(POINTS.star);
          burst(confettiRef.current, sp.x, sp.y, [P.gold, P.paper, P.goldDeep]);
          sfx.bigHit();
        });
      }
      for (const t of targetsRef.current) {
        if (!t.alive) continue;
        const c = slotCenter(t, now, wave.speed, wave.size);
        consider(
          Math.hypot(x - c.x, y - c.y),
          (t.kind === "balloon" ? 27 : 26) * wave.size,
          () => {
            t.alive = false;
            t.respawnAt = now + RESPAWN_DELAY;
            registerHit(POINTS[t.kind]);
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
        // ミス: コンボ切れ + 小さな紙の穴のみ（連射で耳障りなので無音）
        comboRef.current = 0;
        holesRef.current.push({ x, y, until: now + 0.5 });
      }
    };

    const onDown = (e: PointerEvent) => {
      if (phaseRef.current !== "playing") return;
      const p = toLogical(e);
      const now = performance.now() / 1000;
      // リロードボタン領域: 照準を出さずにリロード開始
      if (Math.hypot(p.x - RELOAD_BTN.x, p.y - RELOAD_BTN.y) <= RELOAD_BTN.r) {
        if (!reloadRef.current.active && ammoRef.current < MAX_AMMO) {
          reloadRef.current = { active: true, start: now };
          sfx.tap();
        }
        return;
      }
      if (aimRef.current.active) return; // 2本目の指は無視
      aimRef.current = {
        active: true,
        pointerId: e.pointerId,
        fx: p.x,
        fy: p.y,
        phase: Math.random() * Math.PI * 2,
      };
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* 一部環境でcapture不可でも動作継続 */
      }
    };

    const onMove = (e: PointerEvent) => {
      const aim = aimRef.current;
      if (!aim.active || aim.pointerId !== e.pointerId) return;
      const p = toLogical(e);
      aim.fx = p.x;
      aim.fy = p.y;
    };

    const onUp = (e: PointerEvent) => {
      const aim = aimRef.current;
      if (!aim.active || aim.pointerId !== e.pointerId) return;
      const p = toLogical(e);
      aim.fx = p.x;
      aim.fy = p.y;
      aim.active = false;
      if (phaseRef.current !== "playing") return;
      // リロード中・コルク飛翔中は発射不可
      if (reloadRef.current.active || corkRef.current.active) return;
      const now = performance.now() / 1000;
      if (ammoRef.current <= 0) {
        // 弾切れ: 発射せずリロードボタンを1秒強調して促す
        emptyFlashUntilRef.current = now + 1;
        return;
      }
      // 発射: 離した瞬間の照準位置（手ブレ込み）+ 弾道落下14px が着弾点
      const pos = aimShaken(now);
      ammoRef.current -= 1;
      sfx.whoosh();
      corkRef.current = {
        active: true,
        sx: pos.x,
        sy: H,
        tx: clamp(pos.x, 0, W),
        ty: clamp(pos.y + DROP_Y, 0, H),
        start: now,
      };
    };

    const onCancel = (e: PointerEvent) => {
      // 中断: 発射せず照準を消すだけ
      const aim = aimRef.current;
      if (aim.active && aim.pointerId === e.pointerId) aim.active = false;
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

      // リロード進行（1.2秒で残弾6に）
      const reload = reloadRef.current;
      if (reload.active && now - reload.start >= RELOAD_TIME) {
        reload.active = false;
        ammoRef.current = MAX_AMMO;
        sfx.hit();
      }

      // コルク飛翔（0.18秒で着弾→ヒット判定）
      const cork = corkRef.current;
      if (cork.active && now - cork.start >= CORK_FLIGHT) {
        cork.active = false;
        resolveImpact(cork.tx, cork.ty, now);
      }

      // ウェーブ進行（30秒を3分割）
      const waveIdx = waveIndexAt(now - startAtRef.current);
      if (waveIdx !== waveRef.current) {
        waveRef.current = waveIdx;
        waveBannerRef.current = {
          text: `WAVE ${waveIdx + 1}`,
          sub: `スコア ×${WAVES[waveIdx].mult.toFixed(1)}`,
          start: now,
          until: now + 1,
        };
        sfx.hit();
      }
      const speedK = WAVES[waveRef.current].speed;

      // 星（棚の間を左右に流れる・最大1個）
      const star = starRef.current;
      if (star.alive) {
        star.x += star.vx * speedK * dt;
        if (star.vx > 0 && star.x > W + 40) star.x = -40;
        if (star.vx < 0 && star.x < -40) star.x = W + 40;
      } else if (now >= star.respawnAt) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        star.alive = true;
        star.vx = dir * (150 + Math.random() * 50);
        star.x = dir > 0 ? -30 : W + 30;
        star.seed = Math.floor(Math.random() * 1000);
      }

      // 金のしば（WAVE2以降・計2回まで・星より速く一度だけ横切る）
      const shiba = shibaRef.current;
      if (shiba.alive) {
        shiba.x += shiba.vx * speedK * dt;
        if (
          (shiba.vx > 0 && shiba.x > W + 60) ||
          (shiba.vx < 0 && shiba.x < -60)
        ) {
          shiba.alive = false;
          shiba.nextAt = now + 2.5 + Math.random() * 5;
        }
      } else if (
        shiba.spawnsLeft > 0 &&
        waveRef.current >= 1 &&
        now >= shiba.nextAt
      ) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        shiba.alive = true;
        shiba.spawnsLeft -= 1;
        shiba.vx = dir * (240 + Math.random() * 60);
        shiba.x = dir > 0 ? -50 : W + 50;
        shiba.seed = Math.floor(Math.random() * 1000);
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

      const wave = WAVES[waveRef.current];
      for (const t of targetsRef.current) {
        if (!t.alive) continue;
        if (t.kind === "balloon") drawBalloon(ctx, t, now, wave.speed, wave.size);
        else drawCan(ctx, t, now, wave.speed, wave.size);
      }
      const star = starRef.current;
      if (star.alive) drawStar(ctx, starPos(star, now), star.seed, now, wave.size);
      const shiba = shibaRef.current;
      if (shiba.alive) drawShiba(ctx, shiba, shibaY(now));

      drawConfetti(ctx, confettiRef.current);
      drawHoles(ctx, holesRef.current);

      if (phaseRef.current === "playing") {
        // 残弾（左下）+ リロードボタン（右下）
        drawAmmo(ctx, ammoRef.current);
        drawReloadButton(
          ctx,
          now,
          reloadRef.current,
          now < emptyFlashUntilRef.current,
        );

        // 飛翔中のコルク
        if (corkRef.current.active) drawCork(ctx, corkRef.current, now);

        // 照準は押している間だけ表示（手ブレ揺れ込み）
        if (aimRef.current.active) {
          const pos = aimShaken(now);
          drawReticle(ctx, pos.x, pos.y, corkRef.current.active ? 0.8 : 1);
          // 照準の少し上にコンボ紙タグ（コンボ2以上・ヒット直後に少しポップ）
          if (comboRef.current >= 2) {
            const pop =
              1 + 0.35 * Math.max(0, 1 - (now - comboHitAtRef.current) / 0.25);
            const tx = Math.min(W - 70, Math.max(70, pos.x));
            const ty = pos.y > 70 ? pos.y - 46 : pos.y + 52;
            drawComboTag(ctx, tx, ty, comboRef.current, pop);
          }
        }
      }

      const banner = waveBannerRef.current;
      if (banner && now < banner.until) drawWaveBanner(ctx, banner, now);
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

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
    };
  }, []);

  /* オーバーレイ */
  let overlay: ReactNode = null;
  if (phase === "ready") {
    overlay = (
      <div className="torn max-w-xs border-[3px] border-kraft-paper bg-kraft paper-grain p-6 text-center text-fes-ink shadow-paper">
        <h2 className="font-maru text-2xl font-black text-fes-indigo">🎯 射的</h2>
        <p className="mt-3 font-maru text-sm font-bold">
          ドラッグでねらって、はなして発射！ 弾はすこし下に落ちる
        </p>
        <p className="mt-2 font-maru text-xs font-bold text-fes-ink/70">
          コルクは6発。リロードボタンで装填
          <br />
          連続ヒットでコンボ倍率がどんどんUP（最大×2）
          <br />
          後半ほど的が小さく速くなって高得点（WAVE2 ×1.5 / WAVE3 ×2）
          <br />
          風船10点・缶20点・星30点・金のしば100点！
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
        <p className="mt-1 font-maru text-sm font-bold text-fes-ink/80">
          最大コンボ {maxCombo}
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
      tagline="ドラッグでねらって、はなして発射！"
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
