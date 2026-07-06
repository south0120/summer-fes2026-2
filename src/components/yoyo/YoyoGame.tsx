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
const WATER_Y = 250; // 水面
const SAFE_Y = 190; // ここより上でリリース＝キャッチ成功
// フックは指のこのpx分上に出す（指で隠れないように）
const HOOK_OFFSET_Y = 46;
const GRAB_R = 46; // 掴み判定半径
const KOYORI_MAX = 100;
const REATTACH_T = 2.2; // こより切れ→再装着までの秒数
const DRAIN_BASE = 15; // 保持中の消耗/秒（weight 1 のとき）
const WEAR_PER_GRAB = 0.12; // 掴むたびに増える「濡れ」係数
const RECOVER_ON_CATCH = 24; // 成功時のこより回復
const IDLE_REGEN = 4; // 未使用時のゆっくり回復/秒
const CAUGHT_T = 0.7; // 成功後、ラックへ飛ぶ時間
const RESPAWN_DELAY = 1.8;
const GOLD_LIFETIME = 7; // 金ヨーヨーの滞在秒数
const RACK = { x: W - 66, y: 40 };
const COMBO_STEP = 0.25; // コンボ1につき倍率 +0.25
const COMBO_MULT_MAX = 3;

type Phase = "ready" | "playing" | "result";
type YoyoKind = "red" | "green" | "blue" | "gold";

type YoyoDef = {
  points: number;
  /** 重さ。こより消耗と引き上げの遅れに効く */
  weight: number;
  r: number;
  body: string;
  deep: string;
  count: number;
};

const YOYO_DEF: Record<YoyoKind, YoyoDef> = {
  red: { points: 10, weight: 1, r: 24, body: P.red, deep: P.redDeep, count: 3 },
  green: { points: 15, weight: 1.2, r: 23, body: P.teal, deep: P.tealDeep, count: 2 },
  blue: { points: 25, weight: 1.45, r: 22, body: P.indigo, deep: P.night600, count: 2 },
  // 金: 高得点だが重く、こよりの消耗が激しい（count 0 = 初期配置なし）
  gold: { points: 60, weight: 2.2, r: 25, body: P.gold, deep: P.goldDeep, count: 0 },
};

function multFor(combo: number): number {
  return Math.min(COMBO_MULT_MAX, 1 + combo * COMBO_STEP);
}

type Yoyo = {
  id: number;
  kind: YoyoKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  floatY: number; // 浮かぶ基準の深さ
  phase: number;
  state: "float" | "held" | "drop" | "caught";
  stateT: number;
  fx: number; // 成功時の出発点
  fy: number;
  entering: boolean;
  leaving: boolean;
  leaveAt: number; // 退場を始めるシミュ時刻（0 = 退場しない）
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
  combo: number;
  bestCombo: number;
  koyori: number; // こより耐久 0〜100
  wear: number; // 濡れ係数（掴むたび増・新品で0）
  brokenT: number; // >0 の間はこより再装着中で掴めない
  heldId: number; // 掴んでいるヨーヨーid（0 = なし）
  caught: YoyoKind[]; // とった内訳
  rack: YoyoKind[]; // ラックに並ぶヨーヨー
  yoyos: Yoyo[];
  respawns: { kind: YoyoKind; at: number }[];
  goldAt: number[]; // 金ヨーヨーの出現予定（経過秒・昇順）
  ptr: { x: number; y: number; on: boolean; down: boolean };
  rings: Ring[];
  scraps: Scrap[];
  pops: Pop[];
  nextId: number;
};

type Ui = {
  phase: Phase;
  score: number;
  sec: number;
  combo: number;
  bestCombo: number;
  counts: Record<YoyoKind, number>;
};

