import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";
import { PublicPerceptionForm } from "./PublicPerceptionForm.jsx";

export const metadata = holonetMetadata({
  title: "Public Perception",
  description: "Polling the Order."
});

export default function PublicPerceptionPage() {
  return (
    <HolonetFrame title="PUBLIC PERCEPTION" subtitle="GATHERING INFORMATION" includeSearchOverlay>
      <PublicPerceptionForm />

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
