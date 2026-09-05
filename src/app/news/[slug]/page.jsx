import { notFound } from "next/navigation";
import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";
import { supabaseRest } from "../../../../modules/auth/session-store.js";
import { DiscordMarkdown } from "../../../components/DiscordMarkdown.jsx";
import Link from "next/link";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const articles = await supabaseRest(`news_articles?slug=eq.${encodeURIComponent(slug)}`).catch(() => []);
  const article = articles?.[0];

  if (!article) return {};

  return holonetMetadata({
    title: article.title,
    description: `News broadcast by ${article.author_name}.`
  });
}

export default async function NewsArticlePage({ params }) {
  const { slug } = await params;

  let article = null;
  try {
    const articles = await supabaseRest(`news_articles?slug=eq.${encodeURIComponent(slug)}`);
    article = articles?.[0];
  } catch (err) {
    console.error("Failed to fetch news article:", err);
  }

  if (!article) {
    notFound();
  }

  return (
    <HolonetFrame
      title="IMPERIAL NEWS NETWORK"
      subtitle="DECRYPTED TRANSMISSION"
      footerNode="INN-NODE"
      mainClassName="news-article-main document-viewer-page"
    >
      <div className="document-shell" style={{ margin: "0 auto", padding: "2rem" }}>
        
        <div style={{ marginBottom: "2rem" }}>
          <Link href="/news" style={{ color: "var(--text-dim)", textDecoration: "none", fontFamily: "'Share Tech Mono', monospace", textTransform: "uppercase" }}>
            &lsaquo;&lsaquo; RETURN TO FEED
          </Link>
        </div>

        <article className="codex-article" style={{ padding: "40px" }}>
          <header className="news-article-header">
            <h1 className="news-article-title">{article.title}</h1>
            <div className="news-article-meta">
              <span>DATE: {new Date(article.published_at || article.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span>AUTHOR: {article.author_name}</span>
              <span>CLASSIFICATION: UNRESTRICTED</span>
            </div>
          </header>

          {article.header_image_url && (
            <img src={article.header_image_url} alt="Broadcast Header" className="news-article-image" />
          )}

          <div className="news-article-content">
            {/* Reusing their DiscordMarkdown renderer if they use markdown, or rendering safely */}
            <DiscordMarkdown content={article.content} />
          </div>
        </article>

      </div>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
