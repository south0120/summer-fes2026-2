"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GameShell from "@/components/game/GameShell";
import PaperCard from "@/components/PaperCard";
import ScoreSubmit from "@/components/game/ScoreSubmit";
import Leaderboard from "@/components/game/Leaderboard";
import Scene from "./Scene";
import {
  AmmoIndicator,
  Crosshair,
  FloatLayer,
  OkanLayer,
  RareBanner,
  type CrosshairHandle,
  type FloatLayerHandle,
  type OkanReaction,
} from "./Crosshair";
import { closeAudio, resumeAudio } from "./sound";
import { disposeAssets } from "./textures";
import {
  MAX_AMMO,
  RELOAD_MS,
  pick,
  rand,
  type GameCanvasProps,
  type OkanMood,
  type ShootingStats,
  type World,
} from "./types";

export type { ShootingStats };

/* ============================================================
 * 3D射的 メイン
 * - phase 機械 / GameShell / overlay は 2D 版 shooting/page.tsx を踏襲
 * - accent は yellow（red=射的2D / blue=金魚 / green=わなげ と住み分け）
 * - ゲーム⇄ページのコールバック契約は 2D 版と完全一致
 * ============================================================ */

const DURATION = 30;
/** 照準を指の位置よりこの px 分だけ上に出す（指で的が隠れないように）。2D 版の AIM_OFFSET_Y=70 に相当 */
const AIM_OFFSET_PX = 64;

/** リザルトのオカン総評（2D 版から移植） */
function okanComment(score: number): string {
  if (score >= 400) return "射的の天才あらわれたで！景品ぜんぶ持ってき！";
  if (score >= 250) return "めっちゃうまいやん！屋台のおっちゃんもびっくりや";
  if (score >= 120) return "なかなかスジええで！もう一回いっとく？";
  if (score > 0) return "まだまだこれからや！つぎは小さい的ねらってみ〜";
  return "あらら…オカンと特訓しよか。もう一回や！";
}

/** プレイ中のオカンのセリフ（2D 版から移植） */
const OKAN_LINES: Record<OkanMood, string[]> = {
  happy: ["ええやん！", "うまい！", "その調子や！"],
  great: ["ナイス！！", "天才ちゃう！？", "めっちゃすごい！"],
  miss: ["おしい〜！", "ドンマイ！", "つぎいこつぎ！"],
};

function createWorld(duration: number): World {
  return {
    score: 0,
    combo: 0,
    hits: 0,
    shots: 0,
    started: false,
    startAt: 0,
    lastSec: -1,
    ended: false,
    playing: false,
    duration,
    ammo: MAX_AMMO,
    reloading: false,
    aimDrift: { x: 0, y: 0 },
    shake: 0,
    targets: [],
    respawns: [],
    shoot: null,
    gunFire: null,
    effects: null,
    fx: null,
    cb: {
      onScoreChange: () => {},
      onTimeChange: () => {},
      onEnd: () => {},
    },
  };
}

/* ============================================================
 * GameStage — 3D Canvas + DOM オーバーレイ（2D 版 ShootingGameCanvas 相当）
 * props 契約は 2D 版と完全一致
 * ============================================================ */

