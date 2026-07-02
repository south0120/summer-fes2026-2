"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import GameShell from "@/components/game/GameShell";
import { P } from "@/components/game/palette";
import {
  paperCircle,
  paperPoly,
  paperRect,
  seededJitter,
} from "@/components/game/paper";
import { ensureAudio, sfx } from "@/components/game/audio";

/* ================= 定数 ================= */

const W = 480;
const H = 640;
const GAME_TIME = 60;
const POI_MAX = 3;
const POI_R = 42;
// ポイの丸は指のこのpx分上に出す（指で隠れないように）。持ち手は真下＝利き手を問わない
const POI_OFFSET_Y = 70;
const FLIGHT_T = 0.9; // 捕獲後、金魚鉢へ飛ぶ時間
const RESPAWN_DELAY = 2.4;
const BOWL = { x: W - 62, y: 62 };

type Phase = "ready" | "playing" | "result";
type FishKind = "red" | "black" | "gold" | "rainbow";
type EndReason = "time" | "poi";

// 難化・レア魚・倍率まわりの定数
const DIFF_MAX_BONUS = 0.5; // 終盤の速度倍率 = 1 + 0.5
const MIX_SHIFT_AT = 30; // この経過秒以降は補充比率を変える
const RAINBOW_LIFETIME = 6; // 虹金魚の滞在秒数
const POI_BONUS_PER = 20; // 残ポイ1枚あたりのボーナス

type FishDef = {
  points: number;
  speed: number;
  turn: number;
  catchRate: number;
  size: number;
  body: string;
  tail: string;
  count: number;
};

const FISH_DEF: Record<FishKind, FishDef> = {
  red: { points: 10, speed: 62, turn: 2.4, catchRate: 1, size: 17, body: P.red, tail: P.redDeep, count: 4 },
  black: { points: 20, speed: 108, turn: 3.4, catchRate: 0.7, size: 16, body: P.ink, tail: "#29201C", count: 2 },
  gold: { points: 30, speed: 152, turn: 4.2, catchRate: 0.5, size: 13, body: P.gold, tail: P.goldDeep, count: 1 },
  // レア虹金魚: 経過20秒・40秒付近に出現、約6秒で退場（count 0 = 初期配置なし）
  rainbow: { points: 50, speed: 188, turn: 5, catchRate: 0.4, size: 11, body: P.red, tail: P.teal, count: 0 },
};

type Fish = {
  id: number;
  kind: FishKind;
  x: number;
  y: number;
  tx: number;
  ty: number;
  angle: number;
  phase: number;
  speedMul: number;
  state: "swim" | "flee" | "caught";
  stateT: number;
  fx: number; // 捕獲時の出発点
  fy: number;
  entering: boolean; // 画面外から入場中
  leaving: boolean; // 画面外へ退場中（虹金魚）
  leaveAt: number; // 退場を始める経過秒（0 = 退場しない）
  seed: number;
};

type Ring = { x: number; y: number; r: number; vr: number; alpha: number };
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

type Sim = {
  phase: Phase;
  t: number; // 経過シミュ時間
  time: number; // 残り秒
  score: number;
  poiLeft: number;
  poiDamage: number;
  poiBrokenT: number; // >0 の間は破れ演出中で操作不可
  caught: FishKind[]; // スコア・内訳（すくった瞬間に確定）
  bowl: FishKind[]; // 金魚鉢のアイコン（着水した魚）
  fishes: Fish[];
  respawns: { kind: FishKind; at: number }[];
  rainbowAt: number[]; // 虹金魚の出現予定（経過秒・昇順）
  poiBonus: number; // 時間切れ時の残ポイボーナス（結果表示用）
  ptr: { x: number; y: number; on: boolean; down: boolean };
  rings: Ring[];
  scraps: Scrap[];
  pops: Pop[]; // 紙タグポップ（2匹どり！等）
  nextId: number;
};

type Ui = {
  phase: Phase;
  score: number;
  sec: number;
  poiLeft: number;
  poiBonus: number;
  counts: Record<FishKind, number>;
};

/* ================= シミュレーション ================= */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function pickTarget(f: Fish): void {
  f.tx = 50 + Math.random() * (W - 100);
  f.ty = 90 + Math.random() * (H - 150);
}

