import { HolonetFrame } from "../../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";

const defaultCotsState = {
  champion: {
    name: "coldmanjar123",
    title: "Reaver Initiate",
    motto: "The Future Belongs to the Bold.",
    season: "CoTS I",
    podiumImage: { bucket: "", path: "", url: "" }
  },
  podium: [
    { place: "I", name: "Coldmanjar123", note: "Champion" },
    { place: "II", name: "Oynx", note: "Finalist" },
    { place: "III", name: "Barrakuda", note: "Podium" }
  ],
  bracket: [
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
  ]
};

export const metadata = holonetMetadata({
  title: "Champion of The Sith",
  description: "Champion of The Sith tournament bracket and Champion."
});

export default function CotsPage() {
  return (
    <HolonetFrame
      title="CHAMPION OF THE SITH"
      subtitle="TOURNAMENT RECORD"
      node="KOR-7 / HORUSET SYSTEM"
      signalLabel="LIVE"
      signalValue="|||||||||."
      signalPercent="91%"
      footerNode="CoTS"
      mainClassName="cots-main"
    >
      <div
        data-cots-root
        data-cots-state={JSON.stringify(defaultCotsState)}
      >
        <p className="hub-empty">CoTS archive synchronizing.</p>
      </div>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js", "/modules/client/cots.js"]} />
    </HolonetFrame>
  );
}
