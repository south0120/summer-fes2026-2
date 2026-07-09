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
const MISS_MAX = 3;

// ベルトコンベア（右→左）
const BELT_Y = 214; // 帯の中心
const BELT_H = 48;
const BELT_LEFT = 36;
const BELT_RIGHT = W + 30; // 卵の湧き位置（画面外右）
const DROP_X = 54; // これより左に流れたら「落下」＝ミス
const BELT_SPEED = 76; // 基本流速 px/s
const SPAWN_BASE = 0.95; // 卵の出現間隔（秒）÷難易度

// 巣・運動場
const NEST_L = { x: 96, y: 470 }; // ウズラの巣（左）
const NEST_R = { x: 384, y: 470 }; // ひよこの巣（右）
const YARD = { x0: 40, x1: W - 40, y0: 556, y1: 610 };

// 難化・スコア
const DIFF_MAX_BONUS = 1.6; // 終盤の速度/出現倍率 = 1 + 1.6（後半ほど急加速）
const TRICKY_AT = 10; // この経過秒以降は紛らわしい薄斑点卵を混ぜる
const TRICKY_RATE = 0.45;
const BASE_PTS = 10;
const COMBO_STEP = 0.3; // コンボ1につき +0.3倍
const COMBO_MAX_MULT = 2.5;
const CAPTURE_PTS = 15; // 迷子ヒナ捕獲
const LOST_PENALTY = 10; // 迷子退場の小減点
const FLIGHT_T = 0.7; // 卵が巣へ飛ぶ時間
const RETURN_T = 0.6; // 捕獲ヒナが巣へ戻る時間
const STRAY_MIN = 3; // 迷い込み間隔（秒・難易度で短縮）
const STRAY_MAX = 6;

type Phase = "ready" | "playing" | "result";
type EggKind = "quail" | "chick";

const NEST_OF: Record<EggKind, { x: number; y: number }> = {
  quail: NEST_L,
  chick: NEST_R,
};

function eggR(kind: EggKind): number {
  return kind === "chick" ? 17 : 12.5; // ひよこ卵は大きめ・ウズラ卵は小さめ
}

const EGG_TOP = BELT_Y - BELT_H / 2; // ベルト上面

function eggY(kind: EggKind): number {
  return EGG_TOP - eggR(kind) * 1.05;
}

type Egg = {
  id: number;
  kind: EggKind;
  tricky: boolean; // 薄斑点の紛らわしい卵
  x: number;
  state: "belt" | "fly";
  stateT: number;
  fx: number; // 飛翔の出発点
  fy: number;
  bob: number;
  seed: number;
};

type Bird = {
  id: number;
  kind: EggKind;
  x: number;
  y: number;
  dir: number; // 1=右向き / -1=左向き
  state: "walk" | "stray" | "return";
  stateT: number;
  tx: number;
  ty: number;
  fx: number; // return の出発点
  fy: number;
  phase: number;
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
  t: number;
  time: number;
  score: number;
  miss: number;
  combo: number;
  hatched: Record<EggKind, number>;
  captured: number;
  lost: number;
  eggs: Egg[];
  birds: Bird[];
  spawnAt: number; // 次の卵出現（sim時刻）
  strayAt: number; // 次の迷い込み（sim時刻）
  beltScroll: number; // ベルト模様のスクロール量
  ptr: { x: number; y: number; on: boolean };
  rings: Ring[];
  scraps: Scrap[];
  pops: Pop[];
  nextId: number;
};

type Ui = {
  phase: Phase;
  score: number;
  sec: number;
  miss: number;
  combo: number;
  chick: number;
  quail: number;
  captured: number;
};

/* ================= シミュレーション ================= */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function comboMult(combo: number): number {
  return Math.min(COMBO_MAX_MULT, 1 + Math.max(0, combo - 1) * COMBO_STEP);
}

function makeEgg(id: number, x: number, elapsed: number): Egg {
  const kind: EggKind = Math.random() < 0.5 ? "quail" : "chick";
  return {
    id,
    kind,
    tricky: elapsed >= TRICKY_AT && Math.random() < TRICKY_RATE,
    x,
    state: "belt",
    stateT: 0,
    fx: 0,
    fy: 0,
    bob: Math.random() * Math.PI * 2,
    seed: id * 23 + 5,
  };
}

