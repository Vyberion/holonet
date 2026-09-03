import { holonetMetadata } from "../../../lib/metadata.js";
import StatutesClient from "../statutes/StatutesClient.jsx";

export const metadata = holonetMetadata({
  title: "Imperial Decrees",
  description: "Statutory repository, Imperial Decrees, and Council legislative enactments."
});

export default function DecreesPage() {
  return <StatutesClient isDecreesMode={true} />;
}
