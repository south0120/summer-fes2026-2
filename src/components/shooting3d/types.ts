import type * as THREE from "three";

/* ============================================================
 * 3D射的 共通型定義
 * - コールバック契約は 2D 版（ShootingGameCanvas）と完全一致
 * ============================================================ */

export type ShootingStats = { hits: number; shots: number };

/* ---------- 弾数（リロード制限） ---------- */

/** 弾数上限。撃ち切ったらタップでリロード（2D 版に合わせて 6 発） */
export const MAX_AMMO = 6;
/** リロード所要時間（ms） */
export const RELOAD_MS = 1200;

export type GameCanvasProps = {
  /** true の間タイマーが進む（初回 true でゲーム開始） */
  playing: boolean;
  /** 制限時間（秒） */
  duration?: number;
  onScoreChange: (score: number) => void;
  onTimeChange: (secondsLeft: number) => void;
  onEnd: (finalScore: number, stats: ShootingStats) => void;
};

/* ---------- 的 ---------- */

export type TargetKind =
  | "balloonBig"
  | "balloonSmall"
  | "canBig"
  | "canSmall"
  | "gold"
  | "platinum";

export const KIND_CONF: Record<
  TargetKind,
  { points: number; scale: number; speed: [number, number] }
> = {
  // scale はベースジオメトリに対する倍率。小さいほど速くて高得点
  balloonBig: { points: 10, scale: 1, speed: [0.28, 0.44] },
  balloonSmall: { points: 30, scale: 0.62, speed: [0.48, 0.7] },
  canBig: { points: 20, scale: 1, speed: [0.34, 0.5] },
  canSmall: { points: 50, scale: 0.66, speed: [0.56, 0.84] },
  gold: { points: 100, scale: 0.8, speed: [0.9, 1.15] },
  // 大当たり「プラチナ星」: 超レア・最小・最速・当たり判定極小の 300 点
  platinum: { points: 300, scale: 0.42, speed: [1.5, 1.95] },
};

// 出現の重み（大きい的が多め）。金の的はリスポーン時に低確率で差し込む
export const KIND_POOL: TargetKind[] = [
  "balloonBig",
  "balloonBig",
  "balloonBig",
  "canBig",
  "canBig",
  "canBig",
  "balloonSmall",
  "balloonSmall",
  "canSmall",
  "canSmall",
];

/** fes.* パレット（tailwind.config.ts と同値） */
export const PALETTE = [
  { main: "#E5372B", deep: "#B3221B" }, // fes.red
  { main: "#2B6CB0", deep: "#1F5288" }, // fes.blue
  { main: "#F2B705", deep: "#C79403" }, // fes.yellow
  { main: "#3FA34D", deep: "#2F7E3B" }, // fes.green
] as const;

export const FES = {
  red: "#E5372B",
  redDeep: "#B3221B",
  blue: "#2B6CB0",
  blueDeep: "#1F5288",
  yellow: "#F2B705",
  yellowDeep: "#C79403",
  green: "#3FA34D",
  greenDeep: "#2F7E3B",
  cream: "#FBF3DC",
  creamDeep: "#F3E6C2",
  ink: "#3A2E2A",
  paper: "#FFFDF5",
} as const;

/* ---------- ワールド座標系 ---------- */

// 棚 3 段の高さ（2D 版 LANES = [0.24, 0.44, 0.64] に相当）
export const LANE_Y = [2.3, 1.5, 0.7] as const;
// 的が動く x 範囲（この外でワープ）
export const X_WRAP = 2.0;
export const X_VISIBLE = 1.55;
// 的が乗る面の z
export const TARGET_Z = 0;

export type TargetState = {
  slot: number;
  kind: TargetKind;
  lane: number;
  x: number;
  dir: 1 | -1;
  speed: number; // world unit / 秒
  bobPhase: number;
  scale: number;
  points: number;
  colorIdx: number; // PALETTE index
  alive: boolean;
  /** 当たり判定球の半径（タップ余白込み） */
  colR: number;
  /** リスポーン直後のポップイン経過秒（>=0.15 で通常表示） */
  bornT: number;
  // 撃破アニメーション
  dying: "none" | "pop" | "fly";
  dieT: number; // 経過秒
  vel: THREE.Vector3 | null; // 缶吹っ飛び速度
  spin: number;
};

/* ---------- DOM 側へのフィードバック（フロートテキスト/オカン） ---------- */

export type OkanMood = "happy" | "great" | "miss";

export type FxBridge = {
  /** 正規化座標(0..1)にフロートテキストを出す */
  spawnFloat: (
    nx: number,
    ny: number,
    text: string,
    color: string,
    big: boolean,
  ) => void;
  okan: (mood: OkanMood) => void;
  crosshairPulse: (hit: boolean) => void;
  /** 大当たり（プラチナ星）出現の予告演出（バナー表示） */
  rare: () => void;
};

/* ---------- Canvas 内外の橋渡し ---------- */

export type World = {
  // スコア・タイマー（useFrame 内で ref 直接ミューテート）
  score: number;
  combo: number;
  hits: number;
  shots: number;
  started: boolean;
  startAt: number;
  lastSec: number;
  ended: boolean;
  playing: boolean;
  duration: number;
  // 弾数（撃ち切ったらタップでリロード）
  ammo: number;
  reloading: boolean;
  // 照準ズレ（ゲーム開始時にランダム決定・NDC 単位）
  aimDrift: { x: number; y: number };
  // カメラシェイク（残り秒数）
  shake: number;
  // 的
  targets: TargetState[];
  respawns: { slot: number; lane: number; at: number }[];
  // Canvas 内コンポーネントが登録するフック
  shoot: ((ndcX: number, ndcY: number) => void) | null;
  gunFire: (() => void) | null;
  effects: {
    confetti: (pos: THREE.Vector3, main: string, deep: string) => void;
    stars: (pos: THREE.Vector3) => void;
    goldBurst: (pos: THREE.Vector3) => void;
    missRing: (pos: THREE.Vector3) => void;
  } | null;
  // DOM 側（GameStage）が登録するフィードバック
  fx: FxBridge | null;
  // コールバック（最新を ref 経由で参照）
  cb: {
    onScoreChange: (score: number) => void;
    onTimeChange: (sec: number) => void;
    onEnd: (finalScore: number, stats: ShootingStats) => void;
  };
};

/* ---------- 純粋ヘルパー ---------- */

export const rand = (min: number, max: number) =>
  min + Math.random() * (max - min);

export const pick = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];