/* ================= シミュレーション ================= */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function spawnYoyo(kind: YoyoKind, id: number, fromEdge: boolean): Yoyo {
  const floatY = WATER_Y + 60 + Math.random() * (H - WATER_Y - 130);
  let x: number;
  let vx: number;
  if (fromEdge) {
    const fromLeft = Math.random() < 0.5;
    x = fromLeft ? -30 : W + 30;
    vx = (fromLeft ? 1 : -1) * (90 + Math.random() * 40);
  } else {
    x = 60 + Math.random() * (W - 120);
    vx = (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 14);
  }
  return {
    id,
    kind,
    x,
    y: floatY,
    vx,
    vy: 0,
    floatY,
    phase: Math.random() * Math.PI * 2,
    state: "float",
    stateT: 0,
    fx: 0,
    fy: 0,
    entering: fromEdge,
    leaving: false,
    leaveAt: 0,
    seed: id * 17 + 5,
  };
}

function makeSim(): Sim {
  const yoyos: Yoyo[] = [];
  let id = 1;
  (Object.keys(YOYO_DEF) as YoyoKind[]).forEach((kind) => {
    for (let i = 0; i < YOYO_DEF[kind].count; i++) {
      yoyos.push(spawnYoyo(kind, id++, false));
    }
  });
  return {
    phase: "ready",
    t: 0,
    time: GAME_TIME,
    score: 0,
    combo: 0,
    bestCombo: 0,
    koyori: KOYORI_MAX,
    wear: 0,
    brokenT: 0,
    heldId: 0,
    caught: [],
    rack: [],
    yoyos,
    respawns: [],
    // 金ヨーヨーは6秒付近と16秒付近に1回ずつ（±1秒ゆらぎ）
    goldAt: [6 + Math.random() * 2, 16 + Math.random() * 2],
    ptr: { x: W / 2, y: H / 2, on: false, down: false },
    rings: [],
    scraps: [],
    pops: [],
    nextId: id,
  };
}

function addPop(s: Sim, x: number, y: number, text: string): void {
  s.pops.push({
    x: clamp(x, 84, W - 84),
    y: clamp(y, 48, H - 40),
    text,
    life: 1.15,
    maxLife: 1.15,
    seed: s.nextId * 7 + s.pops.length * 13,
  });
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

function dropBack(yo: Yoyo): void {
  yo.state = "drop";
  yo.stateT = 0;
  yo.vy = -30;
}

/** 保持中にこよりが切れた */
function breakKoyori(s: Sim, yo: Yoyo): void {
  sfx.pop();
  spawnScraps(s, yo.x, yo.y - 10);
  addPop(s, yo.x, yo.y - 44, "こより切れ！");
  dropBack(yo);
  s.heldId = 0;
  s.koyori = 0;
  s.combo = 0;
  s.wear = 0;
  s.brokenT = REATTACH_T; // 新しいこよりを付けるまで操作不可
}

/** pointerdown: 近くのヨーヨーを掴む */
function grab(s: Sim): void {
  if (s.phase !== "playing" || s.brokenT > 0 || s.heldId !== 0) return;
  const { x, y } = s.ptr;
  let best: Yoyo | null = null;
  let bestD2 = GRAB_R * GRAB_R;
  for (const yo of s.yoyos) {
    if (yo.state !== "float") continue;
    const d2 = (yo.x - x) ** 2 + (yo.y - y) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = yo;
    }
  }
  if (!best) return;
  best.state = "held";
  best.stateT = 0;
  best.leaving = false;
  s.heldId = best.id;
  s.wear += WEAR_PER_GRAB; // 使うほどこよりが濡れて弱る
  sfx.tap();
  s.rings.push({
    x: best.x,
    y: best.y,
    r: YOYO_DEF[best.kind].r,
    vr: 110,
    alpha: 0.45,
  });
}

