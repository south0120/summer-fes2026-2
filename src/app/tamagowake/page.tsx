import TamagowakeGame from "@/components/tamagowake/TamagowakeGame";
import RankingPanel from "@/components/game/RankingPanel";

export const metadata = { title: "たまごわけ | Substack 夏祭り" };

export default function TamagowakePage() {
  return (
    <>
      <TamagowakeGame />
      <RankingPanel game="tamagowake" />
    </>
  );
}