function spawnFish(kind: FishKind, id: number, fromEdge: boolean): Fish {
  let x: number;
  let y: number;
  if (fromEdge) {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) {
      x = -24;
      y = 90 + Math.random() * (H - 180);
    } else if (side === 1) {
      x = W + 24;
      y = 90 + Math.random() * (H - 180);
    } else if (side === 2) {
      x = 70 + Math.random() * (W - 140);
      y = -24;
    } else {
      x = 70 + Math.random() * (W - 140);
      y = H + 24;
    }
  } else {
    x = 60 + Math.random() * (W - 120);
    y = 130 + Math.random() * (H - 210);
  }
  const f: Fish = {
    id,
    kind,
    x,
    y,
    tx: 0,
    ty: 0,
    angle: 0,
    phase: Math.random() * Math.PI * 2,
    speedMul: 0.9 + Math.random() * 0.25,
    state: "swim",
    stateT: 0,
    fx: 0,
    fy: 0,
    entering: fromEdge,
    leaving: false,
    leaveAt: 0,
    seed: id * 17 + 3,
  };
  pickTarget(f);
  f.angle = Math.atan2(f.ty - f.y, f.tx - f.x);
  return f;
}

function makeSim(): Sim {
  const fishes: Fish[] = [];
  let id = 1;
  (Object.keys(FISH_DEF) as FishKind[]).forEach((kind) => {
    for (let i = 0; i < FISH_DEF[kind].count; i++) {
      fishes.push(spawnFish(kind, id++, false));
    }
  });
  return {
    phase: "ready",
    t: 0,
    time: GAME_TIME,
    score: 0,
    poiLeft: POI_MAX,
    poiDamage: 0,
    poiBrokenT: 0,
    caught: [],
    bowl: [],
    fishes,
    respawns: [],
    // 20秒付近と40秒付近に1回ずつ（±1秒ゆらぎ）
    rainbowAt: [19 + Math.random() * 2, 39 + Math.random() * 2],
    poiBonus: 0,
    ptr: { x: W / 2, y: H / 2, on: false, down: false },
    rings: [],
    scraps: [],
    pops: [],
    nextId: id,
  };
}

function endGame(s: Sim, reason: EndReason): void {
  if (s.phase === "result") return;
  s.phase = "result";
  s.ptr.down = false;
  // ポイ残しボーナス: 時間切れ終了時のみ（ポイ全滅なら0）
  if (reason === "time" && s.poiLeft > 0) {
    s.poiBonus = s.poiLeft * POI_BONUS_PER;
    s.score += s.poiBonus;
  }
  sfx.finish();
}

function moveFish(f: Fish, dt: number, speedFactor: number): void {
  const def = FISH_DEF[f.kind];
  let speed = def.speed * f.speedMul * speedFactor;
  let turn = def.turn;
  if (f.state === "flee") {
    speed *= 2.5;
    turn *= 2.4;
    f.stateT -= dt;
    if (f.stateT <= 0) {
      f.state = "swim";
      pickTarget(f);
    }
  }
  const dx = f.tx - f.x;
  const dy = f.ty - f.y;
  if (!f.leaving && dx * dx + dy * dy < 900) pickTarget(f);
  const want = Math.atan2(f.ty - f.y, f.tx - f.x);
  let diff = want - f.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  f.angle += clamp(diff, -turn * dt, turn * dt);
  f.x += Math.cos(f.angle) * speed * dt;
  f.y += Math.sin(f.angle) * speed * dt;
  const M = 24;
  if (f.entering) {
    if (f.x > M && f.x < W - M && f.y > M && f.y < H - M) f.entering = false;
  } else if (
    !f.leaving &&
    (f.x < M || f.x > W - M || f.y < M || f.y > H - M)
  ) {
    f.x = clamp(f.x, M, W - M);
    f.y = clamp(f.y, M, H - M);
    pickTarget(f);
  }
  f.phase += dt * (5 + speed * 0.055);
}

function spawnScraps(s: Sim, x: number, y: number): void {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 120;
    s.scraps.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 10,
      life: 0.55 + Math.random() * 0.25,
      color: i % 2 === 0 ? P.kraftLight : P.paper,
    });
  }
}

