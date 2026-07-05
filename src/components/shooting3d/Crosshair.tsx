"use client";

import Image from "next/image";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { RELOAD_MS, type OkanMood } from "./types";

/* ============================================================
 * DOM オーバーレイ層（クロスヘア / フロートテキスト / オカン）
 * - すべて pointer-events-none。3D Canvas の上に重ねる
 * - クロスヘアの追従は ref の style 直接更新（setState しない）
 * - フロートテキストは発生時のみ setState（毎フレームではない）
 * ============================================================ */

/* ---------- クロスヘア ---------- */

export type CrosshairHandle = {
  /** ステージ内ローカル座標(px)へ移動 */
  move: (x: number, y: number) => void;
  /** 命中/ミスの一瞬のフィードバック */
  pulse: (hit: boolean) => void;
};

export const Crosshair = forwardRef<CrosshairHandle>(function Crosshair(
  _props,
  ref,
) {
  const elRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    move: (x, y) => {
      const el = elRef.current;
      if (el) el.style.transform = `translate(${x}px, ${y}px)`;
    },
    pulse: (hit) => {
      const el = elRef.current;
      if (!el) return;
      const cls = hit ? "xh-hit" : "xh-miss";
      el.classList.remove("xh-hit", "xh-miss");
      // 再アニメーションのため reflow を挟む
      void el.offsetWidth;
      el.classList.add(cls);
    },
  }));

  return (
    <div
      ref={elRef}
      className="pointer-events-none absolute left-0 top-0 z-[4]"
      style={{ transform: "translate(-100px, -100px)" }}
      aria-hidden
    >
      <div className="xh-body relative -left-[19px] -top-[19px] h-[38px] w-[38px]">
        {/* 丸フレーム（切り紙風の白フチ + fes-red） */}
        <div className="absolute inset-0 rounded-full border-[3px] border-fes-red shadow-[0_0_0_2px_rgba(255,253,245,0.9)]" />
        {/* 十字のツメ */}
        <div className="absolute left-1/2 top-[-6px] h-[9px] w-[3px] -translate-x-1/2 rounded-full bg-fes-red" />
        <div className="absolute bottom-[-6px] left-1/2 h-[9px] w-[3px] -translate-x-1/2 rounded-full bg-fes-red" />
        <div className="absolute left-[-6px] top-1/2 h-[3px] w-[9px] -translate-y-1/2 rounded-full bg-fes-red" />
        <div className="absolute right-[-6px] top-1/2 h-[3px] w-[9px] -translate-y-1/2 rounded-full bg-fes-red" />
        {/* 中心点 */}
        <div className="absolute left-1/2 top-1/2 h-[4px] w-[4px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fes-red" />
      </div>
      <style>{`
        @keyframes xhHit {
          0% { transform: scale(1); }
          35% { transform: scale(1.45); }
          100% { transform: scale(1); }
        }
        @keyframes xhMiss {
          0% { transform: scale(1); }
          40% { transform: scale(0.72); }
          100% { transform: scale(1); }
        }
        .xh-hit .xh-body { animation: xhHit 0.18s ease-out; }
        .xh-miss .xh-body { animation: xhMiss 0.18s ease-out; }
      `}</style>
    </div>
  );
});

/* ---------- 大当たり出現の予告バナー ---------- */

export function RareBanner({ show }: { show: number }) {
  // show = トリガーID。変わるたびに key で再マウントしてアニメを再生
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[15%] z-[6] flex justify-center px-3">
      <div
        key={show}
        className="rare-banner rounded-full border-2 border-fes-gold-deep bg-night-900/85 px-4 py-2 font-hand text-lg font-bold text-fes-gold shadow-glow"
      >
        🌈 レアの的だ！ ねらえ！！
      </div>
      <style>{`
        @keyframes rareBannerIn {
          0% { opacity: 0; transform: translateY(-10px) scale(0.8); }
          14% { opacity: 1; transform: translateY(0) scale(1.08); }
          80% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-6px) scale(1); }
        }
        .rare-banner { animation: rareBannerIn 1.6s ease-out both; }
      `}</style>
    </div>
  );
}

/* ---------- 残弾インジケーター（●●●○○ / リロード） ---------- */

