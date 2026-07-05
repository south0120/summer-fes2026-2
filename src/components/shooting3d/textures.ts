import * as THREE from "three";
import { FES, PALETTE } from "./types";

/* ============================================================
 * プロシージャル資産（テクスチャ / ジオメトリ / マテリアル）
 * - 外部ファイルは読み込まない。すべて Canvas 生成 or コード生成
 * - モジュールスコープの遅延シングルトン。種類ごとに 1 つだけ生成し
 *   全メッシュで共有する（的ごとに new しない）
 * - disposeAssets() で全破棄（ShootingGame3D のアンマウント時に呼ぶ）
 * ============================================================ */

/* ---------- Canvas 描画ヘルパー（2D 版から移植） ---------- */

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** 缶ラベル（円柱側面に巻く）。2D 版 drawCanShape のラベル帯+星を流用 */
function makeCanLabelTexture(main: string, deep: string): THREE.CanvasTexture {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d")!;
  // 地色
  ctx.fillStyle = main;
  ctx.fillRect(0, 0, 256, 256);
  // 上下の金属リム
  ctx.fillStyle = "#cfcfcf";
  ctx.fillRect(0, 0, 256, 18);
  ctx.fillRect(0, 238, 256, 18);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, 18, 256, 5);
  ctx.fillRect(0, 233, 256, 5);
  // 紙ラベル帯 + 星（横に 2 つ＝円柱の表裏）
  ctx.fillStyle = FES.paper;
  ctx.fillRect(0, 96, 256, 72);
  ctx.strokeStyle = deep;
  ctx.lineWidth = 4;
  ctx.strokeRect(-4, 96, 264, 72);
  drawStar(ctx, 64, 132, 26, deep);
  drawStar(ctx, 192, 132, 26, deep);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

