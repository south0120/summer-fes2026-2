type LanternProps = {
  size?: number;
  color?: "red" | "orange";
  swing?: "fast" | "slow" | "none";
  className?: string;
};

/**
 * 紙提灯。CSSのみ・灯りグロー付き。ヒーローの電線や帯の飾りに吊るす。
 */
export default function Lantern({
  size = 44,
  color = "red",
  swing = "fast",
  className = "",
}: LanternProps) {
  const body =
    color === "red"
      ? "linear-gradient(180deg,#e05a3a 0%,#c4372a 45%,#93221a 100%)"
      : "linear-gradient(180deg,#f5a94f 0%,#e8883b 45%,#c05f1d 100%)";
  const swingClass =
    swing === "fast" ? "lantern-sway" : swing === "slow" ? "lantern-sway-slow" : "";
  return (
    <div
      className={`inline-flex flex-col items-center ${swingClass} ${className}`}
      style={{ width: size }}
      aria-hidden
    >
      {/* 吊り紐 */}
      <div className="w-[2px] bg-kraft/60" style={{ height: size * 0.28 }} />
      {/* 上蓋 */}
      <div
        className="rounded-sm bg-fes-ink"
        style={{ width: size * 0.42, height: size * 0.12 }}
      />
      {/* 本体 */}
      <div
        className="relative shadow-glow"
        style={{
          width: size,
          height: size * 1.06,
          borderRadius: "48% / 44%",
          background: body,
        }}
      >
        {/* 骨（横線） */}
        <div
          className="absolute inset-x-[6%] inset-y-[10%] opacity-35"
          style={{
            borderRadius: "inherit",
            backgroundImage:
              "repeating-linear-gradient(180deg, transparent 0 22%, rgba(40,10,5,.5) 22% 25%)",
          }}
        />
        {/* 灯りのハイライト */}
        <div
          className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2"
          style={{
            width: size * 0.52,
            height: size * 0.6,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,214,140,.75) 0%, rgba(255,190,110,.25) 55%, transparent 75%)",
          }}
        />
      </div>
      {/* 下蓋 + 房 */}
      <div
        className="rounded-sm bg-fes-ink"
        style={{ width: size * 0.4, height: size * 0.1 }}
      />
      <div className="w-[2px] bg-fes-gold" style={{ height: size * 0.18 }} />
    </div>
  );
}