/** pointerup: すくい動作の解決 */
function scoop(s: Sim): void {
  if (s.phase !== "playing" || s.poiBrokenT > 0) return;
  sfx.whoosh();
  const { x, y } = s.ptr;
  let hits = 0;
  let fails = 0;
  let basePts = 0;
  let gotGold = false;
  let gotRainbow = false;
  for (const f of s.fishes) {
    if (f.state === "caught") continue;
    const d2 = (f.x - x) ** 2 + (f.y - y) ** 2;
    if (d2 > POI_R * POI_R) continue;
    const def = FISH_DEF[f.kind];
    if (Math.random() < def.catchRate) {
      f.state = "caught";
      f.stateT = 0;
      f.fx = f.x;
      f.fy = f.y;
      basePts += def.points;
      s.caught.push(f.kind);
      hits++;
      if (f.kind === "gold") gotGold = true;
      if (f.kind === "rainbow") gotRainbow = true;
    } else {
      f.state = "flee";
      f.stateT = 1.15;
      const away = Math.atan2(f.y - y, f.x - x) + seededJitter(f.seed, 1, 0.5);
      f.tx = clamp(f.x + Math.cos(away) * 260, 30, W - 30);
      f.ty = clamp(f.y + Math.sin(away) * 260, 30, H - 30);
      fails++;
    }
  }
  // 一網打尽倍率: 2匹 → ×1.5 / 3匹以上 → ×2
  const mult = hits >= 3 ? 2 : hits === 2 ? 1.5 : 1;
  s.score += Math.round(basePts * mult);
  // 紙タグポップ（ポイ位置の少し上に積む）
  let popY = y - POI_R - 20;
  const addPop = (text: string) => {
    s.pops.push({
      x: clamp(x, 84, W - 84),
      y: clamp(popY, 48, H - 40),
      text,
      life: 1.15,
      maxLife: 1.15,
      seed: s.nextId * 7 + s.pops.length * 13,
    });
    popY -= 36;
  };
  if (gotRainbow) addPop("虹金魚！+50");
  if (hits === 2) addPop("2匹どり！×1.5");
  else if (hits >= 3) addPop(`${hits}匹どり！×2`);
  if (hits > 0) {
    if (gotGold || gotRainbow || hits >= 2) sfx.bigHit();
    else sfx.hit();
  } else if (fails > 0) {
    sfx.miss();
  }
  s.rings.push({ x, y, r: POI_R * 0.6, vr: 140, alpha: 0.5 });
  // 膜ダメージ（成功失敗・空振り問わず +1）
  s.poiDamage++;
  if (s.poiDamage >= 3) {
    sfx.pop();
    s.poiLeft--;
    s.poiBrokenT = 0.55;
    spawnScraps(s, x, y);
  }
}

