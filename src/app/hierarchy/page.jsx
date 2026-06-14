import { HolonetFrame } from "../../components/HolonetFrame.jsx";
import { PageScripts } from "../../components/PageScripts.jsx";
import { hierarchyItems, HIERARCHY_GROUPS } from "../../../modules/data/hierarchy.js";
import { holonetMetadata } from "../../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "Hierarchy",
  description: "Rank paths, progression and divisional information."
});

function HierarchyCard({ item }) {
  return (
    <a className="nav-card hierarchy-card" href={item.href} aria-label={`Open ${item.name}`}>
      <div className="card-inner-border" aria-hidden="true" />
      <div className="card-corners" aria-hidden="true" />
      <div className="card-vline" aria-hidden="true" />
      <div className="card-scan" aria-hidden="true" />
      <img className="hierarchy-card-bg" src={item.image} alt="" loading="lazy" aria-hidden="true" />
      <h2 className="card-title">{item.name}</h2>
      <span className="card-enter" aria-hidden="true">Open &rsaquo;&rsaquo;</span>
    </a>
  );
}

function HierarchyGrid({ items }) {
  return (
    <div className="hierarchy-grid">
      {items.map(item => (
        <HierarchyCard item={item} key={`${item.groupId}-${item.slug}`} />
      ))}
    </div>
  );
}

function pathHeadingId(path) {
  return `path-${path.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function HierarchyPathGroups({ items }) {
  const directItems = items.filter(item => !item.path);

  const pathGroups = items
    .filter(item => item.path)
    .reduce((groups, item) => {
      if (!groups[item.path]) groups[item.path] = [];
      groups[item.path].push(item);
      return groups;
    }, {});

  return (
    <>
      {directItems.length ? <HierarchyGrid items={directItems} /> : null}

      {Object.entries(pathGroups).length ? (
        <div className="hierarchy-path-grid">
          {Object.entries(pathGroups).map(([path, pathItems]) => {
            const headingId = pathHeadingId(path);
            const pathCount = Math.max(1, Math.min(pathItems.length, 2));
            const pathClass = pathItems.length > 2
              ? "hierarchy-path-column is-wide-path"
              : "hierarchy-path-column";

            return (
              <section
                className={pathClass}
                aria-labelledby={headingId}
                key={path}
                style={{ "--path-count": pathCount }}
              >
                <h3 id={headingId}>{path}</h3>
                <HierarchyGrid items={pathItems} />
              </section>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

export default function HierarchyPage() {
  const items = hierarchyItems();

  return (
    <HolonetFrame title="RANKS" subtitle="SITH HIERARCHY" footerNode="HRK-03">
      <div className="hierarchy-main">
        {HIERARCHY_GROUPS.map(group => (
          <section className="registry-section hierarchy-section" aria-labelledby={`hierarchy-${group.id}`} key={group.id}>
            <div className="section-header">
              <span className="section-tag" id={`hierarchy-${group.id}`}>// {group.title}</span>
              <div className="section-rule" />
            </div>
            {group.description ? <p className="hierarchy-section-copy">{group.description}</p> : null}
            <HierarchyPathGroups items={items.filter(item => item.groupId === group.id)} />
          </section>
        ))}
      </div>
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
