import { notFound } from "next/navigation";
import { EMPEROR_ARCHIVE_GROUP, emperorArchiveItems, getEmperorArchiveItem } from "../../../../../modules/data/hierarchy.js";
import { HierarchyDetail } from "../../../(hierarchy)/hierarchy/HierarchyDetail.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";

export function generateStaticParams() {
  return emperorArchiveItems().map(item => ({ slug: item.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const item = getEmperorArchiveItem(slug);
  if (!item) return {};

  return holonetMetadata({
    title: item.name,
    description: `${item.category} archive record.`
  });
}

export default async function EmperorArchiveDetailPage({ params }) {
  const { slug } = await params;
  const item = getEmperorArchiveItem(slug);
  if (!item) notFound();

  return <HierarchyDetail item={{ ...item, groupTitle: EMPEROR_ARCHIVE_GROUP.title }} />;
}