/** pointerup: 引き上げの解決 */
function release(s: Sim): void {
  if (s.heldId === 0) return;
  const yo = s.yoyos.find((y) => y.id === s.heldId);
  s.heldId = 0;
  if (!yo) return;
  if (s.phase !== "playing") {
    dropBack(yo);
    return;
  }
  const def = YOYO_DEF[yo.kind];
  if (yo.y <= SAFE_Y) {
    // 成功: 安全ラインより上でリリース
    const mult = multFor(s.combo);
    const pts = Math.round(def.points * mult);
    s.score += pts;
    s.combo++;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.koyori = clamp(s.koyori + RECOVER_ON_CATCH, 0, KOYORI_MAX); // うまく取ると回復
    s.caught.push(yo.kind);
    yo.state = "caught";
    yo.stateT = 0;
    yo.fx = yo.x;
    yo.fy = yo.y;
    let popY = yo.y - 44;
    if (yo.kind === "gold") {
      addPop(s, yo.x, popY, `金ヨーヨー！+${pts}`);
      popY -= 36;
    } else {
      addPop(s, yo.x, popY, mult > 1 ? `+${pts}（×${mult.toFixed(2)}）` : `+${pts}`);
      popY -= 36;
    }
    if (s.combo >= 2) addPop(s, yo.x, popY, `${s.combo}コンボ！`);
    if (yo.kind === "gold" || s.combo >= 4) sfx.bigHit();
    else sfx.hit();
  } else {
    // 失敗: 水面より下ではなした → 落下・コンボ切れ
    dropBack(yo);
    if (s.combo > 0) addPop(s, yo.x, yo.y - 44, "おとした…コンボ切れ");
    s.combo = 0;
    sfx.miss();
  }
}

function endGame(s: Sim): void {
  if (s.phase === "result") return;
  s.phase = "result";
  s.ptr.down = false;
  if (s.heldId !== 0) {
    const yo = s.yoyos.find((y) => y.id === s.heldId);
    if (yo) dropBack(yo);
    s.heldId = 0;
  }
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

    // こより再装着
    if (s.brokenT > 0) {
      s.brokenT -= dt;
      if (s.brokenT <= 0) {
        s.koyori = KOYORI_MAX; // 新品支給
        s.wear = 0;
      }
    }

    // こより耐久: 保持中は消耗（重い・濡れているほど速い）／未使用時はゆっくり回復
    const held = s.heldId !== 0 ? s.yoyos.find((y) => y.id === s.heldId) : undefined;
    if (held) {
      const drain = DRAIN_BASE * YOYO_DEF[held.kind].weight * (1 + s.wear);
      s.koyori -= drain * dt;
      if (s.koyori <= 0) breakKoyori(s, held);
    } else if (s.brokenT <= 0 && s.koyori < KOYORI_MAX) {
      s.koyori = clamp(s.koyori + IDLE_REGEN * dt, 0, KOYORI_MAX);
    }

    // 補充（画面端から流れてくる）
    if (s.respawns.length > 0) {
      const due = s.respawns.filter((r) => r.at <= s.t);
      if (due.length > 0) {
        s.respawns = s.respawns.filter((r) => r.at > s.t);
        for (const r of due) s.yoyos.push(spawnYoyo(r.kind, s.nextId++, true));
      }
    }

    // 金ヨーヨーの出現
    while (s.goldAt.length > 0 && elapsed >= s.goldAt[0]) {
      s.goldAt.shift();
      const g = spawnYoyo("gold", s.nextId++, true);
      g.leaveAt = s.t + GOLD_LIFETIME;
      s.yoyos.push(g);
    }
  }

  // ヨーヨーの挙動（ready/result 中も背景で漂わせる）
  for (let i = s.yoyos.length - 1; i >= 0; i--) {
    const yo = s.yoyos[i];
    const def = YOYO_DEF[yo.kind];
    if (yo.state === "caught") {
      yo.stateT += dt;
      if (yo.stateT >= CAUGHT_T) {
        s.rack.push(yo.kind);
        if (yo.kind !== "gold") {
          s.respawns.push({ kind: yo.kind, at: s.t + RESPAWN_DELAY });
        }
        s.yoyos.splice(i, 1);
      }
      continue;
    }
    if (yo.state === "held") {
      // 重いほど引き上げが遅れる（フレームレート非依存の緩和）
      const ease = 1 - Math.exp(-dt * (9 / def.weight));
      yo.x += (s.ptr.x - yo.x) * ease;
      yo.y += (s.ptr.y - yo.y) * ease;
      yo.x = clamp(yo.x, 22, W - 22);
      yo.y = clamp(yo.y, 40, H - 30);
      yo.phase += dt * 6;
      continue;
    }
    if (yo.state === "drop") {
      yo.vy += 620 * dt;
      yo.y += yo.vy * dt;
      yo.x = clamp(yo.x + yo.vx * 0.3 * dt, 34, W - 34);
      if (yo.y >= yo.floatY) {
        yo.y = yo.floatY;
        yo.vy = 0;
        yo.state = "float";
        s.rings.push({ x: yo.x, y: yo.y + def.r * 0.4, r: def.r, vr: 130, alpha: 0.5 });
      }
      yo.phase += dt * 4;
      continue;
    }
    // float: 水面をゆらゆら漂う
    if (yo.leaveAt > 0 && s.t >= yo.leaveAt && !yo.leaving) {
      yo.leaving = true;
      yo.vx = yo.x < W / 2 ? -140 : 140;
    }
    yo.x += yo.vx * dt;
    if (yo.entering) {
      if (yo.x > 40 && yo.x < W - 40) {
        yo.entering = false;
        yo.vx = (yo.vx > 0 ? 1 : -1) * (14 + Math.random() * 14);
      }
    } else if (!yo.leaving && (yo.x < 34 || yo.x > W - 34)) {
      yo.x = clamp(yo.x, 34, W - 34);
      yo.vx = -yo.vx;
    }
    if (yo.leaving && (yo.x < -60 || yo.x > W + 60)) {
      s.yoyos.splice(i, 1);
      continue;
    }
    yo.y = yo.floatY + Math.sin(s.t * 1.6 + yo.phase) * 4;
    yo.phase += dt * 0.4;
  }

  // 波紋・紙くず・ポップ
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

