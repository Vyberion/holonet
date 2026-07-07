import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { ThemeClass } from "../../../components/ThemeClass.jsx";

const SPECIAL_RANK_NEXT = {
  "sith-adept": [
    {
      href: "/middle-ranks/sith-sorcerer",
      name: "Sorcerer",
      navLabel: "Lore Path",
      metaLabel: "Next Rank ››"
    },
    {
      href: "/middle-ranks/sith-warrior",
      name: "Warrior",
      navLabel: "Combat Path",
      metaLabel: "Next Rank ››"
    }
  ],
  "sith-sorcerer": [
    {
      href: "/middle-ranks/sith-seer",
      name: "Seer",
      navLabel: "Next Rank",
      metaLabel: "Lore Path ››"
    }
  ],
  "sith-warrior": [
    {
      href: "/middle-ranks/sith-marauder",
      name: "Marauder",
      navLabel: "Next Rank",
      metaLabel: "Combat Path ››"
    }
  ],
  "sith-seer": [
    {
      href: "/high-ranks/sith-overseer",
      name: "Overseer",
      navLabel: "Next Rank",
      metaLabel: "High Rank ››"
    }
  ],
  "sith-marauder": [
    {
      href: "/high-ranks/sith-overseer",
      name: "Overseer",
      navLabel: "Next Rank",
      metaLabel: "High Rank ››"
    }
  ]
};

function renderParagraphs(value) {
  return String(value || "")
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean);
}

function normalizeImageSrc(src) {
  if (!src) return "";
  if (/^(?:https?:)?\/\//.test(src) || src.startsWith("data:") || src.startsWith("/")) return src;
  return `/${src}`;
}

function RankNavLink({ direction, item }) {
  const label = item.navLabel || (direction === "previous" ? "Previous Rank" : "Next Rank");
  const arrow = direction === "previous" ? "‹‹" : "››";
  const meta = item.metaLabel || `${item.category || item.groupTitle} ${arrow}`;

  return (
    <a className={`hierarchy-rank-nav-link hierarchy-rank-nav-link--${direction}`} href={item.href}>
      <span className="hierarchy-rank-nav-kicker">{label}</span>
      <strong className="hierarchy-rank-nav-name">{item.name}</strong>
      <span className="hierarchy-rank-nav-meta">{meta}</span>
    </a>
  );
}

function HierarchyRankNav({ nav, item }) {
  const nextItems = SPECIAL_RANK_NEXT[item?.slug] || (nav?.next ? [nav.next] : []);
  if (!nav?.previous && !nextItems.length) return null;

  return (
    <nav className="hierarchy-rank-nav" aria-label="Rank progression">
      {nav?.previous ? <RankNavLink direction="previous" item={nav.previous} /> : null}
      {nextItems.map(next => <RankNavLink direction="next" item={next} key={next.href} />)}
    </nav>
  );
}

export function HierarchyDetail({ item, guarded = false, rankNav = null }) {
  const classified = item.classified;
  const imageSrc = normalizeImageSrc(item.image);

  return (
    <HolonetFrame title={item.name.toUpperCase()} subtitle={item.groupTitle.toUpperCase()} footerNode="HRK-03" theme={item.theme}>
      {item.theme && <ThemeClass theme={item.theme} />}
      <div className={`codex-document hierarchy-detail${classified ? " hierarchy-detail--classified" : ""}`}>
        <article className="codex-article">
          <div className="article-header">
            <span className="article-number">{item.section} / {classified ? "CLASSIFIED" : item.category}</span>
            <h2 className="article-title">{item.name}</h2>
          </div>
          {classified ? (
            <div className="hierarchy-detail-hero hierarchy-detail-hero--classified" aria-hidden="true">
              <span>CLASSIFIED</span>
            </div>
          ) : (
            <div className="hierarchy-detail-hero" aria-hidden="true">
              <img src={imageSrc} alt="" loading="eager" />
            </div>
          )}
          <div className="article-content">
            {classified ? (
              <div className="regulation hierarchy-classified-record">
                <h3 className="reg-title">Access Sealed</h3>
                <div className="hierarchy-classified-line" />
                <div className="hierarchy-classified-line hierarchy-classified-line--short" />
                <div className="hierarchy-classified-line hierarchy-classified-line--wide" />
              </div>
            ) : (
              <div className="regulation">
                <h3 className="reg-title">Information</h3>
                {renderParagraphs(item.body).map((paragraph, index) => (
                  <p className="reg-text" key={index}>{paragraph}</p>
                ))}
              </div>
            )}
          </div>
          <HierarchyRankNav nav={rankNav} item={item} />
        </article>
      </div>
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} guarded={guarded} />
    </HolonetFrame>
  );
}
