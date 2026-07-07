import CastellaGame from "@/components/castella/CastellaGame";
import RankingPanel from "@/components/game/RankingPanel";

export const metadata = { title: "ベビーカステラ | Substack 夏祭り" };

export default function CastellaPage() {
  return (
    <>
      <CastellaGame />
      <RankingPanel game="castella" />
    </>
  );
}
