"use client";

import { useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import Stall from "./Stall";
import Targets from "./Targets";
import Effects from "./Effects";
import GunViewmodel from "./GunViewmodel";
import type { World } from "./types";

/* ============================================================
 * R3F シーン
 * - 固定カメラ（屋台のカウンター越し・縦持ち 3:4 で棚 3 段が収まる）
 * - 夜祭りライティング（ambient + 暖色 point×2 + key directional）
 * - PerformanceMonitor でフレーム落ち時に DPR を自動で下げる
 * - result 中は frameloop="demand" で GPU を止める
 * ============================================================ */

/** タイマー進行とカメラシェイク（毎フレーム・ref 直接ミューテート） */
function Director({ world }: { world: World }) {
  const camera = useThree((st) => st.camera);

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);

    // タイマー（2D 版と同じ「秒が変わった時だけ」通知）
    if (world.started && !world.ended) {
      const now = performance.now();
      const remain = world.duration - (now - world.startAt) / 1000;
      const sec = Math.max(0, Math.ceil(remain));
      if (sec !== world.lastSec) {
        world.lastSec = sec;
        world.cb.onTimeChange(sec);
      }
      if (remain <= 0) {
        world.ended = true;
        world.cb.onEnd(world.score, { hits: world.hits, shots: world.shots });
      }
    }

    // 射撃の手応え（ごく軽いカメラシェイク）
    if (world.shake > 0) {
      world.shake = Math.max(0, world.shake - dt);
      const amp = world.shake * 0.055;
      camera.rotation.x = (Math.random() - 0.5) * amp;
      camera.rotation.y = (Math.random() - 0.5) * amp;
    } else if (camera.rotation.x !== 0 || camera.rotation.y !== 0) {
      camera.rotation.set(0, 0, 0);
    }
  });

  return null;
}

type Props = {
  world: World;
  /** false（result 画面など）の間は frameloop を止める */
  active: boolean;
};

export default function Scene({ world, active }: Props) {
  const [dpr, setDpr] = useState<number | [number, number]>([1, 2]);
  // モバイル（タッチ主体）はリアルタイム影をオフにして GPU を守る
  const shadows = useMemo(
    () =>
      typeof window !== "undefined" &&
      !window.matchMedia("(pointer: coarse)").matches,
    [],
  );

  return (
    <Canvas
      className="absolute inset-0"
      dpr={dpr}
      shadows={shadows}
      frameloop={active ? "always" : "demand"}
      camera={{ fov: 46, position: [0, 1.35, 4.6], near: 0.1, far: 30 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr([1, 2])}
      />

      <color attach="background" args={["#241d33"]} />

      {/* 夜祭りライティング（合計 4 灯まで） */}
      <ambientLight intensity={0.55} color="#9c8fb8" />
      <directionalLight
        position={[1.6, 4.2, 5]}
        intensity={1.2}
        color="#ffe8c4"
        castShadow={shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={4}
        shadow-camera-bottom={-1}
      />
      <pointLight
        position={[-0.9, 2.7, 0.8]}
        intensity={6}
        distance={5.5}
        decay={1.8}
        color="#ffb054"
      />
      <pointLight
        position={[0.9, 2.7, 0.8]}
        intensity={6}
        distance={5.5}
        decay={1.8}
        color="#ffb054"
      />

      <Stall shadows={shadows} />
      <Targets world={world} shadows={shadows} />
      <Effects world={world} />
      <GunViewmodel world={world} />
      <Director world={world} />
    </Canvas>
  );
}