/** 簡易木目 */
function makeWoodTexture(base: string, grain: string): THREE.CanvasTexture {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = grain;
  ctx.lineWidth = 2;
  for (let i = 0; i < 22; i++) {
    const y = (i / 22) * 256 + Math.random() * 8;
    ctx.globalAlpha = 0.12 + Math.random() * 0.18;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) {
      ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 4 + Math.random() * 3);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** テント帯（黄×白の縞 = accent yellow） */
function makeAwningTexture(): THREE.CanvasTexture {
  const c = makeCanvas(256, 64);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = FES.paper;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = FES.yellow;
  for (let i = 0; i < 4; i++) ctx.fillRect(i * 64, 0, 32, 64);
  // 下端のスカラップ影
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0, 58, 256, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

/** マズルフラッシュ（放射グラデーション） */
function makeFlashTexture(): THREE.CanvasTexture {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(255,245,200,1)");
  g.addColorStop(0.35, "rgba(242,183,5,0.9)");
  g.addColorStop(1, "rgba(242,183,5,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  // 放射スパイク
  ctx.strokeStyle = "rgba(255,240,180,0.8)";
  ctx.lineWidth = 5;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(a) * 10, 64 + Math.sin(a) * 10);
    ctx.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

/* ---------- 星形ジオメトリ ---------- */

function makeStarShape(r: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(ang) * rad;
    const py = -Math.sin(ang) * rad;
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  }
  shape.closePath();
  return shape;
}

/* ---------- 資産バンドル ---------- */

export type Assets = {
  // geometry
  balloonGeo: THREE.SphereGeometry;
  knotGeo: THREE.ConeGeometry;
  canGeo: THREE.CylinderGeometry;
  goldStarGeo: THREE.ExtrudeGeometry;
  colliderGeo: THREE.SphereGeometry;
  confettiGeo: THREE.PlaneGeometry;
  starFxGeo: THREE.ShapeGeometry;
  ringGeo: THREE.RingGeometry;
  flashGeo: THREE.PlaneGeometry;
  // materials
  balloonMats: THREE.MeshStandardMaterial[];
  knotMats: THREE.MeshStandardMaterial[];
  canSideMats: THREE.MeshStandardMaterial[];
  canMetalMat: THREE.MeshStandardMaterial;
  goldMat: THREE.MeshStandardMaterial;
  platinumMat: THREE.MeshStandardMaterial;
  colliderMat: THREE.MeshBasicMaterial;
  woodMat: THREE.MeshStandardMaterial;
  woodDarkMat: THREE.MeshStandardMaterial;
  wallMat: THREE.MeshStandardMaterial;
  awningMat: THREE.MeshStandardMaterial;
  lanternMats: THREE.MeshStandardMaterial[];
  confettiMat: THREE.MeshBasicMaterial;
  starFxMat: THREE.MeshBasicMaterial;
  ringMat: THREE.MeshBasicMaterial;
  flashMat: THREE.MeshBasicMaterial;
  gunWoodMat: THREE.MeshStandardMaterial;
  gunDarkMat: THREE.MeshStandardMaterial;
  corkMat: THREE.MeshStandardMaterial;
  prizeMats: THREE.MeshStandardMaterial[];
  prizeGeo: THREE.BoxGeometry;
  // textures（dispose 用に保持）
  textures: THREE.Texture[];
};

let assets: Assets | null = null;

export function getAssets(): Assets {
  if (assets) return assets;

  const canLabelTextures = PALETTE.map((p) =>
    makeCanLabelTexture(p.main, p.deep),
  );
  const woodTex = makeWoodTexture("#C9A96A", "#8a6b3a");
  const awningTex = makeAwningTexture();
  const flashTex = makeFlashTexture();

  const balloonGeo = new THREE.SphereGeometry(0.22, 20, 16);
  balloonGeo.scale(1, 1.12, 1);

  assets = {
    balloonGeo,
    knotGeo: new THREE.ConeGeometry(0.055, 0.09, 8),
    canGeo: new THREE.CylinderGeometry(0.125, 0.125, 0.36, 20),
    goldStarGeo: new THREE.ExtrudeGeometry(makeStarShape(0.2), {
      depth: 0.07,
      bevelEnabled: true,
      bevelSize: 0.015,
      bevelThickness: 0.015,
      bevelSegments: 1,
    }),
    colliderGeo: new THREE.SphereGeometry(1, 8, 8),
    confettiGeo: new THREE.PlaneGeometry(0.055, 0.038),
    starFxGeo: new THREE.ShapeGeometry(makeStarShape(0.05)),
    ringGeo: new THREE.RingGeometry(0.75, 1, 24),
    flashGeo: new THREE.PlaneGeometry(0.34, 0.34),

    balloonMats: PALETTE.map(
      (p) =>
        new THREE.MeshStandardMaterial({
          color: p.main,
          roughness: 0.25,
          metalness: 0,
        }),
    ),
    knotMats: PALETTE.map(
      (p) =>
        new THREE.MeshStandardMaterial({ color: p.deep, roughness: 0.5 }),
    ),
    canSideMats: canLabelTextures.map(
      (tex) =>
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.45,
          metalness: 0.35,
        }),
    ),
    canMetalMat: new THREE.MeshStandardMaterial({
      color: "#d8d8d8",
      roughness: 0.35,
      metalness: 0.85,
    }),
    goldMat: new THREE.MeshStandardMaterial({
      color: FES.yellow,
      roughness: 0.2,
      metalness: 0.9,
      emissive: FES.yellowDeep,
      emissiveIntensity: 0.35,
    }),
    // 大当たり「プラチナ星」: 白く輝く氷色（金より明らかに特別に見える）
    platinumMat: new THREE.MeshStandardMaterial({
      color: "#EAF6FF",
      roughness: 0.12,
      metalness: 0.95,
      emissive: "#7FD4FF",
      emissiveIntensity: 0.75,
    }),
    colliderMat: new THREE.MeshBasicMaterial({ visible: false }),
    woodMat: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 }),
    woodDarkMat: new THREE.MeshStandardMaterial({
      color: "#8a6b3a",
      roughness: 0.85,
    }),
    wallMat: new THREE.MeshStandardMaterial({
      color: "#6d5138",
      roughness: 0.95,
    }),
    awningMat: new THREE.MeshStandardMaterial({
      map: awningTex,
      roughness: 0.8,
    }),
    lanternMats: PALETTE.map(
      (p) =>
        new THREE.MeshStandardMaterial({
          color: p.main,
          roughness: 0.6,
          emissive: p.main,
          emissiveIntensity: 0.85,
        }),
    ),
    confettiMat: new THREE.MeshBasicMaterial({
      color: "#ffffff",
      side: THREE.DoubleSide,
    }),
    starFxMat: new THREE.MeshBasicMaterial({
      color: FES.yellow,
      side: THREE.DoubleSide,
      transparent: true,
    }),
    ringMat: new THREE.MeshBasicMaterial({
      color: FES.ink,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    }),
    flashMat: new THREE.MeshBasicMaterial({
      map: flashTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    gunWoodMat: new THREE.MeshStandardMaterial({
      color: "#a9743c",
      roughness: 0.7,
    }),
    gunDarkMat: new THREE.MeshStandardMaterial({
      color: FES.ink,
      roughness: 0.5,
      metalness: 0.3,
    }),
    corkMat: new THREE.MeshStandardMaterial({
      color: "#c9a96a",
      roughness: 0.95,
    }),
    prizeMats: PALETTE.map(
      (p) =>
        new THREE.MeshStandardMaterial({ color: p.main, roughness: 0.7 }),
    ),
    prizeGeo: new THREE.BoxGeometry(0.22, 0.28, 0.16),

    textures: [...canLabelTextures, woodTex, awningTex, flashTex],
  };
  return assets;
}

export function disposeAssets() {
  if (!assets) return;
  const a = assets;
  const geos: THREE.BufferGeometry[] = [
    a.balloonGeo,
    a.knotGeo,
    a.canGeo,
    a.goldStarGeo,
    a.colliderGeo,
    a.confettiGeo,
    a.starFxGeo,
    a.ringGeo,
    a.flashGeo,
    a.prizeGeo,
  ];
  const mats: THREE.Material[] = [
    ...a.balloonMats,
    ...a.knotMats,
    ...a.canSideMats,
    a.canMetalMat,
    a.goldMat,
    a.colliderMat,
    a.woodMat,
    a.woodDarkMat,
    a.wallMat,
    a.awningMat,
    ...a.lanternMats,
    a.confettiMat,
    a.starFxMat,
    a.ringMat,
    a.flashMat,
    a.gunWoodMat,
    a.gunDarkMat,
    a.corkMat,
    ...a.prizeMats,
  ];
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
  a.textures.forEach((t) => t.dispose());
  assets = null;
}
