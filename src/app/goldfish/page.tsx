import GoldfishGame from "@/components/goldfish/GoldfishGame";
import RankingPanel from "@/components/game/RankingPanel";

export const metadata = { title: "金魚すくい | Substack 夏祭り" };

export default function GoldfishPage() {
  return (
    <>
      <GoldfishGame />
      <RankingPanel game="goldfish" />
    </>
  );
}
