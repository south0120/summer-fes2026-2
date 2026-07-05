"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Target, { type TargetHandles } from "./Target";
import { getAssets } from "./textures";
import { ensureAudio, playSound } from "./sound";
import {
  FES,
  KIND_CONF,
  KIND_POOL,
  LANE_Y,
  PALETTE,
  TARGET_Z,
  X_WRAP,
  pick,
  rand,
  type TargetKind,
  type TargetState,
  type World,
} from "./types";

/* ============================================================
 * 的マネージャ
 * - スロット固定（7 個）で的を管理。撃破 → リスポーンで使い回す
 * - 移動/ポップ/吹っ飛びは useFrame 内の ref 直接ミューテート
 * - world.shoot を登録し、raycast（球判定）→撃破→加点まで担当
 * ============================================================ */

const SLOT_LANES = [0, 0, 1, 1, 1, 2, 2]; // 2D 版 perLane = [2,3,2]
const GOLD_CHANCE = 0.08;
const PLATINUM_CHANCE = 0.05; // 大当たり「プラチナ星」の超レア出現率

function rollKind(): TargetKind {
  const r = Math.random();
  if (r < PLATINUM_CHANCE) return "platinum";
  if (r < PLATINUM_CHANCE + GOLD_CHANCE) return "gold";
  return pick(KIND_POOL);
}

function colliderRadius(kind: TargetKind, scale: number): number {
  const base =
    kind === "balloonBig" || kind === "balloonSmall"
      ? 0.32
      : kind === "platinum"
        ? 0.36 // 見た目は最小だが、当たり余白込みで「難しいが理不尽でない」水準に
        : kind === "gold"
          ? 0.3
          : 0.28;
  return base * scale + 0.06; // +0.06 はタップ用の当たり余白（2D 版 pad 相当）
}

function makeState(slot: number, atEdge: boolean): TargetState {
  const lane = SLOT_LANES[slot];
  const kind = atEdge ? rollKind() : pick(KIND_POOL);
  const conf = KIND_CONF[kind];
  const dir: 1 | -1 = lane % 2 === 0 ? 1 : -1;
  return {
    slot,
    kind,
    lane,
    x: atEdge
      ? dir === 1
        ? rand(-2.3, -2.05)
        : rand(2.05, 2.3)
      : rand(-1.4, 1.4),
    dir,
    speed: rand(conf.speed[0], conf.speed[1]),
    bobPhase: rand(0, Math.PI * 2),
    scale: conf.scale,
    points: conf.points,
    colorIdx: Math.floor(Math.random() * PALETTE.length),
    alive: true,
    colR: colliderRadius(kind, conf.scale),
    bornT: atEdge ? 0 : 1,
    dying: "none",
    dieT: 0,
    vel: null,
    spin: 0,
  };
}

/** 撃破後のリスポーンで state を作り直す（オブジェクトは使い回し） */
function respawnState(s: TargetState) {
  const kind = rollKind();
  const conf = KIND_CONF[kind];
  const dir: 1 | -1 = s.lane % 2 === 0 ? 1 : -1;
  s.kind = kind;
  s.x = dir === 1 ? rand(-2.3, -2.05) : rand(2.05, 2.3);
  s.dir = dir;
  s.speed = rand(conf.speed[0], conf.speed[1]);
  s.bobPhase = rand(0, Math.PI * 2);
  s.scale = conf.scale;
  s.points = conf.points;
  s.colorIdx = Math.floor(Math.random() * PALETTE.length);
  s.alive = true;
  s.colR = colliderRadius(kind, conf.scale);
  s.bornT = 0;
  s.dying = "none";
  s.dieT = 0;
  s.spin = 0;
}

type Props = { world: World; shadows: boolean };