/** 夜空 + 提灯 + 水面 */
function drawBg(ctx: CanvasRenderingContext2D, t: number): void {
  drawNightSky(ctx, W, H, 9);

  // 提灯のロープ
  ctx.strokeStyle = "rgba(238,210,172,.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, 26);
  ctx.quadraticCurveTo(W / 2, 58, W + 10, 24);
  ctx.stroke();
  drawLantern(ctx, 84, 62, 19, P.red);
  drawLantern(ctx, 238, 50, 15, P.gold);
  drawLantern(ctx, 396, 60, 19, P.teal);

  // 水（藍→teal の深いグラデ）
  const g = ctx.createLinearGradient(0, WATER_Y, 0, H);
  g.addColorStop(0, P.night700);
  g.addColorStop(0.5, "#0D3B50");
  g.addColorStop(1, "#0E4A41");
  ctx.fillStyle = g;
  ctx.fillRect(0, WATER_Y, W, H - WATER_Y);

  // 水面の波線
  ctx.strokeStyle = "rgba(251,240,218,.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const y = WATER_Y + Math.sin(x * 0.05 + t * 1.8) * 3;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 提灯の映り込み（ぼんやり楕円）
  const spots: [number, number, number][] = [
    [84, WATER_Y + 70, 80],
    [396, WATER_Y + 110, 66],
  ];
  spots.forEach(([sx, sy, sr], i) => {
    const ox = Math.sin(t * 0.5 + i * 2.1) * 8;
    ctx.save();
    ctx.translate(sx + ox, sy);
    ctx.scale(1, 0.4);
    const rg = ctx.createRadialGradient(0, 0, sr * 0.1, 0, 0, sr);
    rg.addColorStop(0, "rgba(255,187,105,.2)");
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
  for (let k = 0; k < 4; k++) {
    const cx = (seededJitter(5, k * 2, 0.5) + 0.5) * W;
    const cy = WATER_Y + 40 + (seededJitter(5, k * 2 + 1, 0.5) + 0.5) * (H - WATER_Y - 80);
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

/** 安全ライン（ここまで引き上げればOK） */
function drawSafeLine(ctx: CanvasRenderingContext2D, t: number): void {
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -t * 20;
  ctx.strokeStyle = "rgba(238,210,172,.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, SAFE_Y);
  ctx.lineTo(W, SAFE_Y);
  ctx.stroke();
  ctx.restore();

  ctx.font = "900 12px 'Zen Maru Gothic','Hiragino Maru Gothic ProN',sans-serif";
  const text = "ここまで上げてはなす";
  const w = ctx.measureText(text).width;
  paperRect(ctx, W - w - 34, SAFE_Y - 26, w + 20, 22, {
    fill: P.kraftLight,
    edge: P.kraftDeep,
    edgeWidth: 1.5,
    jitter: 1.6,
    seed: 61,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
  });
  ctx.fillStyle = P.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W - w / 2 - 24, SAFE_Y - 14);
}

/** ヨーヨー本体（ペーパークラフト調・渦巻き柄の水風船） */
function drawYoyo(ctx: CanvasRenderingContext2D, yo: Yoyo, t: number): void {
  const def = YOYO_DEF[yo.kind];
  let px = yo.x;
  let py = yo.y;
  let sc = 1;
  if (yo.state === "caught") {
    const k = Math.min(1, yo.stateT / CAUGHT_T);
    px = yo.fx + (RACK.x - yo.fx) * k;
    py = yo.fy + (RACK.y + 26 - yo.fy) * k - Math.sin(k * Math.PI) * 100;
    sc = 1 - 0.6 * k;
  }
  const r = def.r * sc;
  const rot = Math.sin(t * 1.2 + yo.phase) * 0.14;

  // 浮いている間は足元に波紋の楕円
  if (yo.state === "float") {
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = P.paper;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(px, py + r * 0.55, r * 1.15, r * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(rot);
  if (yo.state === "held") {
    // 吊られてぷるんと縦に揺れる
    const sq = 1 + Math.sin(yo.phase * 4) * 0.04;
    ctx.scale(2 - sq, sq);
  }

  // ゴムひも + 結び目（上）
  ctx.strokeStyle = "rgba(251,240,218,.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -r - 10);
  ctx.quadraticCurveTo(3, -r - 5, 0, -r + 2);
  ctx.stroke();
  paperCircle(ctx, 0, -r + 1, 4, {
    fill: P.kraftLight,
    jitter: 0.8,
    seed: yo.seed + 3,
    shadow: "rgba(0,0,0,.25)",
    shadowDy: 2,
  });

  // ボディ
  paperCircle(ctx, 0, 0, r, {
    fill: def.body,
    edge: "rgba(251,240,218,.5)",
    edgeWidth: 1.4,
    jitter: r * 0.05,
    seed: yo.seed,
    shadow: "rgba(0,0,0,.32)",
    shadowDy: 4,
  });

  // 渦巻きストライプ（ボディ円でクリップ）
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
  ctx.clip();
  ctx.lineWidth = r * 0.26;
  ctx.strokeStyle = def.deep;
  ctx.beginPath();
  ctx.arc(-r * 0.55, -r * 0.1, r * 0.8, -0.6, 1.6);
  ctx.stroke();
  ctx.strokeStyle = "rgba(251,240,218,.55)";
  ctx.lineWidth = r * 0.13;
  ctx.beginPath();
  ctx.arc(r * 0.6, r * 0.15, r * 0.75, Math.PI - 1.4, Math.PI + 0.8);
  ctx.stroke();
  ctx.restore();

  // ハイライト
  ctx.fillStyle = "rgba(251,240,218,.4)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.38, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2);
  ctx.fill();

  // 金ヨーヨー: きらきら星（phase 駆動でちらつきなし）
  if (yo.kind === "gold" && yo.state !== "caught") {
    for (let i = 0; i < 3; i++) {
      const ph = t * 2 + i * 2.1 + yo.phase;
      const a = (i / 3) * Math.PI * 2 + t * 0.7;
      const sx = Math.cos(a) * r * 1.25;
      const sy = Math.sin(a) * r * 1.25;
      const tw = 0.5 + 0.5 * Math.sin(ph * 2.3);
      const r2 = 1.4 + tw * 1.4;
      ctx.globalAlpha = 0.35 + tw * 0.5;
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

/** 右上のラック（とったヨーヨーが吊られていく） */
function drawRack(ctx: CanvasRenderingContext2D, rack: YoyoKind[]): void {
  paperRect(ctx, RACK.x - 46, RACK.y - 10, 92, 14, {
    fill: P.wood,
    edge: P.woodDeep,
    edgeWidth: 1.5,
    jitter: 1.6,
    seed: 81,
    shadow: "rgba(0,0,0,.4)",
    shadowDy: 4,
  });
  rack.slice(0, 10).forEach((k, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const ix = RACK.x - 36 + col * 18;
    const iy = RACK.y + 16 + row * 22;
    ctx.strokeStyle = "rgba(251,240,218,.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ix, RACK.y + 4 + row * 22 * 0.4);
    ctx.lineTo(ix, iy - 6);
    ctx.stroke();
    ctx.fillStyle = YOYO_DEF[k].body;
    ctx.beginPath();
    ctx.arc(ix, iy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(251,240,218,.4)";
    ctx.beginPath();
    ctx.arc(ix - 2, iy - 2, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** こより（紙のつり糸）。耐久が減ると細く赤茶けてほつれる */
function drawKoyori(ctx: CanvasRenderingContext2D, s: Sim): void {
  if (s.phase !== "playing" || !s.ptr.on) return;
  const held = s.heldId !== 0 ? s.yoyos.find((y) => y.id === s.heldId) : undefined;
  const ratio = clamp(s.koyori / KOYORI_MAX, 0, 1);
  const broken = s.brokenT > 0;

  const endX = held ? held.x : s.ptr.x;
  const endY = held ? held.y - YOYO_DEF[held.kind].r - 8 : s.ptr.y;
  const topX = endX + Math.sin(s.t * 1.4) * 10;

  ctx.save();
  if (broken) {
    // 切れた直後: 上から垂れた短い切れ端
    ctx.strokeStyle = "rgba(238,210,172,.55)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(topX, -6);
    for (let i = 1; i <= 4; i++) {
      const k = i / 4;
      ctx.lineTo(
        topX + Math.sin(s.t * 6 + i) * 4 * k,
        -6 + 60 * k,
      );
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  // 本体（数セグメントでゆらす）
  const width = 1.6 + 2.6 * ratio;
  ctx.strokeStyle =
    ratio > 0.35
      ? `rgba(251,240,218,${0.5 + 0.4 * ratio})`
      : "rgba(219,120,90,.85)"; // 弱ると赤茶けて見える
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(topX, -6);
  const segs = 8;
  for (let i = 1; i <= segs; i++) {
    const k = i / segs;
    const sway =
      Math.sin(s.t * 3 + i * 1.2) * 3 * (held ? 1.6 : 1) * Math.sin(k * Math.PI) +
      seededJitter(43, i, 1.5);
    ctx.lineTo(topX + (endX - topX) * k + sway, -6 + (endY + 6) * k);
  }
  ctx.stroke();

  // 耐久が低いとほつれの毛を出す
  if (ratio < 0.45) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(219,120,90,.6)";
    for (let i = 0; i < 3; i++) {
      const k = 0.3 + i * 0.22;
      const fx = topX + (endX - topX) * k;
      const fy = -6 + (endY + 6) * k;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + seededJitter(47, i * 2, 6), fy + 4 + seededJitter(47, i * 2 + 1, 3));
      ctx.stroke();
    }
  }

  // 先端のフック（掴んでいない時のみ見せる）
  if (!held) {
    ctx.strokeStyle = "rgba(238,210,172,.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(endX + 4, endY + 2, 6, Math.PI * 0.4, Math.PI * 1.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** 左上のこより耐久ゲージ */
function drawGauge(ctx: CanvasRenderingContext2D, s: Sim): void {
  const x = 12;
  const y = 12;
  paperRect(ctx, x, y, 148, 36, {
    fill: P.kraft,
    edge: P.kraftDeep,
    edgeWidth: 2,
    jitter: 2,
    seed: 55,
    shadow: "rgba(0,0,0,.35)",
    shadowDy: 4,
  });
  ctx.font = "900 12px 'Zen Maru Gothic','Hiragino Maru Gothic ProN',sans-serif";
  ctx.fillStyle = P.ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("こより", x + 10, y + 18);

  const bx = x + 54;
  const bw = 84;
  ctx.fillStyle = "rgba(3,18,42,.35)";
  ctx.fillRect(bx, y + 12, bw, 12);
  if (s.brokenT > 0) {
    // 再装着中: 点滅表示
    if (Math.floor(s.t * 4) % 2 === 0) {
      ctx.fillStyle = P.redDeep;
      ctx.textAlign = "center";
      ctx.fillText("つけかえ中…", bx + bw / 2, y + 18);
    }
  } else {
    const ratio = clamp(s.koyori / KOYORI_MAX, 0, 1);
    ctx.fillStyle = ratio > 0.55 ? P.teal : ratio > 0.28 ? P.gold : P.red;
    ctx.fillRect(bx, y + 12, bw * ratio, 12);
  }
  ctx.strokeStyle = P.kraftDeep;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx, y + 12, bw, 12);
}

function drawRings(ctx: CanvasRenderingContext2D, s: Sim): void {
  for (const rg of s.rings) {
    ctx.globalAlpha = Math.max(0, rg.alpha);
    ctx.strokeStyle = "rgba(251,240,218,.9)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.save();
    ctx.translate(rg.x, rg.y);
    ctx.scale(1, 0.6);
    ctx.arc(0, 0, rg.r, 0, Math.PI * 2);
    ctx.restore();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** 紙タグポップ（「+30（×1.5）」「こより切れ！」） */
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
  drawBg(ctx, s.t);
  drawSafeLine(ctx, s.t);
  drawRings(ctx, s);
  drawRack(ctx, s.rack);
  for (const yo of s.yoyos) {
    if (yo.state !== "held" && yo.state !== "caught") drawYoyo(ctx, yo, s.t);
  }
  drawKoyori(ctx, s);
  for (const yo of s.yoyos) {
    if (yo.state === "held" || yo.state === "caught") drawYoyo(ctx, yo, s.t);
  }
  drawScraps(ctx, s);
  drawGauge(ctx, s);
  drawPops(ctx, s);
}

/* ================= コンポーネント ================= */

function rankTitle(score: number): string {
  if (score >= 350) return "ヨーヨー名人！";
  if (score >= 220) return "いい感じ！";
  if (score >= 100) return "もうちょい！";
  return "また挑戦してね";
}

const CARD_CLASS =
  "torn border-[3px] border-kraft-paper bg-kraft paper-grain shadow-paper text-fes-ink p-6 text-center max-w-xs";
const BTN_CLASS =
  "rounded-full bg-fes-red border-2 border-fes-red-deep text-kraft-paper font-maru font-black px-8 py-2.5 shadow-paper-sm hover:-translate-y-0.5 transition-transform";

export default function YoyoGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<Sim | null>(null);
  const uiKeyRef = useRef("");
  const [ui, setUi] = useState<Ui>({
    phase: "ready",
    score: 0,
    sec: GAME_TIME,
    combo: 0,
    bestCombo: 0,
    counts: { red: 0, green: 0, blue: 0, gold: 0 },
  });

  const pushUi = useCallback(() => {
    const s = simRef.current;
    if (!s) return;
    const counts: Record<YoyoKind, number> = {
      red: 0,
      green: 0,
      blue: 0,
      gold: 0,
    };
    for (const k of s.caught) counts[k]++;
    const next: Ui = {
      phase: s.phase,
      score: s.score,
      sec: Math.max(0, Math.ceil(s.time)),
      combo: s.combo,
      bestCombo: s.bestCombo,
      counts,
    };
    const key = `${next.phase}|${next.score}|${next.sec}|${next.combo}|${next.bestCombo}|${counts.red},${counts.green},${counts.blue},${counts.gold}`;
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
    // ptrには「フック位置」を入れる（指の位置からHOOK_OFFSET_Y上＝指で隠れない）
    const toHook = (e: PointerEvent): [number, number] => {
      const [x, y] = toLocal(e);
      return [
        Math.min(Math.max(x, 10), W - 10),
        Math.min(Math.max(y - HOOK_OFFSET_Y, 30), H - 10),
      ];
    };
    const onDown = (e: PointerEvent) => {
      const s = simRef.current;
      if (!s) return;
      const [x, y] = toHook(e);
      s.ptr.x = x;
      s.ptr.y = y;
      s.ptr.on = true;
      s.ptr.down = true;
      grab(s);
    };
    const onMove = (e: PointerEvent) => {
      const s = simRef.current;
      if (!s) return;
      const [x, y] = toHook(e);
      s.ptr.x = x;
      s.ptr.y = y;
      s.ptr.on = true;
    };
    const onUp = () => {
      const s = simRef.current;
      if (!s || !s.ptr.down) return;
      s.ptr.down = false;
      release(s); // はなして引き上げ判定
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
    ui.counts.red + ui.counts.green + ui.counts.blue + ui.counts.gold;

  const scoreboard = (
    <div className="flex items-center justify-between font-maru text-sm font-black">
      <span>⏱ のこり {ui.sec}</span>
      <span aria-label={`コンボ${ui.combo} 倍率${multFor(ui.combo).toFixed(2)}倍`}>
        🔥 {ui.combo}コンボ ×{multFor(ui.combo).toFixed(2)}
      </span>
      <span>スコア {ui.score}</span>
    </div>
  );

  const overlay =
    ui.phase === "ready" ? (
      <div className={CARD_CLASS}>
        <h2 className="font-maru font-black text-2xl text-fes-indigo">
          🪀 ヨーヨーすくい
        </h2>
        <p className="mt-3 font-maru text-sm font-bold">
          おさえて掴んで、点線より上ではなす！
        </p>
        <p className="mt-1.5 font-maru text-xs font-bold">30秒スコアアタック</p>
        <ul className="mt-2 space-y-0.5 text-left font-maru text-xs font-bold text-fes-ink/80">
          <li>・掴んでいる間、こよりが濡れて弱っていく</li>
          <li>・切れると付けかえるまで時間ロス</li>
          <li>・連続で取るとコンボ倍率アップ（最大×3）</li>
          <li>・⭐ 金ヨーヨーは60点。重いので消耗に注意！</li>
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
          🔴×{ui.counts.red}　🟢×{ui.counts.green}　🔵×{ui.counts.blue}　⭐×
          {ui.counts.gold}
        </p>
        <p className="mt-1 font-maru text-xs font-bold text-fes-ink/75">
          とった数 {total}・ベストコンボ {ui.bestCombo}
        </p>
        <div className="mt-4 space-y-3 text-left">
          <ScoreSubmit game="yoyo" score={ui.score} />
          <Leaderboard game="yoyo" />
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
      title="ヨ ー ヨ ー す く い"
      tagline="こよりが切れる前に釣り上げてね"
      scoreboard={scoreboard}
      overlay={overlay}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-none touch-none"
        aria-label="ヨーヨーすくいのゲーム画面"
      />
    </GameShell>
  );
}
