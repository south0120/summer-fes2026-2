"use client";

import { useEffect, useRef } from "react";
import type * as THREE from "three";
import { getAssets } from "./textures";

/* ============================================================
 * 的 1 スロット分のメッシュ群
 * - balloon / can / gold の 3 形態を持ち、Targets が可視切替する
 * - ジオメトリ/マテリアルは共有資産（getAssets）を使い回す
 * - 毎フレームの位置・スケールは Targets の useFrame が
 *   ref 直接ミューテートで更新する（setState しない）
 * ============================================================ */

export type TargetHandles = {
  group: THREE.Group;
  balloon: THREE.Group;
  balloonMesh: THREE.Mesh;
  knotMesh: THREE.Mesh;
  can: THREE.Group;
  canMesh: THREE.Mesh;
  gold: THREE.Group;
  goldMesh: THREE.Mesh;
};

type Props = {
  slot: number;
  shadows: boolean;
  register: (slot: number, handles: TargetHandles) => void;
};

export default function Target({ slot, shadows, register }: Props) {
  const assets = getAssets();
  const groupRef = useRef<THREE.Group>(null);
  const balloonRef = useRef<THREE.Group>(null);
  const balloonMeshRef = useRef<THREE.Mesh>(null);
  const knotMeshRef = useRef<THREE.Mesh>(null);
  const canRef = useRef<THREE.Group>(null);
  const canMeshRef = useRef<THREE.Mesh>(null);
  const goldRef = useRef<THREE.Group>(null);
  const goldMeshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (
      groupRef.current &&
      balloonRef.current &&
      balloonMeshRef.current &&
      knotMeshRef.current &&
      canRef.current &&
      canMeshRef.current &&
      goldRef.current &&
      goldMeshRef.current
    ) {
      register(slot, {
        group: groupRef.current,
        balloon: balloonRef.current,
        balloonMesh: balloonMeshRef.current,
        knotMesh: knotMeshRef.current,
        can: canRef.current,
        canMesh: canMeshRef.current,
        gold: goldRef.current,
        goldMesh: goldMeshRef.current,
      });
    }
  }, [slot, register]);

  return (
    <group ref={groupRef}>
      {/* 風船（本体 + 結び目） */}
      <group ref={balloonRef} visible={false}>
        <mesh
          ref={balloonMeshRef}
          geometry={assets.balloonGeo}
          material={assets.balloonMats[0]}
          castShadow={shadows}
        />
        <mesh
          ref={knotMeshRef}
          geometry={assets.knotGeo}
          material={assets.knotMats[0]}
          position={[0, -0.27, 0]}
          rotation={[Math.PI, 0, 0]}
        />
      </group>

      {/* 缶（側面ラベル + 金属フタ） */}
      <group ref={canRef} visible={false}>
        <mesh
          ref={canMeshRef}
          geometry={assets.canGeo}
          material={[
            assets.canSideMats[0],
            assets.canMetalMat,
            assets.canMetalMat,
          ]}
          castShadow={shadows}
        />
      </group>

      {/* 金の的（星型・レア） */}
      <group ref={goldRef} visible={false}>
        <mesh
          ref={goldMeshRef}
          geometry={assets.goldStarGeo}
          material={assets.goldMat}
          position={[0, 0, -0.035]}
          castShadow={shadows}
        />
      </group>
    </group>
  );
}
