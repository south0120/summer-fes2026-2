import RingTossGame from "@/components/ring-toss/RingTossGame";
import RankingPanel from "@/components/game/RankingPanel";

export const metadata = { title: "輪投げ | Substack 夏祭り" };

export default function RingTossPage() {
  return (
    <>
      <RingTossGame />
      <RankingPanel game="ring-toss" />
    </>
  );
}
