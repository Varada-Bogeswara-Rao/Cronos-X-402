"use client";

import dynamic from "next/dynamic";

const HeroSection = dynamic(() => import("@/components/blocks/3d-hero-section-boxes").then((mod) => mod.HeroSection), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-black" />,
});


export default function Home() {
  return (
    <div>
      <HeroSection />
    </div>
  );
}
