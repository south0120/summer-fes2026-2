type FireworkProps = {
  size?: number;
  color?: string;
  delay?: 0 | 1 | 2 | 3;
  className?: string;
};

/**
 * 切り紙風の花火バースト（SVG放射線 + 点）。opacityゆらぎでちらつく。
 */
export default function Firework({
  size = 90,
  color = "#E8A93B",
  delay = 0,
  className = "",
}: FireworkProps) {
  const delayClass = delay === 0 ? "" : `firework-twinkle-d${delay}`;
  const rays = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`firework-twinkle ${delayClass} ${className}`}
      aria-hidden
    >
      {rays.map((deg) => (
        <g key={deg} transform={`rotate(${deg} 50 50)`}>
          <line
            x1="50"
            y1="34"
            x2="50"
            y2="16"
            stroke={color}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <circle cx="50" cy="9" r="2.6" fill={color} />
        </g>
      ))}
      <circle cx="50" cy="50" r="5" fill={color} opacity=".85" />
    </svg>
  );
}
