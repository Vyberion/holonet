import { supabaseRest } from "../../../../lib/api-helpers.js";
import { PageScripts } from "../../../../components/PageScripts.jsx";

export const metadata = {
  title: "Constitution of the Order - The Holonet"
};

export default async function ConstitutionPage() {
  let sections = [];
  try {
    sections = await supabaseRest("law_sections?document_type=eq.constitution&order=article_number.asc,section_number.asc") || [];
  } catch (error) {
    console.error("Failed to fetch constitution:", error);
  }

  return (
    <main className="law-container">
      <PageScripts stylesheets={["/css/law.css"]} />
      <div className="law-hero">
        <span className="hub-kicker">Imperial Law</span>
        <h1 className="hub-title">Constitution of the Order</h1>
      </div>
      
      {sections.length === 0 ? (
        <div className="law-empty">
          The Constitution has not been inscribed into the holocron.
        </div>
      ) : (
        <div className="law-content">
          {sections.map(section => (
            <div key={section.id} className="law-article">
              {section.title && <h3>{section.title}</h3>}
              <div className="law-section">
                <h4>Article {section.article_number}, Section {section.section_number}</h4>
                <div className="law-text" dangerouslySetInnerHTML={{ __html: section.content }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
