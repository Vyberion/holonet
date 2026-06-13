import { HolonetNav } from "../../components/HolonetNav.jsx";
import { holonetMetadata } from "../../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "Problematic Medias",
  description: "Problematic medias archive."
});

export default function ProblematicMediasPage() {
  return (
    <>
      <div id="nav-container">
        <HolonetNav />
      </div>

      <main className="problematic-medias-page">
        <img src="/assets/problematic_medias.gif" alt="" />
      </main>

      <style>{`
        .problematic-medias-page {
          align-items: center;
          display: flex;
          justify-content: center;
          max-width: none;
          min-height: 100vh;
          padding: 82px 16px 20px;
          width: 100%;
        }

        .problematic-medias-page img {
          display: block;
          height: auto;
          max-height: calc(100vh - 102px);
          max-width: 100%;
          object-fit: contain;
        }
      `}</style>
    </>
  );
}
