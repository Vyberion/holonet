import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";

const champion = {
  name: "coldmanjar123",
  title: "Reaver Initiate",
  motto: "The Future Belongs to the Bold.",
  record: "Champion",
  season: "CoTS I",
  podiumImage: "",
  winnerImage: ""
};

const bracketRounds = [
  {
    name: "Opening Duels",
    matches: [
      { id: "A1", left: "Oynx", right: "Coldmanjar", winner: "Coldmanjar", score: "0-1" },
      { id: "A2", left: "Shaz", right: "Tactia", winner: "Tactia", score: "0-1" },
      { id: "A3", left: "Shan", right: "Zyrax", winner: "Zyrax", score: "0-1" },
      { id: "A4", left: "Liquid", right: "Lux", winner: "Lux", score: "0-1" },
      { id: "A5", left: "Barrakuda", right: "Kumoku", winner: "Barrakuda", score: "1-0" },
      { id: "A6", left: "Kick", right: "Oynx", winner: "Oynx", score: "0-1" },
      { id: "A7", left: "Liquid", right: "Shan", winner: "Shan", score: "0-1" },
      { id: "A8", left: "Tactia", right: "Katt", winner: "Tactia", score: "1-0" }
    ]
  },
  {
    name: "Quarter Finals",
    matches: [
      { id: "Q1", left: "Coldmanjar", right: "Tactia", winner: "Coldmanjar", score: "1-0" },
      { id: "Q2", left: "Zyrax", right: "Lux", winner: "Zyrax", score: "1-0" },
      { id: "Q3", left: "Oynx", right: "Shan", winner: "Oynx", score: "1-0" },
      { id: "Q4", left: "Tactia", right: "xfz", winner: "Tactia", score: "1-0" }
    ]
  },
  {
    name: "Semi Finals",
    matches: [
      { id: "S1", left: "Coldmanjar", right: "Zyrax", winner: "Coldmanjar", score: "1-0" },
      { id: "S2", left: "Oynx", right: "Tactia", winner: "Oynx", score: "1-0" }
    ]
  },
  {
    name: "Grand Final",
    matches: [
      { id: "F1", left: "Coldmanjar", right: "Oynx", winner: "Coldmanjar", score: "1-0" }
    ]
  }
];

const podiumPlacements = [
  { place: "I", name: "Coldmanjar123", note: "Champion" },
  { place: "II", name: "Oynx", note: "Finalist" },
  { place: "III", name: "Barrakuda", note: "Podium" }
];

export const metadata = holonetMetadata({
  title: "Champion of The Sith",
  description: "Champion of The Sith records, winner showcase, podium imagery and tournament bracket."
});

function MediaSlot({ label, title, image, children }) {
  return (
    <figure className={`cots-media-card${image ? "" : " cots-media-card--empty"}`}>
      <div className="cots-media-frame">
        {image ? (
          <img src={image} alt={title} />
        ) : (
          <div className="cots-media-placeholder">
            <span>{label}</span>
            <strong>{title}</strong>
          </div>
        )}
      </div>
      <figcaption>{children}</figcaption>
    </figure>
  );
}

function Competitor({ name, winner }) {
  return (
    <div className={`cots-bracket-competitor${winner ? " is-winner" : ""}`}>
      <span>{name}</span>
      {winner ? <b aria-label="Winner">WIN</b> : null}
    </div>
  );
}

export default function CotsPage() {
  return (
    <HolonetFrame
      title="CHAMPION OF THE SITH"
      subtitle="CoTS TOURNAMENT RECORD"
      node="KOR-7 / ARENA ARCHIVE"
      signalLabel="LOCKED"
      signalValue="|||||||||."
      signalPercent="91%"
      footerNode="CoTS"
      mainClassName="cots-main"
    >
      <section className="cots-hero" aria-labelledby="cots-title">
        <div className="cots-hero-copy">
          <p className="hub-kicker">Current Champion</p>
          <h2 id="cots-title" className="cots-title">{champion.name}</h2>
          <p className="cots-quote">&quot;{champion.motto}&quot;</p>
        </div>
        <div className="cots-hero-stats" aria-label="Champion status">
          <div>
            <span className="hub-label">Title</span>
            <strong>{champion.title}</strong>
          </div>
          <div>
            <span className="hub-label">Record</span>
            <strong>{champion.record}</strong>
          </div>
          <div>
            <span className="hub-label">Season</span>
            <strong>{champion.season}</strong>
          </div>
        </div>
      </section>

      <section className="cots-media-grid" aria-label="Champion imagery">
        <MediaSlot label="Podium Image" title="Podium Transmission" image={champion.podiumImage}>
          <span>Final podium archive</span>
          <strong>Champion platform, runner-up positions and ceremony capture.</strong>
        </MediaSlot>
        <MediaSlot label="Winner Image" title="Winner Transmission" image={champion.winnerImage}>
          <span>Winner portrait</span>
          <strong>{champion.title} {champion.name}</strong>
        </MediaSlot>
      </section>

      <section className="cots-layout" aria-label="Tournament data">
        <div className="hub-panel cots-podium-panel">
          <h3 className="hub-panel-title">Podium Registry</h3>
          <div className="cots-podium-list">
            {podiumPlacements.map(entry => (
              <div className="cots-podium-row" key={entry.place}>
                <span>{entry.place}</span>
                <strong>{entry.name}</strong>
                <em>{entry.note}</em>
              </div>
            ))}
          </div>
        </div>

        <div className="hub-panel cots-bracket-panel">
          <div className="hub-panel-head">
            <h3 className="hub-panel-title">Tournament Bracket</h3>
            <span className="cots-bracket-status">Built-in bracket system</span>
          </div>
          <div className="cots-bracket" role="list">
            {bracketRounds.map(round => (
              <section className="cots-bracket-round" key={round.name} aria-label={round.name}>
                <h4>{round.name}</h4>
                <div className="cots-bracket-stack">
                  {round.matches.map(match => (
                    <article className="cots-bracket-match" key={match.id} role="listitem">
                      <div className="cots-match-code">{match.id}</div>
                      <Competitor name={match.left} winner={match.winner === match.left} />
                      <Competitor name={match.right} winner={match.winner === match.right} />
                      <div className="cots-match-footer">
                        <span>Score</span>
                        <strong>{match.score}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