function makeBird(id: number, kind: EggKind, x: number): Bird {
  return {
    id,
    kind,
    x,
    y: YARD.y0 + Math.random() * (YARD.y1 - YARD.y0),
    dir: Math.random() < 0.5 ? 1 : -1,
    state: "walk",
    stateT: 0,
    tx: 0,
    ty: 0,
    fx: 0,
    fy: 0,
    phase: Math.random() * Math.PI * 2,
    seed: id * 31 + 7,
  };
}

function makeSim(): Sim {
  let id = 1;
  // ready画面用の飾り: 流れる卵と、運動場を歩く2羽
  const eggs: Egg[] = [];
  for (let i = 0; i < 4; i++) eggs.push(makeEgg(id++, 120 + i * 110, 0));
  const birds: Bird[] = [
    makeBird(id++, "quail", 140),
    makeBird(id++, "chick", 340),
  ];
  return {
    phase: "ready",
    t: 0,
    time: GAME_TIME,
    score: 0,
    miss: 0,
    combo: 0,
    hatched: { quail: 0, chick: 0 },
    captured: 0,
    lost: 0,
    eggs,
    birds,
    spawnAt: 0.8,
    strayAt: 4 + Math.random() * 2,
    beltScroll: 0,
    ptr: { x: W / 2, y: H / 2, on: false },
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

function spawnScraps(s: Sim, x: number, y: number, colors: [string, string]): void {
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
      color: i % 2 === 0 ? colors[0] : colors[1],
    });
  }
}

function shellColors(kind: EggKind): [string, string] {
  return kind === "quail" ? ["#E8D3AC", P.woodDeep] : [P.paper, P.kraftLight];
}

function endGame(s: Sim): void {
  if (s.phase === "result") return;
  s.phase = "result";
  // 迷子中のヒナは巣へ帰す（リザルト画面の裏で運動場に戻る）
  for (const b of s.birds) {
    if (b.state === "stray") startReturn(b);
  }
  sfx.finish();
}

function startReturn(b: Bird): void {
  const nest = NEST_OF[b.kind];
  b.state = "return";
  b.stateT = 0;
  b.fx = b.x;
  b.fy = b.y;
  b.tx = nest.x + seededJitter(b.seed, 3, 20);
  b.ty = YARD.y0 + Math.random() * (YARD.y1 - YARD.y0);
}

/** 先頭卵（判定対象）＝画面内でいちばん左のベルト上の卵 */
function frontEgg(s: Sim): Egg | null {
  let front: Egg | null = null;
  for (const e of s.eggs) {
    if (e.state !== "belt" || e.x > W - 16) continue;
    if (!front || e.x < front.x) front = e;
  }
  return front;
}

function missOnce(s: Sim, x: number, y: number, text: string): void {
  s.miss++;
  s.combo = 0;
  addPop(s, x, y, text);
  if (s.miss >= MISS_MAX) endGame(s);
}

/** 孵化: 卵が巣に着いたらヒナ誕生 → 運動場へ */
function hatch(s: Sim, egg: Egg): void {
  const nest = NEST_OF[egg.kind];
  s.hatched[egg.kind]++;
  spawnScraps(s, nest.x, nest.y - 10, shellColors(egg.kind));
  s.rings.push({ x: nest.x, y: nest.y - 6, r: 12, vr: 110, alpha: 0.5 });
  if (s.birds.length < 26) {
    const b = makeBird(s.nextId++, egg.kind, nest.x + seededJitter(egg.seed, 5, 24));
    s.birds.push(b);
  }
}

