import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";

export default function BoardPage() {
  return (
    <HolonetFrame title="THE BOARD" subtitle="PUBLIC TRANSMISSION TERMINAL" footerNode="KOR-7">
      <section className="board-shell" data-board-terminal>
        <div className="board-hero">
          <div>
            <span className="hub-kicker">Public Broadcast / Open Channel</span>
            <h2 className="hub-title">Transmission Board</h2>
          </div>
          <p className="hub-summary">Synchronizing public Sith Order broadcasts.</p>
        </div>
        <p className="hub-empty">Loading public transmission feed...</p>
      </section>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} moduleScripts={["/modules/client/board.js"]} />
    </HolonetFrame>
  );
}
