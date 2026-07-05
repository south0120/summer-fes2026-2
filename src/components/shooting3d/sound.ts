/* ============================================================
 * 効果音（WebAudio 合成・外部ファイルなし）
 * - 2D 版 ShootingGameCanvas の playSound を切り出して拡張
 * - AudioContext はユーザー操作起点で生成（モバイル自動再生制約対策）
 * ============================================================ */

export type SoundKind =
  | "hit"
  | "great"
  | "miss"
  | "shot"
  | "gold"
  | "rare"
  | "jackpot";

let audio: AudioContext | null = null;

export function ensureAudio(): AudioContext | null {
  if (audio && audio.state !== "closed") return audio;
  try {
    const w = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    audio = new Ctor();
  } catch {
    return null;
  }
  return audio;
}

export function resumeAudio(): AudioContext | null {
  const ac = ensureAudio();
  if (ac && ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}

export function closeAudio() {
  if (audio && audio.state !== "closed") {
    audio.close().catch(() => {});
  }
  audio = null;
}

export function playSound(ac: AudioContext, kind: SoundKind) {
  const t0 = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0.14;
  master.connect(ac.destination);

  const blip = (
    at: number,
    from: number,
    to: number,
    dur: number,
    type: OscillatorType,
    vol: number,
  ) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0 + at);
    osc.frequency.exponentialRampToValueAtTime(to, t0 + at + dur);
    g.gain.setValueAtTime(vol, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + at + dur);
    osc.connect(g).connect(master);
    osc.start(t0 + at);
    osc.stop(t0 + at + dur + 0.02);
  };

  if (kind === "hit") {
    blip(0, 660, 1320, 0.09, "triangle", 1);
  } else if (kind === "great") {
    blip(0, 660, 1320, 0.08, "triangle", 1);
    blip(0.07, 880, 1760, 0.1, "triangle", 0.9);
  } else if (kind === "gold") {
    // 金の的: きらきらアルペジオ
    blip(0, 880, 1760, 0.09, "triangle", 1);
    blip(0.08, 1174, 2349, 0.09, "triangle", 0.9);
    blip(0.16, 1568, 3136, 0.12, "triangle", 0.8);
  } else if (kind === "rare") {
    // 大当たり出現の予告アラート（キラリ↑と鳴らして注意を引く）
    blip(0, 1046, 1568, 0.1, "triangle", 0.9);
    blip(0.1, 1568, 2093, 0.14, "triangle", 0.85);
  } else if (kind === "jackpot") {
    // 大当たり命中: 金より派手で長いファンファーレ
    blip(0, 880, 1760, 0.09, "triangle", 1);
    blip(0.08, 1174, 2349, 0.09, "triangle", 0.95);
    blip(0.16, 1568, 3136, 0.1, "triangle", 0.9);
    blip(0.26, 2093, 4186, 0.16, "triangle", 0.85);
  } else if (kind === "shot") {
    // コルク銃の「ぽんっ」（小音量・毎射撃）
    blip(0, 340, 90, 0.05, "square", 0.35);
  } else {
    // ミス: 低い「ぽすっ」
    blip(0, 260, 100, 0.14, "sine", 0.9);
  }
}
