import Header from "@/components/sections/Header";
import Hero from "@/components/sections/Hero";
import GamesSection from "@/components/sections/GamesSection";
import PostersSection from "@/components/sections/PostersSection";
import StallsSection from "@/components/sections/StallsSection";
import Footer from "@/components/sections/Footer";

// 認証状態（Header）と投稿ポスター（PostersSection）を毎リクエスト取得する
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <GamesSection />
        <PostersSection />
        <StallsSection />
      </main>
      <Footer />
    </>
  );
}
