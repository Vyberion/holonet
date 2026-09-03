import { holonetMetadata } from "../../../../lib/metadata.js";
import StatutesClient from "../../statutes/StatutesClient.jsx";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return holonetMetadata({
    title: slug ? `Decree - ${slug}` : "Imperial Decrees",
    description: "Statutory repository and Imperial Decrees."
  });
}

export default async function DecreeDetailPage({ params }) {
  const { slug } = await params;
  return <StatutesClient initialSlug={slug} isDecreesMode={true} />;
}
