"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getAssets } from "./textures";
import { LANE_Y, rand } from "./types";

/* ============================================================
 * 屋台の背景（静的シーン）
 * - 木製カウンター / 的棚 3 段 / 背板 / テント帯 / 提灯 / 景品
 * - すべてプロシージャル（外部モデル・画像なし）
 * ============================================================ */

const LANTERN_X = [-1.35, -0.45, 0.45, 1.35];

type Props = { shadows: boolean };

export default function Stall({ shadows }: Props) {
  const assets = getAssets();
  const lanternRefs = useRef<(THREE.Group | null)[]>([]);
  const lanternPhases = useMemo(
    () => LANTERN_X.map(() => rand(0, Math.PI * 2)),
    [],
  );

  // 提灯をゆらゆら揺らす（ref 直接ミューテート）
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    lanternRefs.current.forEach((g, i) => {
      if (g) g.rotation.z = Math.sin(t * 1.2 + lanternPhases[i]) * 0.08;
    });
  });

  return (
    <group>
      {/* 背板 */}
      <mesh position={[0, 1.6, -0.55]} material={assets.wallMat} receiveShadow={shadows}>
        <boxGeometry args={[5, 4.6, 0.1]} />
      </mesh>

      {/* 側板 */}
      <mesh position={[-2.35, 1.6, 0.4]} material={assets.woodDarkMat}>
        <boxGeometry args={[0.12, 4.6, 2]} />
      </mesh>
      <mesh position={[2.35, 1.6, 0.4]} material={assets.woodDarkMat}>
        <boxGeometry args={[0.12, 4.6, 2]} />
      </mesh>

      {/* 的棚 3 段（板 + 前縁リム） */}
      {LANE_Y.map((y) => (
        <group key={y} position={[0, y - 0.24, 0]}>
          <mesh material={assets.woodMat} receiveShadow={shadows}>
            <boxGeometry args={[4.6, 0.07, 0.55]} />
          </mesh>
          <mesh position={[0, -0.045, 0.27]} material={assets.woodDarkMat}>
            <boxGeometry args={[4.6, 0.09, 0.04]} />
          </mesh>
        </group>
      ))}

      {/* 手前の木製カウンター */}
      <mesh position={[0, 0.12, 2.3]} material={assets.woodMat} receiveShadow={shadows}>
        <boxGeometry args={[5, 0.6, 1.5]} />
      </mesh>
      <mesh position={[0, 0.44, 2.3]} material={assets.woodDarkMat}>
        <boxGeometry args={[5, 0.05, 1.56]} />
      </mesh>

      {/* テント帯（黄×白 = accent yellow） */}
      <mesh position={[0, 3.3, 0.85]} rotation={[0.25, 0, 0]} material={assets.awningMat}>
        <planeGeometry args={[5, 0.75]} />
      </mesh>

      {/* 提灯（emissive で光る玉） */}
      {LANTERN_X.map((x, i) => (
        <group
          key={x}
          position={[x, 2.98, 0.55]}
          ref={(el) => {
            lanternRefs.current[i] = el;
          }}
        >
          {/* 吊り紐 */}
          <mesh position={[0, 0.16, 0]} material={assets.gunDarkMat}>
            <cylinderGeometry args={[0.008, 0.008, 0.22, 4]} />
          </mesh>
          {/* 本体 */}
          <mesh
            position={[0, -0.06, 0]}
            scale={[1, 1.15, 1]}
            material={assets.lanternMats[i % assets.lanternMats.length]}
          >
            <sphereGeometry args={[0.13, 14, 10]} />
          </mesh>
          {/* 上下のフチ */}
          <mesh position={[0, 0.09, 0]} material={assets.gunDarkMat}>
            <cylinderGeometry args={[0.05, 0.05, 0.03, 10]} />
          </mesh>
          <mesh position={[0, -0.21, 0]} material={assets.gunDarkMat}>
            <cylinderGeometry args={[0.045, 0.045, 0.03, 10]} />
          </mesh>
        </group>
      ))}

      {/* 棚の隅の景品（撃てない飾り） */}
      <mesh position={[-1.95, LANE_Y[0] - 0.055, 0]} rotation={[0, 0.3, 0]} geometry={assets.prizeGeo} material={assets.prizeMats[1]} />
      <mesh position={[1.95, LANE_Y[1] - 0.055, 0]} rotation={[0, -0.25, 0]} geometry={assets.prizeGeo} material={assets.prizeMats[3]} />
      <mesh position={[-1.9, LANE_Y[2] - 0.055, 0]} rotation={[0, 0.15, 0]} geometry={assets.prizeGeo} material={assets.prizeMats[0]} />
      <mesh position={[2.0, LANE_Y[0] - 0.055, 0]} rotation={[0, -0.4, 0]} geometry={assets.prizeGeo} material={assets.prizeMats[2]} />
    </group>
  );
}