function update(s: Sim, dt: number): void {
  s.t += dt;
  const elapsed = clamp(GAME_TIME - s.time, 0, GAME_TIME);
  // 時間経過で難化: 遊泳速度倍率 1 → 1.5（プレイ中のみ）
  const speedFactor =
    s.phase === "playing" ? 1 + DIFF_MAX_BONUS * (elapsed / GAME_TIME) : 1;

  if (s.phase === "playing") {
    const prevSec = Math.ceil(s.time);
    s.time -= dt;
    const sec = Math.max(0, Math.ceil(s.time));
    if (sec !== prevSec && sec <= 5 && sec >= 1) sfx.tick();
    if (s.time <= 0) endGame(s, "time");

    if (s.poiBrokenT > 0) {
      s.poiBrokenT -= dt;
      if (s.poiBrokenT <= 0) {
        if (s.poiLeft <= 0) endGame(s, "poi");
        else s.poiDamage = 0; // 新しいポイ支給
      }
    }

    // 補充（画面端から）
    if (s.respawns.length > 0) {
      const due = s.respawns.filter((r) => r.at <= s.t);
      if (due.length > 0) {
        s.respawns = s.respawns.filter((r) => r.at > s.t);
        for (const r of due) s.fishes.push(spawnFish(r.kind, s.nextId++, true));
      }
    }

    // 虹金魚の出現（経過20秒・40秒付近）
    while (s.rainbowAt.length > 0 && elapsed >= s.rainbowAt[0]) {
      s.rainbowAt.shift();
      const rb = spawnFish("rainbow", s.nextId++, true);
      rb.leaveAt = elapsed + RAINBOW_LIFETIME;
      s.fishes.push(rb);
    }
  }

  // 魚（ready/result 中も背景で泳がせる）
  for (let i = s.fishes.length - 1; i >= 0; i--) {
    const f = s.fishes[i];
    if (f.state === "caught") {
      f.stateT += dt;
      if (f.stateT >= FLIGHT_T) {
        s.bowl.push(f.kind);
        if (f.kind !== "rainbow") {
          // 経過30秒以降の補充はデメキン/金の比率を上げる
          let kind: FishKind = f.kind;
          if (elapsed >= MIX_SHIFT_AT) {
            const r = Math.random();
            kind = r < 0.4 ? "red" : r < 0.75 ? "black" : "gold";
          }
          s.respawns.push({ kind, at: s.t + RESPAWN_DELAY });
        }
        s.fishes.splice(i, 1);
      }
      continue;
    }
    // 虹金魚の退場（毎フレーム画面外へ steer し、flee で上書きされても復帰）
    if (f.leaveAt > 0 && elapsed >= f.leaveAt && f.state === "swim") {
      f.leaving = true;
      f.tx = f.x < W / 2 ? -80 : W + 80;
      f.ty = f.y;
    }
    moveFish(f, dt, speedFactor);
    if (
      f.leaving &&
      (f.x < -60 || f.x > W + 60 || f.y < -60 || f.y > H + 60)
    ) {
      s.fishes.splice(i, 1);
    }
  }

  // 波紋・紙くず
  s.rings = s.rings.filter((rg) => {
    rg.r += rg.vr * dt;
    rg.alpha -= dt * 1.1;
    return rg.alpha > 0;
  });
  s.scraps = s.scraps.filter((sc) => {
    sc.x += sc.vx * dt;
    sc.y += sc.vy * dt;
    sc.vy += 70 * dt;
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

function jitterCircle(
  cx: number,
  cy: number,
  r: number,
  seed: number,
  n = 26,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rr = r + seededJitter(seed, k, 2.2);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

function addPolyPath(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  dy = 0,
): void {
  ctx.moveTo(pts[0][0], pts[0][1] + dy);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1] + dy);
  ctx.closePath();
}

/** 夜の水槽（藍→teal の深いグラデ + 提灯の映り込み + ゆるい波紋） */
function drawWater(ctx: CanvasRenderingContext2D, t: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, P.night700);
  g.addColorStop(0.55, "#0D3B50");
  g.addColorStop(1, "#0E4A41");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 提灯の映り込み（ぼんやり橙の楕円 ×2）
  const spots: [number, number, number][] = [
    [132, 118, 96],
    [352, 208, 72],
  ];
  spots.forEach(([sx, sy, sr], i) => {
    const ox = Math.sin(t * 0.5 + i * 2.1) * 8;
    ctx.save();
    ctx.translate(sx + ox, sy);
    ctx.scale(1, 0.45);
    const rg = ctx.createRadialGradient(0, 0, sr * 0.1, 0, 0, sr);
    rg.addColorStop(0, "rgba(255,187,105,.22)");
    rg.addColorStop(1, "rgba(255,187,105,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // ゆっくり広がる薄い波紋
  ctx.strokeStyle = "rgba(251,240,218,.9)";
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 5; k++) {
    const cx = (seededJitter(3, k * 2, 0.5) + 0.5) * W;
    const cy = (seededJitter(3, k * 2 + 1, 0.5) + 0.5) * H;
    const ph = (t * 0.45 + k * 1.9) % 3;
    const rr = 16 + (ph / 3) * 36;
    ctx.globalAlpha = 0.09 * (1 - ph / 3);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.55);
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** 四隅に桶のふち（kraftの切り紙） */
function drawTubCorners(ctx: CanvasRenderingContext2D): void {
  const c = 62;
  const opts = {
    fill: P.kraft,
    edge: P.kraftDeep,
    edgeWidth: 2,
    jitter: 3,
    shadow: "rgba(0,0,0,.35)",
    shadowDy: 4,
  };
  const tl: [number, number][] = [[-12, -12], [c, -12], [-12, c]];
  const tr: [number, number][] = [[W + 12, -12], [W - c, -12], [W + 12, c]];
  const bl: [number, number][] = [[-12, H + 12], [c, H + 12], [-12, H - c]];
  const br: [number, number][] = [[W + 12, H + 12], [W - c, H + 12], [W + 12, H - c]];
  paperPoly(ctx, tl, { ...opts, seed: 71 });
  paperPoly(ctx, tr, { ...opts, seed: 72 });
  paperPoly(ctx, bl, { ...opts, seed: 73 });
  paperPoly(ctx, br, { ...opts, seed: 74 });
}

/** 金魚（ペーパークラフト調・上から見た姿） */
function drawFish(ctx: CanvasRenderingContext2D, f: Fish): void {
  const def = FISH_DEF[f.kind];
  let px = f.x;
  let py = f.y;
  let sc = 1;
  let ang = f.angle;
  if (f.state === "caught") {
    const k = Math.min(1, f.stateT / FLIGHT_T);
    px = f.fx + (BOWL.x - f.fx) * k;
    py = f.fy + (BOWL.y - f.fy) * k - Math.sin(k * Math.PI) * 120;
    sc = 1 - 0.62 * k;
    ang = f.angle + k * 5; // くるくる跳ねる
  }
  const s = def.size * sc;
  const wag = Math.sin(f.phase) * 0.55;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);

  // 尾びれ（sinでゆらゆら）
  const tail: [number, number][] = [
    [-s * 0.55, 0],
    [-s * 1.75, -s * 0.6 + wag * s * 0.5],
    [-s * 1.3, wag * s * 0.35],
    [-s * 1.75, s * 0.6 + wag * s * 0.5],
  ];
  paperPoly(ctx, tail, {
    fill: def.tail,
    jitter: 1.4,
    seed: f.seed + 7,
    shadow: "rgba(0,0,0,.28)",
    shadowDy: 3,
  });

  // 胸びれ（左右）
  const finWag = Math.sin(f.phase + 1.3) * s * 0.15;
  for (const dir of [-1, 1]) {
    const fin: [number, number][] = [
      [s * 0.15, dir * s * 0.3],
      [-s * 0.35, dir * s * 0.8 + finWag],
      [-s * 0.3, dir * s * 0.28],
    ];
    paperPoly(ctx, fin, {
      fill: def.tail,
      jitter: 1,
      seed: f.seed + (dir > 0 ? 11 : 13),
      shadow: "rgba(0,0,0,.2)",
      shadowDy: 2,
    });
  }

  // 楕円ボディ
  ctx.save();
  ctx.scale(1, 0.62);
  paperCircle(ctx, 0, 0, s, {
    fill: def.body,
    edge: "rgba(251,240,218,.5)",
    edgeWidth: 1.4,
    jitter: s * 0.08,
    seed: f.seed,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 4,
  });
  ctx.restore();

  // 模様
  if (f.kind === "red") {
    ctx.fillStyle = "rgba(251,240,218,.72)";
    ctx.beginPath();
    ctx.ellipse(s * 0.05, 0, s * 0.3, s * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (f.kind === "gold") {
    ctx.fillStyle = "rgba(255,243,205,.75)";
    ctx.beginPath();
    ctx.ellipse(s * 0.1, -s * 0.08, s * 0.26, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (f.kind === "rainbow") {
    // 多色パッチ（切り紙パッチワーク）: ボディ楕円でクリップして重ねる
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.62, 0, 0, Math.PI * 2);
    ctx.clip();
    const patches: [string, number, number, number][] = [
      [P.gold, -0.5, -0.45, 0.55],
      [P.teal, 0.3, 0.4, 0.5],
      [P.paper, 0.55, -0.35, 0.4],
    ];
    patches.forEach(([col, ox, oy, pr], pi) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      const n = 7;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const rr = pr * s + seededJitter(f.seed + 20 + pi, k, s * 0.12);
        const px2 = ox * s + Math.cos(a) * rr;
        const py2 = oy * s + Math.sin(a) * rr * 0.8;
        if (k === 0) ctx.moveTo(px2, py2);
        else ctx.lineTo(px2, py2);
      }
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }

  // 目
  if (f.kind === "black") {
    // デメキン: 左右に飛び出た大きい目
    for (const dir of [-1, 1]) {
      ctx.fillStyle = "#171110";
      ctx.beginPath();
      ctx.arc(s * 0.45, dir * s * 0.44, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(251,240,218,.85)";
      ctx.beginPath();
      ctx.arc(s * 0.51, dir * s * 0.44 - s * 0.06, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = P.ink;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * 0.55, dir * s * 0.2, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 虹金魚: 尾に沿った小さな星のきらきら（phase 駆動でちらつきなし）
  if (f.kind === "rainbow" && f.state !== "caught") {
    for (let i = 0; i < 4; i++) {
      const ph = f.phase * 0.8 + i * 1.7;
      const sx = -s * (1.25 + i * 0.55) + Math.sin(ph) * 3;
      const sy = Math.sin(ph * 1.3) * s * 0.5;
      const tw = 0.5 + 0.5 * Math.sin(ph * 2.3);
      const r2 = 1.3 + tw * 1.2;
      ctx.globalAlpha = 0.3 + tw * 0.5;
      ctx.fillStyle = i % 2 === 0 ? "#FFE9A8" : P.paper;
      ctx.beginPath();
      ctx.moveTo(sx, sy - r2 * 2);
      ctx.lineTo(sx + r2 * 0.55, sy - r2 * 0.55);
      ctx.lineTo(sx + r2 * 2, sy);
      ctx.lineTo(sx + r2 * 0.55, sy + r2 * 0.55);
      ctx.lineTo(sx, sy + r2 * 2);
      ctx.lineTo(sx - r2 * 0.55, sy + r2 * 0.55);
      ctx.lineTo(sx - r2 * 2, sy);
      ctx.lineTo(sx - r2 * 0.55, sy - r2 * 0.55);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/** 右上の金魚鉢（とった魚のアイコンが増える） */
function drawBowl(ctx: CanvasRenderingContext2D, bowl: FishKind[], t: number): void {
  const { x, y } = BOWL;
  paperCircle(ctx, x, y, 46, {
    fill: P.kraft,
    edge: P.kraftLight,
    edgeWidth: 2,
    jitter: 2.5,
    seed: 91,
    shadow: "rgba(0,0,0,.4)",
    shadowDy: 5,
  });
  paperCircle(ctx, x, y, 36, {
    fill: "#12564A",
    jitter: 2,
    seed: 92,
    shadow: "rgba(0,0,0,.25)",
    shadowDy: 2,
  });
  // 水面ハイライト
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = P.paper;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x - 6, y - 8, 16, 7, -0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // とった魚のミニアイコン（螺旋配置でゆっくり回る）
  bowl.slice(0, 18).forEach((k, i) => {
    const a = i * 2.39996 + t * 0.35;
    const rr = Math.min(27, 5 + Math.sqrt(i) * 8);
    const ix = x + Math.cos(a) * rr;
    const iy = y + Math.sin(a) * rr;
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = k === "rainbow" ? P.gold : FISH_DEF[k].body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = k === "rainbow" ? P.teal : FISH_DEF[k].body;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-8.5, -3.2);
    ctx.lineTo(-8.5, 3.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
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

/** 紙タグポップ（「2匹どり！×1.5」「虹金魚！+50」） */
function drawPops(ctx: CanvasRenderingContext2D, s: Sim): void {
  for (const p of s.pops) {
    const born = p.maxLife - p.life;
    const appear = Math.min(1, born / 0.12); // ぽんっと出る
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

// ひび割れの線（相対座標 [x1,y1,x2,y2]）
const CRACKS: [number, number, number, number][] = [
  [-0.55, -0.15, 0.45, 0.32],
  [0.05, -0.6, -0.25, 0.48],
  [-0.4, 0.42, 0.55, -0.2],
];

function drawCrack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  c: [number, number, number, number],
  seed: number,
): void {
  const [ax, ay, bx, by] = c;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const k = i / 6;
    const px = x + (ax + (bx - ax) * k) * r + seededJitter(seed, i * 2, 3);
    const py = y + (ay + (by - ay) * k) * r + seededJitter(seed, i * 2 + 1, 3);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

/** ポイ（紙の輪 + 半透明の膜。ダメージで見た目が変わる） */
function drawPoi(ctx: CanvasRenderingContext2D, s: Sim): void {
  const { ptr } = s;
  const broken = s.poiBrokenT > 0;
  const dip = ptr.down && !broken;
  const r = POI_R * (dip ? 1.09 : 1);
  const x = ptr.x;
  const y = ptr.y;

  // 柄（真下＝指の方向へ伸びる木の棒。利き手を問わず丸が隠れない）
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI * 0.5);
  paperRect(ctx, r * 0.72, -7, r * 1.45, 14, {
    fill: P.wood,
    edge: P.woodDeep,
    edgeWidth: 1.5,
    jitter: 1.4,
    seed: 31,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
  });
  ctx.restore();

  // 沈めた時の水リング
  if (dip) {
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = "rgba(251,240,218,.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r + 9 + Math.sin(s.t * 9) * 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 枠（切り紙の輪）: 影 → 本体
  const ringPts = jitterCircle(x, y, r, 41);
  ctx.beginPath();
  addPolyPath(ctx, ringPts, 4);
  ctx.strokeStyle = "rgba(0,0,0,.32)";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.beginPath();
  addPolyPath(ctx, ringPts);
  ctx.strokeStyle = dip ? P.kraftDeep : P.kraft;
  ctx.lineWidth = 9;
  ctx.stroke();

  // 膜（半透明の白紙。破れは evenodd の穴で表現）
  const dmg = clamp(s.poiDamage, 0, 2);
  let alpha = broken ? 0.05 : [0.3, 0.25, 0.2][dmg];
  if (dip) alpha += 0.15;
  const hasHole = broken || dmg >= 2;
  ctx.beginPath();
  addPolyPath(ctx, jitterCircle(x, y, r - 5, 42));
  if (hasHole) {
    addPolyPath(
      ctx,
      jitterCircle(
        x + r * 0.22,
        y - r * 0.12,
        r * (broken ? 0.66 : 0.42),
        43,
        18,
      ),
    );
  }
  ctx.fillStyle = `rgba(251,240,218,${alpha})`;
  ctx.fill("evenodd");

  // ひび
  if (broken || dmg >= 1) {
    ctx.strokeStyle = "rgba(58,46,42,.4)";
    ctx.lineWidth = 1.5;
    const n = broken || dmg >= 2 ? 3 : 2;
    for (let i = 0; i < n; i++) drawCrack(ctx, x, y, r * 0.8, CRACKS[i], 51 + i);
  }
}

function render(ctx: CanvasRenderingContext2D, s: Sim): void {
  drawWater(ctx, s.t);
  drawTubCorners(ctx);
  drawRings(ctx, s);
  for (const f of s.fishes) if (f.state !== "caught") drawFish(ctx, f);
  drawBowl(ctx, s.bowl, s.t);
  for (const f of s.fishes) if (f.state === "caught") drawFish(ctx, f);
  drawScraps(ctx, s);
  if (s.phase === "playing" && s.ptr.on) drawPoi(ctx, s);
  drawPops(ctx, s);
}

/* ================= コンポーネント ================= */

function rankTitle(score: number): string {
  if (score >= 250) return "金魚名人！";
  if (score >= 150) return "いい感じ！";
  if (score >= 60) return "もうちょい！";
  return "また挑戦してね";
}

const CARD_CLASS =
  "torn border-[3px] border-kraft-paper bg-kraft paper-grain shadow-paper text-fes-ink p-6 text-center max-w-xs";
const BTN_CLASS =
  "rounded-full bg-fes-red border-2 border-fes-red-deep text-kraft-paper font-maru font-black px-8 py-2.5 shadow-paper-sm hover:-translate-y-0.5 transition-transform";

export default function GoldfishGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<Sim | null>(null);
  const uiKeyRef = useRef("");
  const [ui, setUi] = useState<Ui>({
    phase: "ready",
    score: 0,
    sec: GAME_TIME,
    poiLeft: POI_MAX,
    poiBonus: 0,
    counts: { red: 0, black: 0, gold: 0, rainbow: 0 },
  });

  const pushUi = useCallback(() => {
    const s = simRef.current;
    if (!s) return;
    const counts: Record<FishKind, number> = {
      red: 0,
      black: 0,
      gold: 0,
      rainbow: 0,
    };
    for (const k of s.caught) counts[k]++;
    const next: Ui = {
      phase: s.phase,
      score: s.score,
      sec: Math.max(0, Math.ceil(s.time)),
      poiLeft: Math.max(0, s.poiLeft),
      poiBonus: s.poiBonus,
      counts,
    };
    const key = `${next.phase}|${next.score}|${next.sec}|${next.poiLeft}|${next.poiBonus}|${counts.red},${counts.black},${counts.gold},${counts.rainbow}`;
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
    // ptrには「ポイの丸の中心」を入れる（指の位置からPOI_OFFSET_Y上）
    const toPoi = (e: PointerEvent): [number, number] => {
      const [x, y] = toLocal(e);
      return [
        Math.min(Math.max(x, 8), W - 8),
        Math.min(Math.max(y - POI_OFFSET_Y, POI_R * 0.5), H - 8),
      ];
    };
    const onDown = (e: PointerEvent) => {
      const s = simRef.current;
      if (!s) return;
      const [x, y] = toPoi(e);
      s.ptr.x = x;
      s.ptr.y = y;
      s.ptr.on = true;
      if (s.phase === "playing" && s.poiBrokenT <= 0) {
        s.ptr.down = true; // 沈める
        s.rings.push({ x, y, r: POI_R, vr: 90, alpha: 0.4 });
      }
    };
    const onMove = (e: PointerEvent) => {
      const s = simRef.current;
      if (!s) return;
      const [x, y] = toPoi(e);
      s.ptr.x = x;
      s.ptr.y = y;
      s.ptr.on = true;
    };
    const onUp = () => {
      const s = simRef.current;
      if (!s || !s.ptr.down) return;
      s.ptr.down = false;
      scoop(s); // はなしてすくう
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

  const total =
    ui.counts.red + ui.counts.black + ui.counts.gold + ui.counts.rainbow;

  const scoreboard = (
    <div className="flex items-center justify-between font-maru text-sm font-black">
      <span>⏱ のこり {ui.sec}</span>
      <span aria-label={`ポイ のこり${ui.poiLeft}枚`}>
        ポイ {"●".repeat(ui.poiLeft)}
        {"○".repeat(Math.max(0, POI_MAX - ui.poiLeft))}
      </span>
      <span>とった {total}</span>
    </div>
  );

  const overlay =
    ui.phase === "ready" ? (
      <div className={CARD_CLASS}>
        <h2 className="font-maru font-black text-2xl text-fes-indigo">
          🐟 金魚すくい
        </h2>
        <p className="mt-3 font-maru text-sm font-bold">
          おして沈めて、はなしてすくう！
        </p>
        <p className="mt-1.5 font-maru text-xs font-bold">ポイは3枚・60秒</p>
        <ul className="mt-2 space-y-0.5 text-left font-maru text-xs font-bold text-fes-ink/80">
          <li>・まとめてすくうと倍率アップ（2匹×1.5 / 3匹×2）</li>
          <li>・時間がたつと魚がすばやくなる</li>
          <li>・🌈 レアな虹金魚は50点</li>
          <li>・ポイを残して終わるとボーナス</li>
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
          🔴×{ui.counts.red}　⚫×{ui.counts.black}　🟡×{ui.counts.gold}　🌈×
          {ui.counts.rainbow}
        </p>
        <p className="mt-1 font-maru text-xs font-bold text-fes-ink/75">
          ポイのこりボーナス +{ui.poiBonus}
        </p>
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
      title="金 魚 す く い"
      tagline="ポイでそっとすくってね"
      scoreboard={scoreboard}
      overlay={overlay}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-none touch-none"
        aria-label="金魚すくいのゲーム画面"
      />
    </GameShell>
  );
}
