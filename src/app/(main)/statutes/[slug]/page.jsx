import { redirect } from "next/navigation";

export default async function StatuteSlugRedirect({ params }) {
  const resolvedParams = await params;
  redirect(`/decrees/${resolvedParams.slug}`);
}