/** pointerdown: ヒナ捕獲優先 → 先頭卵の仕分け */
function tapAction(s: Sim, x: number, y: number): void {
  if (s.phase !== "playing") return;
  s.rings.push({ x, y, r: 10, vr: 130, alpha: 0.45 });

  // 1) 迷い込みヒナの捕獲（最優先）
  let target: Bird | null = null;
  let best = 40 * 40;
  for (const b of s.birds) {
    if (b.state !== "stray") continue;
    const d2 = (b.x - x) ** 2 + (b.y - y) ** 2;
    if (d2 < best) {
      best = d2;
      target = b;
    }
  }
  if (target) {
    s.score += CAPTURE_PTS;
    s.captured++;
    addPop(s, target.x, target.y - 34, `ほかく！+${CAPTURE_PTS}`);
    sfx.tap();
    sfx.bigHit();
    startReturn(target);
    return;
  }

  // 2) 先頭卵の仕分け（左半分=ウズラ / 右半分=ひよこ）
  const egg = frontEgg(s);
  if (!egg) {
    sfx.whoosh();
    return;
  }
  const pick: EggKind = x < W / 2 ? "quail" : "chick";
  const ex = egg.x;
  const ey = eggY(egg.kind);
  if (egg.kind === pick) {
    // 正解 → 巣へ飛ばす
    s.combo++;
    const mult = comboMult(s.combo);
    const pts = Math.round(BASE_PTS * mult);
    s.score += pts;
    egg.state = "fly";
    egg.stateT = 0;
    egg.fx = ex;
    egg.fy = ey;
    addPop(s, ex, ey - 34, `+${pts}`);
    if (mult >= COMBO_MAX_MULT && comboMult(s.combo - 1) < COMBO_MAX_MULT) {
      addPop(s, ex, ey - 70, `コンボMAX ×${COMBO_MAX_MULT}`);
      sfx.bigHit();
    } else {
      sfx.hit();
    }
  } else {
    // 誤り → パリンと割れる
    sfx.pop();
    sfx.miss();
    spawnScraps(s, ex, ey, shellColors(egg.kind));
    s.eggs.splice(s.eggs.indexOf(egg), 1);
    missOnce(s, ex, ey - 34, "われた…");
  }
}

