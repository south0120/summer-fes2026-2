/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // 屋台とポスターは「屋台・ポスター」に統合済み。旧URLは統合先へ流す
    return [
      { source: "/stalls", destination: "/posters", permanent: false },
      { source: "/stalls/new", destination: "/posters/new", permanent: false },
    ];
  },
};

export default nextConfig;
