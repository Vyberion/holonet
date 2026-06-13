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

function MiddleRanks({ items }) {
  const coreRanks = items.filter(item => !item.path);
  const loreRanks = items.filter(item => item.path === "Lore Path");
  const combatRanks = items.filter(item => item.path === "Combat Path");

  return (
    <>
      <HierarchyGrid items={coreRanks} />
      <div className="hierarchy-path-grid">
        <section className="hierarchy-path-column" aria-labelledby="lore-path-title">
          <h3 id="lore-path-title">Lore Path</h3>
          <HierarchyGrid items={loreRanks} />
        </section>
        <section className="hierarchy-path-column" aria-labelledby="combat-path-title">
          <h3 id="combat-path-title">Combat Path</h3>
          <HierarchyGrid items={combatRanks} />
        </section>
      </div>
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
            {group.id === "middle-ranks"
              ? <MiddleRanks items={items.filter(item => item.groupId === group.id)} />
              : <HierarchyGrid items={items.filter(item => item.groupId === group.id)} />}
          </section>
        ))}
      </div>
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
