import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";

function renderParagraphs(value) {
  return String(value || "")
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean);
}

export function HierarchyDetail({ item, guarded = false }) {
  const classified = item.classified;

  return (
    <HolonetFrame title={item.name.toUpperCase()} subtitle={item.groupTitle.toUpperCase()} footerNode="HRK-03">
      <div className={`codex-document hierarchy-detail${classified ? " hierarchy-detail--classified" : ""}`}>
        <article className="codex-article">
          <div className="article-header">
            <span className="article-number">{item.section} / {classified ? "CLASSIFIED" : item.category}</span>
            <h2 className="article-title">{item.name}</h2>
          </div>
          {classified ? (
            <div className="hierarchy-detail-hero hierarchy-detail-hero--classified" aria-hidden="true">
              <span>CLASSIFIED</span>
              <div className="hierarchy-classified-bars">
                <i />
                <i />
                <i />
              </div>
            </div>
          ) : (
            <div className="hierarchy-detail-hero" aria-hidden="true">
              <img src={item.image} alt="" loading="eager" />
              <span>{item.name}</span>
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
        </article>
      </div>
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} guarded={guarded} />
    </HolonetFrame>
  );
}
