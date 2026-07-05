"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getAssets } from "./textures";
import type { World } from "./types";

/* ============================================================
 * コルク銃ビューモデル（画面下部固定）
 * - 外部モデルなし。ジオメトリをその場で組む
 * - カメラの子として追従。射撃でリコイル + マズルフラッシュ
 * ============================================================ */

type Props = { world: World };

export default function GunViewmodel({ world }: Props) {
  const assets = getAssets();
  const camera = useThree((st) => st.camera);
  const scene = useThree((st) => st.scene);
  const holder = useMemo(() => new THREE.Group(), []);
  const gunRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const recoil = useRef(0);
  const flashT = useRef(0);

  // デフォルトカメラは scene 外にいるため、子を描画するには scene に追加が必要
  useEffect(() => {
    camera.add(holder);
    scene.add(camera);
    return () => {
      camera.remove(holder);
      scene.remove(camera);
    };
  }, [camera, scene, holder]);

  useEffect(() => {
    world.gunFire = () => {
      recoil.current = 1;
      flashT.current = 0.06;
    };
    return () => {
      world.gunFire = null;
    };
  }, [world]);

  useFrame((st, dt) => {
    const g = gunRef.current;
    if (!g) return;
    recoil.current = Math.max(0, recoil.current - dt * 9);
    const r = recoil.current;
    const t = st.clock.elapsedTime;
    // アイドルの微妙な呼吸 + リコイル（後方 + 上向き）
    g.position.set(
      0.34 + Math.sin(t * 1.4) * 0.004,
      -0.46 + Math.sin(t * 1.9) * 0.005,
      -1.05 + r * 0.11,
    );
    g.rotation.x = -0.05 + r * 0.22;
    g.rotation.y = -0.13;

    const f = flashRef.current;
    if (f) {
      if (flashT.current > 0) {
        flashT.current -= dt;
        f.visible = true;
        f.rotation.z = Math.random() * Math.PI * 2;
      } else {
        f.visible = false;
      }
    }
  });

  return createPortal(
    <group ref={gunRef}>
      {/* 銃身 */}
      <mesh
        position={[0, 0.02, -0.3]}
        rotation={[Math.PI / 2, 0, 0]}
        material={assets.gunDarkMat}
      >
        <cylinderGeometry args={[0.034, 0.038, 0.5, 12]} />
      </mesh>
      {/* 銃口の赤い飾りリング（fes-red） */}
      <mesh
        position={[0, 0.02, -0.52]}
        rotation={[Math.PI / 2, 0, 0]}
        material={assets.prizeMats[0]}
      >
        <cylinderGeometry args={[0.042, 0.042, 0.05, 12]} />
      </mesh>
      {/* コルク弾 */}
      <mesh position={[0, 0.02, -0.575]} material={assets.corkMat}>
        <sphereGeometry args={[0.034, 10, 8]} />
      </mesh>
      {/* 木製ボディ */}
      <mesh position={[0, -0.015, -0.05]} material={assets.gunWoodMat}>
        <boxGeometry args={[0.05, 0.075, 0.4]} />
      </mesh>
      {/* ストック（後方の持ち手） */}
      <mesh
        position={[0, -0.08, 0.17]}
        rotation={[0.45, 0, 0]}
        material={assets.gunWoodMat}
      >
        <boxGeometry args={[0.046, 0.1, 0.24]} />
      </mesh>
      {/* トリガー */}
      <mesh position={[0, -0.075, -0.02]} material={assets.gunDarkMat}>
        <boxGeometry args={[0.016, 0.05, 0.02]} />
      </mesh>
      {/* マズルフラッシュ（加算合成 sprite 面） */}
      <mesh
        ref={flashRef}
        position={[0, 0.02, -0.62]}
        geometry={assets.flashGeo}
        material={assets.flashMat}
        visible={false}
      />
    </group>,
    holder,
  );
}