export default function Targets({ world, shadows }: Props) {
  const camera = useThree((st) => st.camera);
  const assets = getAssets();

  const states = useMemo<TargetState[]>(
    () => SLOT_LANES.map((_, i) => makeState(i, false)),
    [],
  );
  const handlesRef = useRef<(TargetHandles | null)[]>(
    SLOT_LANES.map(() => null),
  );

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const tmpVec = useMemo(() => new THREE.Vector3(), []);

  /** kind / 色を handles に反映（マテリアルは共有資産の参照差し替えのみ） */
  const applyKind = useCallback(
    (s: TargetState) => {
      const h = handlesRef.current[s.slot];
      if (!h) return;
      const isBalloon = s.kind === "balloonBig" || s.kind === "balloonSmall";
      const isCan = s.kind === "canBig" || s.kind === "canSmall";
      const isStar = s.kind === "gold" || s.kind === "platinum";
      h.balloon.visible = isBalloon;
      h.can.visible = isCan;
      h.gold.visible = isStar;
      if (isBalloon) {
        h.balloonMesh.material = assets.balloonMats[s.colorIdx];
        h.knotMesh.material = assets.knotMats[s.colorIdx];
      } else if (isCan) {
        h.canMesh.material = [
          assets.canSideMats[s.colorIdx],
          assets.canMetalMat,
          assets.canMetalMat,
        ];
      } else if (isStar) {
        // 星メッシュを流用し、プラチナは専用マテリアルで別物に見せる
        h.goldMesh.material =
          s.kind === "platinum" ? assets.platinumMat : assets.goldMat;
      }
      h.group.visible = true;
      h.group.rotation.set(0, 0, 0);
      h.gold.rotation.set(0, 0, 0);
      h.group.scale.setScalar(s.bornT >= 0.15 ? s.scale : 0.001);
      h.group.position.set(s.x, LANE_Y[s.lane], TARGET_Z);
    },
    [assets],
  );

  const register = useCallback(
    (slot: number, h: TargetHandles) => {
      handlesRef.current[slot] = h;
      applyKind(states[slot]);
    },
    [applyKind, states],
  );

  /* ----- 射撃（DOM 側から world.shoot 経由で呼ばれる） ----- */
  useEffect(() => {
    world.shoot = (ndcX: number, ndcY: number) => {
      if (!world.playing || world.ended) return;
      // 弾切れ・リロード中は撃てない（リロードは DOM 側のタップで開始）
      if (world.reloading || world.ammo <= 0) return;
      world.ammo -= 1;
      const ac = ensureAudio();
      world.shots += 1;
      if (ac) playSound(ac, "shot");
      world.gunFire?.();

      // 照準ズレ（ゲーム開始時に決めたドリフト）を加算してから raycast
      const rx = ndcX + world.aimDrift.x;
      const ry = ndcY + world.aimDrift.y;
      ndc.set(rx, ry);
      raycaster.setFromCamera(ndc, camera);
      const ray = raycaster.ray;

      // 球コライダー判定。重なっていたら小さい的（高得点）を優先（2D 版と同じ）
      let hit: TargetState | null = null;
      for (const s of states) {
        if (!s.alive || s.dying !== "none") continue;
        const h = handlesRef.current[s.slot];
        if (!h) continue;
        if (ray.distanceSqToPoint(h.group.position) <= s.colR * s.colR) {
          if (!hit || s.colR < hit.colR) hit = s;
        }
      }

      if (hit) {
        const h = handlesRef.current[hit.slot]!;
        world.hits += 1;
        world.combo += 1;
        world.score += hit.points;
        world.cb.onScoreChange(world.score);
        world.respawns.push({
          slot: hit.slot,
          lane: hit.lane,
          at: performance.now() + rand(650, 1300),
        });

        const pos = h.group.position.clone();
        const pal = PALETTE[hit.colorIdx];
        const isGold = hit.kind === "gold";
        const isRare = hit.kind === "platinum";
        const isCan = hit.kind === "canBig" || hit.kind === "canSmall";

        hit.alive = false;
        hit.dieT = 0;
        if (isCan) {
          // 缶は後方へ吹っ飛ぶ
          hit.dying = "fly";
          hit.vel = (hit.vel ?? new THREE.Vector3()).set(
            hit.dir * rand(0.6, 1.4),
            rand(2.4, 3.4),
            rand(-1.6, -0.6),
          );
          hit.spin = hit.dir * rand(6, 12);
          world.effects?.stars(pos);
        } else if (isRare) {
          // 大当たり: 金の爆発 + 青系の紙吹雪を重ねて盛大に
          hit.dying = "pop";
          world.effects?.goldBurst(pos);
          world.effects?.confetti(pos, "#33C7FF", "#1E7FB8");
        } else if (isGold) {
          hit.dying = "pop";
          world.effects?.goldBurst(pos);
        } else {
          hit.dying = "pop";
          world.effects?.confetti(pos, pal.main, pal.deep);
        }

        world.shake = isRare ? 0.42 : isGold ? 0.2 : 0.1;

        // 撃破座標をスクリーン投影してフロートテキスト
        tmpVec.copy(pos).project(camera);
        world.fx?.spawnFloat(
          (tmpVec.x + 1) / 2,
          (1 - tmpVec.y) / 2 - 0.05,
          isRare ? `★+${hit.points}★` : `+${hit.points}`,
          isRare ? "#2FB6FF" : isGold ? FES.yellowDeep : pal.deep,
          hit.points >= 50,
        );

        const isGreat = hit.points >= 30 || world.combo >= 3;
        if (ac)
          playSound(
            ac,
            isRare ? "jackpot" : isGold ? "gold" : isGreat ? "great" : "hit",
          );
        world.fx?.okan(isRare || isGold || isGreat ? "great" : "happy");
        world.fx?.crosshairPulse(true);
      } else {
        world.combo = 0;
        world.shake = 0.04;
        // 的の面（z=0）との交点にミス煙リング
        const tPlane = (TARGET_Z - ray.origin.z) / ray.direction.z;
        ray.at(tPlane, tmpVec);
        tmpVec.x = THREE.MathUtils.clamp(tmpVec.x, -1.9, 1.9);
        tmpVec.y = THREE.MathUtils.clamp(tmpVec.y, 0.15, 2.95);
        world.effects?.missRing(tmpVec);
        world.fx?.spawnFloat(
          (rx + 1) / 2,
          (1 - ry) / 2 - 0.03,
          "ぽすっ",
          "rgba(58,46,42,0.6)",
          false,
        );
        if (ac) playSound(ac, "miss");
        world.fx?.okan("miss");
        world.fx?.crosshairPulse(false);
      }
    };
    return () => {
      world.shoot = null;
    };
  }, [world, camera, ndc, raycaster, states, tmpVec]);

  /* ----- 毎フレーム更新（ref 直接ミューテート・setState なし） ----- */
  useFrame((frameState, rawDt) => {
    if (world.ended) return; // 終了後は静止（2D 版と同じ）
    const dt = Math.min(0.05, rawDt);
    const t = frameState.clock.elapsedTime;
    const now = performance.now();

    for (const s of states) {
      const h = handlesRef.current[s.slot];
      if (!h) continue;

      if (s.dying === "pop") {
        s.dieT += dt;
        const k = 1 - s.dieT / 0.12;
        if (k <= 0) {
          s.dying = "none";
          h.group.visible = false;
        } else {
          h.group.scale.setScalar(s.scale * k);
        }
        continue;
      }
      if (s.dying === "fly" && s.vel) {
        s.dieT += dt;
        s.vel.y -= 7 * dt;
        h.group.position.addScaledVector(s.vel, dt);
        h.group.rotation.z += s.spin * dt;
        h.group.rotation.x += s.spin * 0.5 * dt;
        if (s.dieT > 0.9) {
          s.dying = "none";
          h.group.visible = false;
        }
        continue;
      }
      if (!s.alive) continue;

      // 移動 + 端でワープ（2D 版と同じループ）
      s.x += s.dir * s.speed * dt;
      if (s.dir === 1 && s.x > X_WRAP) s.x = -X_WRAP;
      if (s.dir === -1 && s.x < -X_WRAP) s.x = X_WRAP;

      const isBalloon = s.kind === "balloonBig" || s.kind === "balloonSmall";
      const isStar = s.kind === "gold" || s.kind === "platinum";
      const bobAmp = isBalloon ? 0.05 : isStar ? 0.035 : 0.012;
      const bob = Math.sin(t * 2 + s.bobPhase) * bobAmp;
      h.group.position.set(s.x, LANE_Y[s.lane] + bob, TARGET_Z);

      if (isBalloon) {
        h.group.rotation.z = Math.sin(t * 1.5 + s.bobPhase) * 0.07;
      } else if (isStar) {
        // プラチナはより速く回して「特別感」を出す
        h.gold.rotation.y += (s.kind === "platinum" ? 5.5 : 2.5) * dt;
      }

      // ポップイン
      if (s.bornT < 0.15) {
        s.bornT += dt;
        h.group.scale.setScalar(s.scale * Math.min(1, s.bornT / 0.15));
      } else {
        h.group.scale.setScalar(s.scale);
      }
    }

    // リスポーン
    for (let i = world.respawns.length - 1; i >= 0; i--) {
      const r = world.respawns[i];
      if (now >= r.at) {
        respawnState(states[r.slot]);
        applyKind(states[r.slot]);
        // 大当たり「プラチナ星」が出たら予告演出（バナー＋アラート音）
        if (states[r.slot].kind === "platinum") {
          world.fx?.rare();
          const ac = ensureAudio();
          if (ac) playSound(ac, "rare");
        }
        world.respawns.splice(i, 1);
      }
    }
  });

  return (
    <group>
      {SLOT_LANES.map((_, i) => (
        <Target key={i} slot={i} shadows={shadows} register={register} />
      ))}
    </group>
  );
}
