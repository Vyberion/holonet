import { HolonetFrame } from "../../components/HolonetFrame.jsx";
import { PageScripts } from "../../components/PageScripts.jsx";

function renderParagraphs(value) {
  return String(value || "")
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean);
}

export function HierarchyDetail({ item }) {
  return (
    <HolonetFrame title={item.name.toUpperCase()} subtitle={item.groupTitle.toUpperCase()} footerNode="HRK-03">
      <div className="codex-document hierarchy-detail">
        <article className="codex-article">
          <div className="article-header">
            <span className="article-number">{item.section} / {item.category}</span>
            <h2 className="article-title">{item.name}</h2>
          </div>
          <div className="hierarchy-detail-hero" aria-hidden="true">
            <img src={item.image} alt="" />
            <span>{item.name}</span>
          </div>
          <div className="article-content">
            <div className="regulation">
              <h3 className="reg-title">Information</h3>
              {renderParagraphs(item.body).map((paragraph, index) => (
                <p className="reg-text" key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        </article>
      </div>
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
