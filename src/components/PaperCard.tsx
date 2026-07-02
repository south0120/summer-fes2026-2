import type { ReactNode } from "react";

export type PaperColor = "kraft" | "paper" | "night" | "red" | "teal" | "gold";

const colorClasses: Record<PaperColor, string> = {
  kraft: "bg-kraft text-fes-ink",
  paper: "bg-kraft-paper text-fes-ink",
  night: "bg-night-800 text-kraft",
  red: "bg-fes-red text-kraft-paper",
  teal: "bg-fes-teal text-kraft-paper",
  gold: "bg-fes-gold text-fes-ink",
};

type PaperCardProps = {
  children: ReactNode;
  color?: PaperColor;
  elevation?: "sm" | "md" | "lg";
  /** ちぎり紙風の不揃い角バリエーション */
  torn?: 1 | 2;
  className?: string;
};

const shadowClasses = {
  sm: "shadow-paper-sm",
  md: "shadow-paper",
  lg: "shadow-paper-lg",
} as const;

/**
 * 紙カード。二重影 + クラフト紙の縁取り + 繊維テクスチャで
 * 「切り紙を夜の台紙に貼った」見た目を作る共通パーツ。
 */
export default function PaperCard({
  children,
  color = "kraft",
  elevation = "md",
  torn = 1,
  className = "",
}: PaperCardProps) {
  return (
    <div
      className={`${torn === 1 ? "torn" : "torn-2"} border-[3px] border-kraft-paper/90 paper-grain ${colorClasses[color]} ${shadowClasses[elevation]} ${className}`}
    >
      {children}
    </div>
  );
}
