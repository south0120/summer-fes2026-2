import ShootingGame from "@/components/shooting/ShootingGame";
import RankingPanel from "@/components/game/RankingPanel";

export const metadata = { title: "射的 | Substack 夏祭り" };

export default function ShootingPage() {
  return (
    <>
      <ShootingGame />
      <RankingPanel game="shooting" />
    </>
  );
}