function update(s: Sim, dt: number): void {
  s.t += dt;
  const elapsed = clamp(GAME_TIME - s.time, 0, GAME_TIME);
  // 時間経過で難化: 流速・出現間隔 1 → 2.6倍相当（ease-inで後半ほど急加速）
  const prog = elapsed / GAME_TIME;
  const diff =
    s.phase === "playing" ? 1 + DIFF_MAX_BONUS * Math.pow(prog, 1.5) : 1;
  const beltSpeed = BELT_SPEED * diff;
  s.beltScroll += beltSpeed * dt;

  if (s.phase === "playing") {
    const prevSec = Math.ceil(s.time);
    s.time -= dt;
    const sec = Math.max(0, Math.ceil(s.time));
    if (sec !== prevSec && sec <= 5 && sec >= 1) sfx.tick();
    if (s.time <= 0) endGame(s);

    // 卵の補充（右端から）
    if (s.t >= s.spawnAt) {
      s.spawnAt = s.t + SPAWN_BASE / diff;
      s.eggs.push(makeEgg(s.nextId++, BELT_RIGHT, elapsed));
    }

    // ヒナの迷い込み（後半ほど頻繁・多数が逃げ出す）
    if (s.t >= s.strayAt) {
      s.strayAt =
        s.t + (STRAY_MIN + Math.random() * (STRAY_MAX - STRAY_MIN)) / diff;
      const walkers = s.birds.filter((b) => b.state === "walk");
      const strays = s.birds.filter((b) => b.state === "stray").length;
      const maxStray = Math.min(6, 2 + Math.floor((diff - 1) * 2.5));
      if (walkers.length > 0 && strays < maxStray) {
        const b = walkers[Math.floor(Math.random() * walkers.length)];
        b.state = "stray";
        b.stateT = 0;
        b.tx = 130 + Math.random() * 220;
        b.ty = EGG_TOP - 8 + Math.random() * 12; // 卵の列と重なる高さ
      }
    }
  }

  // 卵
  for (let i = s.eggs.length - 1; i >= 0; i--) {
    const e = s.eggs[i];
    if (e.state === "belt") {
      e.x -= beltSpeed * dt;
      e.bob += dt * 3;
      if (e.x < DROP_X) {
        if (s.phase === "playing") {
          // 左端から落下 → ミス
          sfx.miss();
          spawnScraps(s, e.x, eggY(e.kind) + 20, shellColors(e.kind));
          s.eggs.splice(i, 1);
          missOnce(s, e.x + 30, eggY(e.kind) - 30, "おとした…");
        } else {
          e.x = BELT_RIGHT; // ready/result 中は周回する飾り
        }
      }
    } else {
      e.stateT += dt;
      if (e.stateT >= FLIGHT_T) {
        hatch(s, e);
        s.eggs.splice(i, 1);
      }
    }
  }

  // ヒナ・ウズラ
  for (let i = s.birds.length - 1; i >= 0; i--) {
    const b = s.birds[i];
    b.phase += dt * 8;
    if (b.state === "walk") {
      b.x += b.dir * 30 * dt;
      if (b.x < YARD.x0) {
        b.x = YARD.x0;
        b.dir = 1;
      } else if (b.x > YARD.x1) {
        b.x = YARD.x1;
        b.dir = -1;
      }
      // たまに向きを変える（seedで決定的に）
      if (Math.random() < 0.15 * dt) b.dir *= -1;
    } else if (b.state === "stray") {
      const dx = b.tx - b.x;
      const dy = b.ty - b.y;
      const d = Math.hypot(dx, dy);
      const drifting = b.tx < 0 || b.tx > W; // ベルト到着後は画面端へゆっくり
      if (d > 6) {
        const sp = drifting ? 30 : 95;
        b.x += (dx / d) * sp * dt;
        b.y += (dy / d) * sp * dt;
        b.dir = dx >= 0 ? 1 : -1;
      } else if (b.ty < 300 && Math.abs(b.ty - b.y) < 8 && b.tx > -50 && b.tx < W + 50) {
        // ベルト到着 → 近い方の画面端へトコトコ流れていく
        b.tx = b.x < W / 2 ? -44 : W + 44;
      }
      if (b.x < -36 || b.x > W + 36) {
        // 迷子退場（軽ペナルティ）
        s.lost++;
        s.score = Math.max(0, s.score - LOST_PENALTY);
        if (s.phase === "playing") {
          addPop(s, b.x < 0 ? 90 : W - 90, b.y, `まいご… -${LOST_PENALTY}`);
          sfx.miss();
        }
        s.birds.splice(i, 1);
      }
    } else {
      // return: 捕獲されて巣へ放物線で帰る
      b.stateT += dt;
      const k = Math.min(1, b.stateT / RETURN_T);
      b.x = b.fx + (b.tx - b.fx) * k;
      b.y = b.fy + (b.ty - b.fy) * k - Math.sin(k * Math.PI) * 110;
      if (k >= 1) {
        b.state = "walk";
        b.dir = Math.random() < 0.5 ? 1 : -1;
      }
    }
  }

  // 波紋・殻の破片・紙タグ
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

/** 卵（ペーパークラフト調・縦長） */
function drawEgg(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  e: Egg,
  rot = 0,
  sc = 1,
): void {
  const r = eggR(e.kind) * sc;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(seededJitter(e.seed, 0, 0.12) + rot);
  ctx.scale(1, 1.22);
  const shell = e.kind === "quail" ? "#E8D3AC" : P.paper;
  paperCircle(ctx, 0, 0, r, {
    fill: shell,
    edge: "rgba(58,46,42,.25)",
    edgeWidth: 1.2,
    jitter: r * 0.07,
    seed: e.seed,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
  });
  // 斑点: ウズラ=濃いめ / 紛らわしい卵=薄め（ウズラは薄く・ひよこにも薄く付く）
  let spotAlpha = 0;
  if (e.kind === "quail") spotAlpha = e.tricky ? 0.38 : 0.8;
  else if (e.tricky) spotAlpha = 0.24;
  if (spotAlpha > 0) {
    ctx.fillStyle = P.woodDeep;
    ctx.globalAlpha = spotAlpha;
    const n = e.kind === "quail" && !e.tricky ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const px = seededJitter(e.seed + 3, i * 2, r * 0.55);
      const py = seededJitter(e.seed + 3, i * 2 + 1, r * 0.6);
      const sr = 1.3 + Math.abs(seededJitter(e.seed + 4, i, 1.4));
      ctx.beginPath();
      ctx.ellipse(px, py, sr, sr * 0.8, seededJitter(e.seed + 5, i, 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // ハイライト
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.38, r * 0.24, r * 0.15, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** ヒナ/ウズラ（横向き・dirで反転） */
function drawBird(
  ctx: CanvasRenderingContext2D,
  b: Bird,
  s: number,
): void {
  const bob = Math.sin(b.phase) * s * 0.12;
  ctx.save();
  ctx.translate(b.x, b.y + bob);
  ctx.scale(b.dir, 1);
  const body = b.kind === "chick" ? P.gold : "#8A5A33";
  const wing = b.kind === "chick" ? "#D89A2F" : "#6E4526";
  // 脚（歩きで前後にスイング）
  const swing = Math.sin(b.phase * 2) * s * 0.28;
  ctx.strokeStyle = P.goldDeep;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-s * 0.25, s * 0.6);
  ctx.lineTo(-s * 0.25 + swing, s * 1.08);
  ctx.moveTo(s * 0.25, s * 0.6);
  ctx.lineTo(s * 0.25 - swing, s * 1.08);
  ctx.stroke();
  // 体
  paperCircle(ctx, 0, 0, s, {
    fill: body,
    edge: "rgba(251,240,218,.4)",
    edgeWidth: 1.2,
    jitter: s * 0.09,
    seed: b.seed,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
  });
  // ウズラの斑
  if (b.kind === "quail") {
    ctx.fillStyle = "rgba(58,46,42,.55)";
    for (let i = 0; i < 4; i++) {
      const px = seededJitter(b.seed + 2, i * 2, s * 0.5);
      const py = seededJitter(b.seed + 2, i * 2 + 1, s * 0.5);
      ctx.beginPath();
      ctx.arc(px, py, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 羽
  paperCircle(ctx, -s * 0.28, s * 0.06, s * 0.45, {
    fill: wing,
    jitter: s * 0.1,
    seed: b.seed + 5,
    shadow: "rgba(0,0,0,.15)",
    shadowDy: 2,
  });
  // 頭
  paperCircle(ctx, s * 0.6, -s * 0.72, s * 0.6, {
    fill: body,
    edge: "rgba(251,240,218,.4)",
    edgeWidth: 1,
    jitter: s * 0.08,
    seed: b.seed + 9,
    shadow: "rgba(0,0,0,.2)",
    shadowDy: 2,
  });
  // ウズラの冠羽
  if (b.kind === "quail") {
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s * 0.6, -s * 1.25);
    ctx.lineTo(s * 0.72, -s * 1.6);
    ctx.stroke();
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.arc(s * 0.74, -s * 1.62, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  // くちばし
  paperPoly(
    ctx,
    [
      [s * 1.08, -s * 0.82],
      [s * 1.5, -s * 0.66],
      [s * 1.04, -s * 0.52],
    ],
    {
      fill: b.kind === "chick" ? P.goldDeep : P.gold,
      jitter: 0.8,
      seed: b.seed + 11,
      shadow: "rgba(0,0,0,.2)",
      shadowDy: 1.5,
    },
  );
  // 目
  ctx.fillStyle = P.ink;
  ctx.beginPath();
  ctx.arc(s * 0.74, -s * 0.84, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** ベルトコンベア（木の帯 + 流れる目印 + ローラー） */
function drawBelt(ctx: CanvasRenderingContext2D, s: Sim): void {
  const top = BELT_Y - BELT_H / 2;
  // 脚
  for (const lx of [110, 250, 396]) {
    paperRect(ctx, lx - 7, top + BELT_H - 4, 14, 42, {
      fill: P.woodDeep,
      jitter: 1.5,
      seed: lx,
      shadow: "rgba(0,0,0,.35)",
      shadowDy: 4,
    });
  }
  // 帯
  paperRect(ctx, BELT_LEFT - 16, top, W + 44 - (BELT_LEFT - 16), BELT_H, {
    fill: "#5E4630",
    edge: P.woodDeep,
    edgeWidth: 2,
    jitter: 2.5,
    seed: 61,
    shadow: "rgba(0,0,0,.4)",
    shadowDy: 5,
  });
  // 流れる目印（左へスクロール）
  ctx.strokeStyle = "rgba(238,210,172,.28)";
  ctx.lineWidth = 3;
  const off = s.beltScroll % 34;
  for (let x = BELT_LEFT - off; x < W + 20; x += 34) {
    if (x < BELT_LEFT - 6) continue;
    ctx.beginPath();
    ctx.moveTo(x, top + 7);
    ctx.lineTo(x - 8, top + BELT_H - 7);
    ctx.stroke();
  }
  // 左端ローラー（回転スポーク）
  paperCircle(ctx, BELT_LEFT, BELT_Y, 27, {
    fill: P.wood,
    edge: P.woodDeep,
    edgeWidth: 2,
    jitter: 2,
    seed: 63,
    shadow: "rgba(0,0,0,.4)",
    shadowDy: 4,
  });
  const rot = -s.beltScroll / 27;
  ctx.strokeStyle = P.woodDeep;
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const a = rot + (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(BELT_LEFT - Math.cos(a) * 18, BELT_Y - Math.sin(a) * 18);
    ctx.lineTo(BELT_LEFT + Math.cos(a) * 18, BELT_Y + Math.sin(a) * 18);
    ctx.stroke();
  }
  ctx.fillStyle = P.kraft;
  ctx.beginPath();
  ctx.arc(BELT_LEFT, BELT_Y, 5, 0, Math.PI * 2);
  ctx.fill();
}

/** 先頭卵のハイライト（金の輪 + ぴょこぴょこ矢印） */
function drawFrontMark(ctx: CanvasRenderingContext2D, s: Sim): void {
  const egg = frontEgg(s);
  if (!egg) return;
  const x = egg.x;
  const y = eggY(egg.kind);
  const r = eggR(egg.kind) * 1.6 + Math.sin(s.t * 5) * 2;
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.75 + Math.sin(s.t * 5) * 0.2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const ay = y - r - 16 + Math.sin(s.t * 6) * 3;
  paperPoly(
    ctx,
    [
      [x - 9, ay - 10],
      [x + 9, ay - 10],
      [x, ay + 4],
    ],
    {
      fill: P.gold,
      edge: P.goldDeep,
      edgeWidth: 1.5,
      jitter: 1.2,
      seed: 67,
      shadow: "rgba(0,0,0,.3)",
      shadowDy: 3,
    },
  );
}

/** 巣（わらのお椀 + 親鳥 + 目印の看板） */
function drawNest(
  ctx: CanvasRenderingContext2D,
  kind: EggKind,
  t: number,
): void {
  const { x, y } = NEST_OF[kind];
  const seed = kind === "quail" ? 81 : 85;
  // わらのお椀
  paperCircle(ctx, x, y, 36, {
    fill: "#8A6236",
    edge: P.kraftDeep,
    edgeWidth: 2,
    jitter: 3,
    seed,
    shadow: "rgba(0,0,0,.4)",
    shadowDy: 5,
  });
  paperCircle(ctx, x, y - 4, 25, {
    fill: "#54391F",
    jitter: 2.2,
    seed: seed + 1,
    shadow: "rgba(0,0,0,.2)",
    shadowDy: 2,
  });
  // わらの毛（短い線）
  ctx.strokeStyle = "rgba(238,210,172,.4)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + seededJitter(seed, i, 0.3);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 32, y + Math.sin(a) * 32);
    ctx.lineTo(x + Math.cos(a) * 42, y + Math.sin(a) * 40);
    ctx.stroke();
  }
  // 親鳥（巣の外側に立つ）
  const parent: Bird = {
    id: 0,
    kind,
    x: kind === "quail" ? x - 52 : x + 52,
    y: y + 4,
    dir: kind === "quail" ? 1 : -1,
    state: "walk",
    stateT: 0,
    tx: 0,
    ty: 0,
    fx: 0,
    fy: 0,
    phase: t * 2 + seed,
    seed: seed + 3,
  };
  drawBird(ctx, parent, 16);
  // 看板（ミニ卵アイコン + かな）
  const sy = y - 72;
  paperRect(ctx, x - 48, sy - 17, 96, 34, {
    fill: P.kraftLight,
    edge: kind === "quail" ? P.teal : P.red,
    edgeWidth: 2,
    jitter: 2,
    seed: seed + 7,
    shadow: "rgba(0,0,0,.35)",
    shadowDy: 3,
  });
  const iconEgg: Egg = {
    id: 0,
    kind,
    tricky: false,
    x: 0,
    state: "belt",
    stateT: 0,
    fx: 0,
    fy: 0,
    bob: 0,
    seed: seed + 9,
  };
  drawEgg(ctx, x - 28, sy + 1, iconEgg, 0, 0.62);
  ctx.font = "900 15px 'Zen Maru Gothic','Hiragino Maru Gothic ProN',sans-serif";
  ctx.fillStyle = P.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(kind === "quail" ? "うずら" : "ひよこ", x + 8, sy + 1);
}

/** 最下段の運動場（夜の芝生 + 柵） */
function drawYard(ctx: CanvasRenderingContext2D): void {
  paperRect(ctx, -14, YARD.y0 - 22, W + 28, H - YARD.y0 + 40, {
    fill: "#0E3A31",
    edge: "rgba(31,126,107,.5)",
    edgeWidth: 2,
    jitter: 3,
    seed: 93,
    shadow: "rgba(0,0,0,.3)",
    shadowDy: 3,
  });
  // 柵
  for (let i = 0; i < 9; i++) {
    const fx = 24 + i * 54;
    paperRect(ctx, fx - 3, YARD.y0 - 34, 6, 22, {
      fill: P.kraftDeep,
      jitter: 1,
      seed: 95 + i,
      shadow: "rgba(0,0,0,.3)",
      shadowDy: 2,
    });
  }
  ctx.strokeStyle = P.kraftDeep;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(10, YARD.y0 - 26);
  ctx.lineTo(W - 10, YARD.y0 - 26);
  ctx.stroke();
}

/** 飛翔中の卵（放物線で巣へ） */
function drawFlyingEgg(ctx: CanvasRenderingContext2D, e: Egg): void {
  const nest = NEST_OF[e.kind];
  const k = Math.min(1, e.stateT / FLIGHT_T);
  const px = e.fx + (nest.x - e.fx) * k;
  const py = e.fy + (nest.y - 10 - e.fy) * k - Math.sin(k * Math.PI) * 130;
  drawEgg(ctx, px, py, e, k * 6, 1 - 0.25 * k);
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

/** 紙タグポップ（「+25」「ほかく！+15」等） */
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

/** 指先マーカー（cursor-none の代わり） */
function drawCursor(ctx: CanvasRenderingContext2D, s: Sim): void {
  const { x, y } = s.ptr;
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = P.paper;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = P.gold;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function render(ctx: CanvasRenderingContext2D, s: Sim): void {
  drawNightSky(ctx, W, H, 11);
  drawLantern(ctx, 52, 62, 20);
  drawLantern(ctx, W - 54, 84, 16, P.gold);
  // 左右ゾーンのうっすら境界線
  ctx.strokeStyle = "rgba(251,240,218,.1)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(W / 2, BELT_Y + 46);
  ctx.lineTo(W / 2, NEST_L.y - 96);
  ctx.stroke();
  ctx.setLineDash([]);

  drawYard(ctx);
  drawNest(ctx, "quail", s.t);
  drawNest(ctx, "chick", s.t);
  drawBelt(ctx, s);
  for (const e of s.eggs) {
    if (e.state === "belt" && e.x < W + 24) {
      drawEgg(ctx, e.x, eggY(e.kind) + Math.sin(e.bob) * 1.5, e);
    }
  }
  if (s.phase === "playing") drawFrontMark(ctx, s);
  // 運動場のヒナ → 迷い込み/帰還ヒナは卵の上に重ねて描く
  for (const b of s.birds) if (b.state === "walk") drawBird(ctx, b, 11);
  for (const b of s.birds) if (b.state !== "walk") drawBird(ctx, b, 12);
  for (const e of s.eggs) if (e.state === "fly") drawFlyingEgg(ctx, e);
  drawScraps(ctx, s);
  drawRings(ctx, s);
  if (s.phase === "playing" && s.ptr.on) drawCursor(ctx, s);
  drawPops(ctx, s);
}

/* ================= コンポーネント ================= */

function rankTitle(score: number): string {
  if (score >= 1300) return "たまご仙人！";
  if (score >= 800) return "鑑別名人！";
  if (score >= 400) return "いい目してる！";
  if (score >= 150) return "もうちょい！";
  return "また挑戦してね";
}

const CARD_CLASS =
  "torn border-[3px] border-kraft-paper bg-kraft paper-grain shadow-paper text-fes-ink p-6 text-center max-w-xs";
const BTN_CLASS =
  "rounded-full bg-fes-red border-2 border-fes-red-deep text-kraft-paper font-maru font-black px-8 py-2.5 shadow-paper-sm hover:-translate-y-0.5 transition-transform";

export default function TamagowakeGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<Sim | null>(null);
  const uiKeyRef = useRef("");
  const [ui, setUi] = useState<Ui>({
    phase: "ready",
    score: 0,
    sec: GAME_TIME,
    miss: 0,
    combo: 0,
    chick: 0,
    quail: 0,
    captured: 0,
  });

  const pushUi = useCallback(() => {
    const s = simRef.current;
    if (!s) return;
    const next: Ui = {
      phase: s.phase,
      score: s.score,
      sec: Math.max(0, Math.ceil(s.time)),
      miss: s.miss,
      combo: s.combo,
      chick: s.hatched.chick,
      quail: s.hatched.quail,
      captured: s.captured,
    };
    const key = `${next.phase}|${next.score}|${next.sec}|${next.miss}|${next.combo}|${next.chick},${next.quail},${next.captured}`;
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
      s.ptr.x = x;
      s.ptr.y = y;
      s.ptr.on = true;
      tapAction(s, x, y);
    };
    const onMove = (e: PointerEvent) => {
      const s = simRef.current;
      if (!s) return;
      const [x, y] = toLocal(e);
      s.ptr.x = x;
      s.ptr.y = y;
      s.ptr.on = true;
    };
    const onLeave = () => {
      const s = simRef.current;
      if (s) s.ptr.on = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

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
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [pushUi]);

  const total = ui.chick + ui.quail;

  const scoreboard = (
    <div className="flex items-center justify-between font-maru text-sm font-black">
      <span>⏱ のこり {ui.sec}</span>
      <span aria-label={`ミス ${ui.miss}回`}>
        ミス {"●".repeat(ui.miss)}
        {"○".repeat(Math.max(0, MISS_MAX - ui.miss))}
      </span>
      <span>かえった {total}</span>
    </div>
  );

  const overlay =
    ui.phase === "ready" ? (
      <div className={CARD_CLASS}>
        <h2 className="font-maru font-black text-2xl text-fes-indigo">
          🥚 たまごわけ
        </h2>
        <p className="mt-3 font-maru text-sm font-bold">
          先頭のたまごを見きわめてタップ！
        </p>
        <p className="mt-1.5 font-maru text-xs font-bold">30秒・ミス3回でおしまい</p>
        <ul className="mt-2 space-y-0.5 text-left font-maru text-xs font-bold text-fes-ink/80">
          <li>・斑点の小さい卵 → 左のうずらの巣へ</li>
          <li>・無地の大きい卵 → 右のひよこの巣へ</li>
          <li>・れんぞく正解でコンボ倍率アップ（最大×2.5）</li>
          <li>・迷いこんだヒナはタップで巣に返す（+15）</li>
          <li>・流しても割ってもミス。後半は薄斑点にちゅうい</li>
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
          🐤×{ui.chick}　🐦×{ui.quail}　つかまえた×{ui.captured}
        </p>
        <div className="mt-4 space-y-3 text-left">
          <ScoreSubmit game="tamagowake" score={ui.score} />
          <Leaderboard game="tamagowake" />
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
      title="た ま ご わ け"
      tagline="ひよこ・ウズラの巣づくり"
      scoreboard={scoreboard}
      overlay={overlay}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-none touch-none"
        aria-label="たまごわけのゲーム画面"
      />
    </GameShell>
  );
}
