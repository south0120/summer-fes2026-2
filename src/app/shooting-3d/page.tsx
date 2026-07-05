"use client";

import dynamic from "next/dynamic";
import RankingPanel from "@/components/game/RankingPanel";

// R3F Canvas はクライアント専用。SSR させると window 参照でクラッシュするため
// dynamic(ssr: false) で読み込み、three をこのルート到達時のみバンドルする
const ShootingGame3D = dynamic(
  () => import("@/components/shooting3d/ShootingGame3D"),
  {
    ssr: false,
    loading: () => (
      <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-4">
        <p className="animate-pulse font-maru text-lg font-bold text-fes-ink/70">
          🎯 屋台を組み立て中…
        </p>
      </main>
    ),
  },
);

export default function Shooting3DPage() {
  return (
    <>
      <ShootingGame3D />
      <RankingPanel game="shooting-3d" />
    </>
  );
}