function GameStage({
  playing,
  duration = DURATION,
  onScoreChange,
  onTimeChange,
  onEnd,
}: GameCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const crossRef = useRef<CrosshairHandle>(null);
  const floatRef = useRef<FloatLayerHandle>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionIdRef = useRef(0);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [reaction, setReaction] = useState<OkanReaction | null>(null);
  // 大当たり予告バナーのトリガーID（増えるたびに再生）
  const [rareCue, setRareCue] = useState(0);
  // 終了後は frameloop を demand にして GPU/バッテリーを節約
  const [ended, setEnded] = useState(false);
  // 残弾 UI（world.ammo のミラー。実弾数の正はあくまで world 側）
  const [ammo, setAmmo] = useState(MAX_AMMO);
  const [reloading, setReloading] = useState(false);

  const world = useMemo(() => createWorld(duration), [duration]);

  // コールバックは毎レンダーで最新を world に反映（useFrame 側は ref 参照）
  useEffect(() => {
    world.cb = {
      onScoreChange,
      onTimeChange,
      onEnd: (finalScore, stats) => {
        setEnded(true);
        onEnd(finalScore, stats);
      },
    };
  }, [world, onScoreChange, onTimeChange, onEnd]);

  // playing 遷移: 初回 true でタイマー開始（2D 版と同じ）
  // あわせて今回プレイの照準ズレ（エイムドリフト）をランダム決定
  useEffect(() => {
    world.playing = playing;
    if (playing && !world.started) {
      world.started = true;
      world.startAt = performance.now();
      world.lastSec = -1;
      world.aimDrift = { x: rand(-0.06, 0.06), y: rand(-0.04, 0.04) };
    }
  }, [world, playing]);

  // リロード（1.2 秒後に満タン）。タイマーは setTimeout + ref で管理
  const startReload = useCallback(() => {
    if (world.reloading || world.ammo >= MAX_AMMO) return;
    world.reloading = true;
    setReloading(true);
    reloadTimerRef.current = setTimeout(() => {
      world.ammo = MAX_AMMO;
      world.reloading = false;
      setAmmo(MAX_AMMO);
      setReloading(false);
    }, RELOAD_MS);
  }, [world]);

  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, []);

  // オカンのリアクション
  const showOkan = useCallback((mood: OkanMood) => {
    reactionIdRef.current += 1;
    setReaction({
      mood,
      text: pick(OKAN_LINES[mood]),
      id: reactionIdRef.current,
    });
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = setTimeout(() => setReaction(null), 1500);
  }, []);

  // DOM 側フィードバックを world に登録
  useEffect(() => {
    world.fx = {
      spawnFloat: (nx, ny, text, color, big) =>
        floatRef.current?.spawn(nx, ny, text, color, big),
      okan: showOkan,
      crosshairPulse: (hit) => crossRef.current?.pulse(hit),
      rare: () => setRareCue((n) => n + 1),
    };
    return () => {
      world.fx = null;
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    };
  }, [world, showOkan]);

  /* ----- 入力（ポインタ統一: PC=エイム+クリック / スマホ=タップ即射撃） ----- */

  const localPos = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      w: rect.width,
      h: rect.height,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!wrapRef.current) return;
    const { x, y } = localPos(e);
    // 照準は指より上に出す（タップ位置と狙点をずらす＝指で的が隠れない）
    crossRef.current?.move(x, Math.max(0, y - AIM_OFFSET_PX));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!wrapRef.current) return;
    const { x, y, w, h } = localPos(e);
    // 狙点はタップ位置より上（クロスヘア表示と raycast を同じ座標に揃える）
    const aimY = Math.max(0, y - AIM_OFFSET_PX);
    crossRef.current?.move(x, aimY);
    // ユーザー操作起点で AudioContext を用意（自動再生制約対策）
    resumeAudio();
    // リロード中は撃てない
    if (world.reloading) return;
    // 弾切れ時のタップはリロード開始
    if (world.ammo <= 0) {
      if (world.started && !world.ended) startReload();
      return;
    }
    const ndcX = (x / w) * 2 - 1;
    const ndcY = -((aimY / h) * 2 - 1);
    world.shoot?.(ndcX, ndcY);
    // world.shoot 内で減弾されるので同期的にミラーを更新
    setAmmo(world.ammo);
  };

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 cursor-crosshair touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      aria-label="3D射的ゲームのステージ"
    >
      <Scene world={world} active={!ended} />
      <Crosshair ref={crossRef} />
      <FloatLayer ref={floatRef} />
      <OkanLayer reaction={reaction} />
      {!ended && <RareBanner show={rareCue} />}
      {!ended && <AmmoIndicator ammo={ammo} max={MAX_AMMO} reloading={reloading} />}
    </div>
  );
}

/* ============================================================
 * ページ相当（phase 機械 + GameShell + overlay）
 * ============================================================ */

