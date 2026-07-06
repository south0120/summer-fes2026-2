import WhackGame from "@/components/whack/WhackGame";
import RankingPanel from "@/components/game/RankingPanel";

export const metadata = { title: "たぬき叩き | Substack 夏祭り" };

export default function WhackPage() {
  return (
    <>
      <WhackGame />
      <RankingPanel game="whack" />
    </>
  );
}
