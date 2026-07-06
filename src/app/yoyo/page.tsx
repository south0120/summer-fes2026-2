import YoyoGame from "@/components/yoyo/YoyoGame";
import RankingPanel from "@/components/game/RankingPanel";

export const metadata = { title: "ヨーヨーすくい | Substack 夏祭り" };

export default function YoyoPage() {
  return (
    <>
      <YoyoGame />
      <RankingPanel game="yoyo" />
    </>
  );
}
