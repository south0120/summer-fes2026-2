import TaiyakiGame from "@/components/taiyaki/TaiyakiGame";
import RankingPanel from "@/components/game/RankingPanel";

export const metadata = { title: "ベーコンエッグたい焼き | Substack 夏祭り" };

export default function TaiyakiPage() {
  return (
    <>
      <TaiyakiGame />
      <RankingPanel game="taiyaki" />
    </>
  );
}
