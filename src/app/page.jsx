import { HolonetFrame } from "../components/HolonetFrame.jsx";
import { PageScripts } from "../components/PageScripts.jsx";
import { holonetMetadata } from "../lib/metadata.js";
import { HomeNavGrid } from "./HomeNavGrid.jsx";

export const metadata = holonetMetadata({
  title: "The Holonet",
  description: "Laws, lore, ranks, records and division resources for Manar's The Sith Order."
});

export default function HomePage() {
  return (
    <HolonetFrame
      title="THE HOLONET"
      subtitle="IMPERIAL TRANSMISSION NETWORK"
      footerNode="KOR-7"
      mainClassName="home-main"
    >
      <HomeNavGrid />

      <div className="marquee-wrap" aria-hidden="true">
        <div className="marquee-track" style={{ color: "var(--text-dim)" }}>
          {Array(2).fill([
            "PEACE IS A LIE, THERE IS ONLY PASSION",
            "✦",
            "THROUGH PASSION, I GAIN STRENGTH",
            "✦",
            "THROUGH STRENGTH, I GAIN POWER",
            "✦",
            "THROUGH POWER, I GAIN VICTORY",
            "✦",
            "THROUGH VICTORY, MY CHAINS ARE BROKEN",
            "✦",
            "THE FORCE SHALL FREE ME",
            "✦"
          ]).flat().map((item, i) => (
            <span key={i} className={item === "✦" ? "sep" : ""}>{item}</span>
          ))}
        </div>
      </div>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
