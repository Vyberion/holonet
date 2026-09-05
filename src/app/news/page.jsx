import { HolonetFrame } from "../../components/HolonetFrame.jsx";
import { PageScripts } from "../../components/PageScripts.jsx";
import { holonetMetadata } from "../../lib/metadata.js";
import { supabaseRest } from "../../../modules/auth/session-store.js";
import Link from "next/link";

export const metadata = holonetMetadata({
  title: "Imperial News Network",
  description: "Official news and broadcasts from the Sith Empire."
});

export default async function NewsPage() {
  // Fetch published news articles
  let articles = [];
  try {
    articles = await supabaseRest("news_articles?status=eq.PUBLISHED&order=published_at.desc").catch(() => []);
  } catch (err) {
    console.error("Failed to fetch news articles:", err);
  }

  return (
    <HolonetFrame
      title="IMPERIAL NEWS NETWORK"
      subtitle="BROADCASTING FROM KOR-7"
      footerNode="INN-NODE"
      mainClassName="news-main"
    >
      <div className="document-shell" style={{ margin: "0 auto", padding: "2rem" }}>
        
        {articles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-dim)", fontFamily: "'Share Tech Mono', monospace" }}>
            [ NO ACTIVE BROADCASTS FOUND ]
          </div>
        ) : (
          <div className="news-grid">
            {articles.map((article) => (
              <Link href={`/news/${article.slug}`} key={article.id} className="news-card">
                <div className="news-meta">
                  <span>{new Date(article.published_at || article.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  <span>AUTHOR: {article.author_name}</span>
                </div>
                <h2 className="news-title">{article.title}</h2>
                <div className="news-excerpt">
                  {/* Super simple excerpt generator stripping potential HTML/Markdown if needed, 
                      but since we just want a preview, we'll take the first 120 chars */}
                  {article.content?.substring(0, 120).replace(/[#*`_>]/g, '')}...
                </div>
                <span className="news-read-more">DECRYPT TRANSMISSION &rsaquo;&rsaquo;</span>
              </Link>
            ))}
          </div>
        )}

      </div>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
