import { supabaseRest } from "../../../../../modules/auth/session-store.js";
import { processStatuteSlugs } from "../../../../lib/slugUtils.js";
import { holonetMetadata } from "../../../../lib/metadata.js";
import StatutesClient from "../StatutesClient.jsx";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  
  if (slug) {
    try {
      const data = await supabaseRest("codex_statutes?select=id,title,summary&order=created_at.asc", { method: "GET" });
      if (data && data.length > 0) {
        const statutesWithSlugs = processStatuteSlugs(data);
        const statute = statutesWithSlugs.find(s => s.slug === slug);
        
        if (statute) {
          return holonetMetadata({
            title: statute.title,
            description: statute.summary || "Legislative Archive"
          });
        }
      }
    } catch (e) {
      console.error("Failed to fetch statute for metadata:", e);
    }
  }
  
  return holonetMetadata({
    title: "Statute Not Found",
    description: "Legislative Archive"
  });
}

export default async function StatuteSlugPage({ params }) {
  const resolvedParams = await params;
  return <StatutesClient initialSlug={resolvedParams.slug} />;
}
