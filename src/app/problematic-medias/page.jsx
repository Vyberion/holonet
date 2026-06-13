import { HolonetFrame } from "../../components/HolonetFrame.jsx";
import { PageScripts } from "../../components/PageScripts.jsx";
import { holonetMetadata } from "../../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "Problematic Medias",
  description: "Problematic medias archive."
});

export default function ProblematicMediasPage() {
  return (
    <HolonetFrame title="PROBLEMATIC MEDIAS" subtitle="ARCHIVE NODE" footerNode="KOR-7">
      <section className="problematic-media-shell" aria-label="Problematic medias archive">
        <img src="/assets/problematic_medias.gif" alt="Problematic medias archive" />
      </section>

      <style>{`
        .problematic-media-shell {
          align-items: center;
          background:
            radial-gradient(ellipse 80% 70% at 50% 45%, rgba(255, 59, 79, 0.08), transparent 68%),
            rgba(0, 0, 0, 0.18);
          border: 1px solid var(--border-hot);
          box-shadow: 0 0 34px var(--theme-body-glow-a), inset 0 0 30px var(--theme-wash);
          display: flex;
          justify-content: center;
          overflow: hidden;
          padding: clamp(12px, 3vw, 28px);
        }

        .problematic-media-shell img {
          display: block;
          height: auto;
          max-height: 72vh;
          max-width: 100%;
          object-fit: contain;
        }
      `}</style>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
