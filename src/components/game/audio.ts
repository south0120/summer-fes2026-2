/**
 * 効果音: WebAudioの小さなシンセ。外部ファイル無し。
 * ユーザー操作起点で ensure() を呼んでから鳴らすこと（autoplay制限）。
 */

let ctx: AudioContext | null = null;

export function ensureAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; gain?: number; delay?: number; slide?: number } = {},
): void {
  const ac = ensureAudio();
  if (!ac) return;
  const { type = "triangle", gain = 0.12, delay = 0, slide = 0 } = opts;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** ノイズバースト（破裂・紙の音） */
function noise(dur: number, gain = 0.15, delay = 0): void {
  const ac = ensureAudio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(g).connect(ac.destination);
  src.start(t0);
}

export const sfx = {
  /** ボタン・投擲など軽い動作 */
  tap(): void {
    tone(660, 0.08, { type: "square", gain: 0.06 });
  },
  /** 投げる・飛ぶ */
  whoosh(): void {
    tone(320, 0.22, { type: "sawtooth", gain: 0.05, slide: -180 });
    noise(0.12, 0.05);
  },
  /** 小当たり */
  hit(): void {
    tone(523, 0.1);
    tone(784, 0.14, { delay: 0.06 });
  },
  /** 大当たり */
  bigHit(): void {
    tone(523, 0.1);
    tone(659, 0.1, { delay: 0.07 });
    tone(784, 0.12, { delay: 0.14 });
    tone(1047, 0.2, { delay: 0.21, gain: 0.14 });
  },
  /** はずれ・失敗 */
  miss(): void {
    tone(220, 0.18, { type: "sawtooth", gain: 0.07, slide: -80 });
  },
  /** 紙が破れる・破裂 */
  pop(): void {
    noise(0.18, 0.18);
    tone(180, 0.12, { type: "square", gain: 0.06, slide: -60 });
  },
  /** カウントダウン */
  tick(): void {
    tone(880, 0.06, { type: "square", gain: 0.05 });
  },
  /** 終了ホイッスル */
  finish(): void {
    tone(784, 0.16);
    tone(659, 0.16, { delay: 0.14 });
    tone(523, 0.3, { delay: 0.28 });
  },
};