export function AmmoIndicator({
  ammo,
  max,
  reloading,
}: {
  ammo: number;
  max: number;
  reloading: boolean;
}) {
  return (
    <div className="pointer-events-none absolute bottom-2 right-2 z-[5] flex flex-col items-end gap-1">
      {reloading ? (
        <div className="rounded-paper border-2 border-kraft-deep bg-kraft-paper px-2.5 py-1.5 shadow-paper-sm">
          <p className="font-maru text-xs font-bold text-fes-ink">装填中...</p>
          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-kraft-deep">
            <div
              className="ammo-reload-bar h-full rounded-full bg-fes-gold-deep"
              style={{ animationDuration: `${RELOAD_MS}ms` }}
            />
          </div>
        </div>
      ) : ammo <= 0 ? (
        <p className="ammo-blink rounded-paper border-2 border-fes-red bg-kraft-paper px-2.5 py-1.5 font-maru text-xs font-bold text-fes-red shadow-paper-sm">
          🔄 タップでリロード
        </p>
      ) : null}
      <p
        className="font-hand text-xl font-bold tracking-[0.18em] text-kraft-paper drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
        aria-label={`残弾 ${ammo} / ${max}`}
      >
        {"●".repeat(Math.max(0, ammo))}
        {"○".repeat(Math.max(0, max - ammo))}
      </p>
      <style>{`
        @keyframes ammoBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
        .ammo-blink { animation: ammoBlink 0.8s ease-in-out infinite; }
        @keyframes ammoReload {
          from { width: 0%; }
          to { width: 100%; }
        }
        .ammo-reload-bar { animation: ammoReload linear both; }
      `}</style>
    </div>
  );
}

/* ---------- フロートテキスト（+30 など） ---------- */

type FloatItem = {
  id: number;
  nx: number;
  ny: number;
  text: string;
  color: string;
  big: boolean;
};

export type FloatLayerHandle = {
  spawn: (
    nx: number,
    ny: number,
    text: string,
    color: string,
    big: boolean,
  ) => void;
};

export const FloatLayer = forwardRef<FloatLayerHandle>(function FloatLayer(
  _props,
  ref,
) {
  const [items, setItems] = useState<FloatItem[]>([]);
  const idRef = useRef(0);

  const spawn = useCallback(
    (nx: number, ny: number, text: string, color: string, big: boolean) => {
      idRef.current += 1;
      const id = idRef.current;
      setItems((prev) => [...prev.slice(-7), { id, nx, ny, text, color, big }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((f) => f.id !== id));
      }, 850);
    },
    [],
  );

  useImperativeHandle(ref, () => ({ spawn }), [spawn]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[4] overflow-hidden">
      {items.map((f) => (
        <span
          key={f.id}
          className={`float-up absolute -translate-x-1/2 font-maru font-bold ${
            f.big ? "text-2xl" : "text-lg"
          }`}
          style={{
            left: `${f.nx * 100}%`,
            top: `${f.ny * 100}%`,
            color: f.color,
            WebkitTextStroke: "4px #FFFDF5",
            paintOrder: "stroke fill",
          }}
        >
          {f.text}
        </span>
      ))}
      <style>{`
        @keyframes floatUp {
          0% { opacity: 0; margin-top: 6px; transform: translateX(-50%) scale(0.7); }
          15% { opacity: 1; transform: translateX(-50%) scale(1.1); }
          100% { opacity: 0; margin-top: -34px; transform: translateX(-50%) scale(1); }
        }
        .float-up { animation: floatUp 0.85s ease-out both; }
      `}</style>
    </div>
  );
});

/* ---------- オカンのリアクション（2D 版から移植） ---------- */

export type OkanReaction = { mood: OkanMood; text: string; id: number };

export function OkanLayer({ reaction }: { reaction: OkanReaction | null }) {
  return (
    <div className="pointer-events-none absolute bottom-1.5 left-2 z-[5] flex items-end gap-1.5">
      <div key={reaction?.id ?? 0} className={reaction ? `okan-${reaction.mood}` : ""}>
        <Image
          src="/mascot/okan-avatar.png"
          alt="オカン"
          width={52}
          height={80}
          className="drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]"
          priority
        />
      </div>
      {reaction && (
        <div
          key={`b-${reaction.id}`}
          className="okan-bubble mb-8 rounded-paper border-2 border-kraft-deep bg-kraft-paper px-2.5 py-1.5 font-maru text-xs font-bold text-fes-ink shadow-paper-sm"
        >
          {reaction.text}
        </div>
      )}
      <style>{`
        @keyframes okanBubbleIn {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .okan-bubble { animation: okanBubbleIn 0.22s ease-out both; transform-origin: left bottom; }
        @keyframes okanHop {
          0%, 100% { transform: translateY(0); }
          40% { transform: translateY(-9px); }
        }
        .okan-happy { animation: okanHop 0.35s ease-out; }
        .okan-great { animation: okanHop 0.35s ease-out 2; }
        @keyframes okanShake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-6deg); }
          75% { transform: rotate(6deg); }
        }
        .okan-miss { animation: okanShake 0.3s ease-in-out; transform-origin: bottom center; }
      `}</style>
    </div>
  );
}
