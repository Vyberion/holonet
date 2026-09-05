import { holonetMetadata } from "../../../lib/metadata.js";
import TimelineClient from "./TimelineClient.jsx";

export const metadata = holonetMetadata({
  title: "The Timeline",
  description: "Historical chronology, epochal transitions, and Imperial records."
});

export default function TimelinePage() {
  return <TimelineClient />;
}
