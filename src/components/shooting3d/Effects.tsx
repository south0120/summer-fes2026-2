"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getAssets } from "./textures";
import { TARGET_Z, rand, type World } from "./types";

/* ============================================================
 * ヒット/ミスのパーティクル演出
 * - confetti / star は InstancedMesh（1 draw call）
 * - ミス煙リングは 4 枚をプール（material はクローンして個別 opacity）
 * - 更新はすべて useFrame 内の ref 直接ミューテート
 * ============================================================ */

const CONFETTI_N = 96;
const STAR_N = 30;
const RING_N = 4;
const G = 3.2; // 重力 (world unit / s^2)

type Piece = {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: number;
  vrot: number;
  life: number;
  maxLife: number;
  scale: number;
};

function makePool(n: number): Piece[] {
  return Array.from({ length: n }, () => ({
    alive: false,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    rot: 0,
    vrot: 0,
    life: 0,
    maxLife: 1,
    scale: 1,
  }));
}

const GOLD_COLORS = ["#F2B705", "#C79403", "#FFF0C0"];

type Props = { world: World };

export default function Effects({ world }: Props) {
  const assets = getAssets();
  const confettiRef = useRef<THREE.InstancedMesh>(null);
  const starRef = useRef<THREE.InstancedMesh>(null);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);

  const confetti = useMemo(() => makePool(CONFETTI_N), []);
  const stars = useMemo(() => makePool(STAR_N), []);
  const rings = useMemo(
    () =>
      Array.from({ length: RING_N }, () => ({
        alive: false,
        life: 0,
        maxLife: 0.35,
        pos: new THREE.Vector3(),
      })),
    [],
  );
  const ringMats = useMemo(
    () => Array.from({ length: RING_N }, () => assets.ringMat.clone()),
    [assets],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  /* ----- スポーン関数を world に登録 ----- */
  useEffect(() => {
    const spawnConfetti = (
      pos: THREE.Vector3,
      colors: string[],
      count: number,
      speed: [number, number],
    ) => {
      const mesh = confettiRef.current;
      if (!mesh) return;
      let spawned = 0;
      for (let i = 0; i < CONFETTI_N && spawned < count; i++) {
        const p = confetti[i];
        if (p.alive) continue;
        const ang = rand(0, Math.PI * 2);
        const up = rand(-0.4, 1);
        const sp = rand(speed[0], speed[1]);
        p.alive = true;
        p.pos.copy(pos);
        p.vel.set(Math.cos(ang) * sp, up * sp + 0.9, rand(-0.3, 0.8));
        p.rot = rand(0, Math.PI * 2);
        p.vrot = rand(-9, 9);
        p.life = rand(0.5, 0.9);
        p.maxLife = p.life;
        p.scale = rand(0.7, 1.4);
        tmpColor.set(colors[spawned % colors.length]);
        mesh.setColorAt(i, tmpColor);
        spawned++;
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    const spawnStars = (pos: THREE.Vector3, count: number) => {
      let spawned = 0;
      for (let i = 0; i < STAR_N && spawned < count; i++) {
        const p = stars[i];
        if (p.alive) continue;
        const ang = rand(Math.PI * 0.15, Math.PI * 0.85); // 上方向
        const sp = rand(1, 2.2);
        p.alive = true;
        p.pos.copy(pos);
        p.vel.set(Math.cos(ang) * sp * (Math.random() < 0.5 ? 1 : -1), Math.sin(ang) * sp, rand(0, 0.6));
        p.rot = rand(0, Math.PI * 2);
        p.vrot = rand(-7, 7);
        p.life = rand(0.4, 0.7);
        p.maxLife = p.life;
        p.scale = rand(0.8, 1.6);
        spawned++;
      }
    };

    world.effects = {
      confetti: (pos, main, deep) =>
        spawnConfetti(pos, [main, main, deep], 14, [1.2, 2.6]),
      stars: (pos) => spawnStars(pos, 6),
      goldBurst: (pos) => {
        spawnConfetti(pos, GOLD_COLORS, 24, [1.6, 3.4]);
        spawnStars(pos, 10);
      },
      missRing: (pos) => {
        const r = rings.find((x) => !x.alive) ?? rings[0];
        r.alive = true;
        r.life = r.maxLife;
        r.pos.copy(pos);
      },
    };
    return () => {
      world.effects = null;
    };
  }, [world, confetti, stars, rings, tmpColor]);

  /* ----- ring material のクローンは自前で破棄 ----- */
  useEffect(() => {
    return () => {
      ringMats.forEach((m) => m.dispose());
    };
  }, [ringMats]);

  /* ----- 毎フレーム更新 ----- */
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);

    const updatePool = (
      pool: Piece[],
      mesh: THREE.InstancedMesh | null,
      grav: number,
    ) => {
      if (!mesh) return;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.alive) {
          dummy.position.set(0, -100, 0);
          dummy.scale.setScalar(0.0001);
          dummy.rotation.set(0, 0, 0);
        } else {
          p.life -= dt;
          if (p.life <= 0) {
            p.alive = false;
            dummy.position.set(0, -100, 0);
            dummy.scale.setScalar(0.0001);
          } else {
            p.vel.y -= grav * dt;
            p.pos.addScaledVector(p.vel, dt);
            p.rot += p.vrot * dt;
            dummy.position.copy(p.pos);
            dummy.rotation.set(p.rot * 0.6, p.rot, p.rot);
            dummy.scale.setScalar(p.scale * Math.min(1, p.life / 0.2));
          }
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };

    updatePool(confetti, confettiRef.current, G);
    updatePool(stars, starRef.current, G * 0.8);

    for (let i = 0; i < RING_N; i++) {
      const r = rings[i];
      const mesh = ringRefs.current[i];
      if (!mesh) continue;
      if (!r.alive) {
        mesh.visible = false;
        continue;
      }
      r.life -= dt;
      if (r.life <= 0) {
        r.alive = false;
        mesh.visible = false;
        continue;
      }
      const k = 1 - r.life / r.maxLife; // 0→1
      mesh.visible = true;
      mesh.position.copy(r.pos);
      mesh.position.z = TARGET_Z + 0.06;
      mesh.scale.setScalar(0.08 + k * 0.42);
      ringMats[i].opacity = 0.45 * (1 - k);
    }
  });

  return (
    <group>
      <instancedMesh
        ref={confettiRef}
        args={[assets.confettiGeo, assets.confettiMat, CONFETTI_N]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={starRef}
        args={[assets.starFxGeo, assets.starFxMat, STAR_N]}
        frustumCulled={false}
      />
      {Array.from({ length: RING_N }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            ringRefs.current[i] = el;
          }}
          geometry={assets.ringGeo}
          material={ringMats[i]}
          visible={false}
        />
      ))}
    </group>
  );
}