export default function ShootingGame3D() {
  const [phase, setPhase] = useState<"ready" | "playing" | "result">("ready");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [stats, setStats] = useState<ShootingStats>({ hits: 0, shots: 0 });
  const [runId, setRunId] = useState(0);

  const start = () => {
    setScore(0);
    setTimeLeft(DURATION);
    setStats({ hits: 0, shots: 0 });
    setRunId((n) => n + 1); // GameStage を作り直してリスタート
    setPhase("playing");
  };

  const handleEnd = useCallback((finalScore: number, s: ShootingStats) => {
    setScore(finalScore);
    setStats(s);
    setPhase("result");
  }, []);

  // ページ離脱時に共有 3D 資産と AudioContext を破棄
  useEffect(() => {
    return () => {
      disposeAssets();
      closeAudio();
    };
  }, []);

  const accuracy =
    stats.shots > 0 ? Math.round((stats.hits / stats.shots) * 100) : 0;

  return (
    <GameShell
      title="３Ｄ射的"
      tagline="タップで立体の的をねらいうち！"
      scoreboard={
        <>
          <span>スコア: {score}</span>
          <span className={timeLeft <= 5 && phase === "playing" ? "text-fes-red" : ""}>
            のこり: {timeLeft}秒
          </span>
        </>
      }
      overlay={
        phase === "ready" ? (
          <PaperCard
            color="kraft"
            elevation="lg"
            className="w-full max-w-xs px-6 py-6 text-center text-fes-ink"
          >
            <h2 className="font-hand text-3xl font-bold text-fes-gold-deep">🎯 3D射的</h2>
            <p className="mt-3 font-maru text-sm font-bold leading-relaxed">
              本格3Dの射的台！
              <br />
              立体の的をタップでねらいうち！
              <br />
              制限時間は30秒。
            </p>
            <p className="mt-2 font-maru text-xs font-bold text-fes-ink/60">
              ちいさい的ほど高得点！
              <br />
              🎈 風船 10/30点 ・ 🥫 缶 20/50点
              <br />
              ⭐ 金の的はレアの100点！
            </p>
            <button
              type="button"
              onClick={start}
              className="mt-5 w-full rounded-full bg-fes-gold-deep px-6 py-3 font-maru text-lg font-bold text-white shadow-paper transition-transform active:translate-y-0.5 active:shadow-paper-press"
            >
              はじめる！
            </button>
          </PaperCard>
        ) : phase === "result" ? (
          <PaperCard
            color="kraft"
            elevation="lg"
            className="w-full max-w-xs px-6 py-6 text-center text-fes-ink"
          >
            <h2 className="font-hand text-2xl font-bold text-fes-gold-deep">けっか発表！</h2>
            <p className="mt-2 font-hand text-5xl font-bold text-fes-ink">
              {score}
              <span className="text-2xl">点</span>
            </p>
            <p className="mt-1 font-maru text-xs font-bold text-fes-ink/60">
              命中 {stats.hits} / {stats.shots} 発（{accuracy}%）
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <Image
                src="/mascot/okan-avatar.png"
                alt="オカン"
                width={44}
                height={68}
              />
              <p className="rounded-paper border-2 border-kraft-deep bg-kraft-light px-3 py-2 text-left font-maru text-xs font-bold leading-relaxed">
                {okanComment(score)}
              </p>
            </div>
            <div className="mt-4 space-y-3 text-left">
              <ScoreSubmit game="shooting-3d" score={score} />
              <Leaderboard game="shooting-3d" />
            </div>
            <button
              type="button"
              onClick={start}
              className="mt-4 w-full rounded-full bg-fes-gold-deep px-6 py-3 font-maru text-lg font-bold text-white shadow-paper transition-transform active:translate-y-0.5 active:shadow-paper-press"
            >
              もう一回！
            </button>
            <Link
              href="/"
              className="mt-4 block font-maru text-xs font-bold text-fes-ink/70 underline underline-offset-2"
            >
              ← 会場にもどる
            </Link>
          </PaperCard>
        ) : null
      }
    >
      <GameStage
        key={runId}
        playing={phase === "playing"}
        duration={DURATION}
        onScoreChange={setScore}
        onTimeChange={setTimeLeft}
        onEnd={handleEnd}
      />
    </GameShell>
  );
}
