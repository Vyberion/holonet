import { supabaseRest } from "../../../../modules/auth/session-store.js";
import { holonetMetadata } from "../../../lib/metadata.js";
import StatutesClient from "./StatutesClient.jsx";

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const id = params?.id;
  
  if (id) {
    try {
      const data = await supabaseRest(
        `codex_statutes?id=eq.${encodeURIComponent(id)}&select=id,title,summary`,
        { method: "GET" }
      );
      
      if (data && data.length > 0) {
        const statute = data[0];
        return holonetMetadata({
          title: statute.title,
          description: statute.summary || "Legislative Archive"
        });
      }
    } catch (e) {
      console.error("Failed to fetch statute for metadata:", e);
    }
  }
  
  return holonetMetadata({
    title: "Statutes",
    description: "Legislative Archive"
  });
}

export default function StatutesPage() {
  return <StatutesClient />;
}
