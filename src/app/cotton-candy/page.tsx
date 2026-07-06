import CottonCandyGame from "@/components/cotton-candy/CottonCandyGame";
import RankingPanel from "@/components/game/RankingPanel";

export const metadata = { title: "わたあめづくり | Substack 夏祭り" };

export default function CottonCandyPage() {
  return (
    <>
      <CottonCandyGame />
      <RankingPanel game="cotton-candy" />
    </>
  );
}
