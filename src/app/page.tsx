import Header from "@/components/sections/Header";
import Hero from "@/components/sections/Hero";
import GamesSection from "@/components/sections/GamesSection";
import PostersSection from "@/components/sections/PostersSection";
import StallsSection from "@/components/sections/StallsSection";
import Footer from "@/components/sections/Footer";

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
