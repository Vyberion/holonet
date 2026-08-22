import React, { useState } from "react";

function parseInlineTokens(text) {
  if (!text) return [];

  // Match: code, bold-italic, bold, underline, italic, strikethrough, spoiler, link
  const tokenRegex = /(```[\s\S]*?```|`[^`]+`|\|\|[\s\S]*?\|\||\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.substring(lastIndex, match.index) });
    }

    const raw = match[0];

    if (raw.startsWith("```") && raw.endsWith("```")) {
      const inner = raw.slice(3, -3);
      const firstLineEnd = inner.indexOf("\n");
      let code = inner;
      let lang = "";
      if (firstLineEnd !== -1 && /^[a-zA-Z0-9_-]+$/.test(inner.substring(0, firstLineEnd).trim())) {
        lang = inner.substring(0, firstLineEnd).trim();
        code = inner.substring(firstLineEnd + 1);
      }
      parts.push({ type: "codeblock", content: code, lang });
    } else if (raw.startsWith("`") && raw.endsWith("`")) {
      parts.push({ type: "inline_code", content: raw.slice(1, -1) });
    } else if (raw.startsWith("||") && raw.endsWith("||")) {
      parts.push({ type: "spoiler", content: raw.slice(2, -2) });
    } else if (raw.startsWith("***") && raw.endsWith("***")) {
      parts.push({ type: "bold_italic", content: raw.slice(3, -3) });
    } else if (raw.startsWith("**") && raw.endsWith("**")) {
      parts.push({ type: "bold", content: raw.slice(2, -2) });
    } else if (raw.startsWith("__") && raw.endsWith("__")) {
      parts.push({ type: "underline", content: raw.slice(2, -2) });
    } else if (raw.startsWith("~~") && raw.endsWith("~~")) {
      parts.push({ type: "strikethrough", content: raw.slice(2, -2) });
    } else if (raw.startsWith("*") && raw.endsWith("*")) {
      parts.push({ type: "italic", content: raw.slice(1, -1) });
    } else if (raw.startsWith("_") && raw.endsWith("_")) {
      parts.push({ type: "italic", content: raw.slice(1, -1) });
    } else if (raw.startsWith("[") && raw.includes("](") && raw.endsWith(")")) {
      const splitIndex = raw.indexOf("](");
      const linkText = raw.substring(1, splitIndex);
      const linkUrl = raw.substring(splitIndex + 2, raw.length - 1);
      parts.push({ type: "link", text: linkText, url: linkUrl });
    } else {
      parts.push({ type: "text", content: raw });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.substring(lastIndex) });
  }

  return parts;
}

function SpoilerItem({ content }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      className={`discord-spoiler ${revealed ? "revealed" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        setRevealed(!revealed);
      }}
      title={revealed ? "Click to conceal" : "Click to reveal spoiler"}
    >
      {parseInline(content)}
    </span>
  );
}

function parseInline(text) {
  const tokens = parseInlineTokens(text);
  return tokens.map((token, idx) => {
    switch (token.type) {
      case "bold":
        return <strong key={idx}>{parseInline(token.content)}</strong>;
      case "italic":
        return <em key={idx}>{parseInline(token.content)}</em>;
      case "bold_italic":
        return <strong key={idx}><em>{parseInline(token.content)}</em></strong>;
      case "underline":
        return <u key={idx}>{parseInline(token.content)}</u>;
      case "strikethrough":
        return <del key={idx}>{parseInline(token.content)}</del>;
      case "inline_code":
        return <code key={idx} className="discord-inline-code">{token.content}</code>;
      case "spoiler":
        return <SpoilerItem key={idx} content={token.content} />;
      case "link":
        return (
          <a
            key={idx}
            href={token.url}
            target="_blank"
            rel="noopener noreferrer"
            className="discord-link"
            onClick={(e) => e.stopPropagation()}
          >
            {token.text}
          </a>
        );
      case "codeblock":
        return (
          <pre key={idx} className="discord-codeblock">
            <code>{token.content}</code>
          </pre>
        );
      case "text":
      default:
        return token.content;
    }
  });
}

export function DiscordMarkdown({ content, className = "" }) {
  if (!content) return null;

  const rawText = String(content).replace(/\r\n/g, "\n");
  const lines = rawText.split("\n");
  const blocks = [];
  let currentList = null;
  let currentQuote = null;
  let inCodeBlock = false;
  let codeBlockContent = [];
  let codeBlockLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Multiline Codeblock Handling
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        blocks.push({
          type: "codeblock",
          lang: codeBlockLang,
          content: codeBlockContent.join("\n")
        });
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLang = "";
      } else {
        if (currentList) { blocks.push(currentList); currentList = null; }
        if (currentQuote) { blocks.push(currentQuote); currentQuote = null; }
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        codeBlockContent = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Dividers
    if (/^(\*\*\*|---|___)\s*$/.test(line.trim())) {
      if (currentList) { blocks.push(currentList); currentList = null; }
      if (currentQuote) { blocks.push(currentQuote); currentQuote = null; }
      blocks.push({ type: "divider" });
      continue;
    }

    // Headers
    const h1Match = line.match(/^#\s+(.*)$/);
    if (h1Match) {
      if (currentList) { blocks.push(currentList); currentList = null; }
      if (currentQuote) { blocks.push(currentQuote); currentQuote = null; }
      blocks.push({ type: "h1", text: h1Match[1] });
      continue;
    }

    const h2Match = line.match(/^##\s+(.*)$/);
    if (h2Match) {
      if (currentList) { blocks.push(currentList); currentList = null; }
      if (currentQuote) { blocks.push(currentQuote); currentQuote = null; }
      blocks.push({ type: "h2", text: h2Match[1] });
      continue;
    }

    const h3Match = line.match(/^###\s+(.*)$/);
    if (h3Match) {
      if (currentList) { blocks.push(currentList); currentList = null; }
      if (currentQuote) { blocks.push(currentQuote); currentQuote = null; }
      blocks.push({ type: "h3", text: h3Match[1] });
      continue;
    }

    // Blockquotes
    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      if (currentList) { blocks.push(currentList); currentList = null; }
      if (!currentQuote) currentQuote = { type: "quote", lines: [] };
      currentQuote.lines.push(quoteMatch[1]);
      continue;
    } else if (currentQuote) {
      blocks.push(currentQuote);
      currentQuote = null;
    }

    // Lists (Unordered & Ordered)
    const ulMatch = line.match(/^(\s*)([-*•])\s+(.*)$/);
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);

    if (ulMatch) {
      const indent = ulMatch[1].length;
      if (!currentList || currentList.listType !== "ul") {
        if (currentList) blocks.push(currentList);
        currentList = { type: "list", listType: "ul", items: [] };
      }
      currentList.items.push({ text: ulMatch[3], indent });
      continue;
    } else if (olMatch) {
      const indent = olMatch[1].length;
      if (!currentList || currentList.listType !== "ol") {
        if (currentList) blocks.push(currentList);
        currentList = { type: "list", listType: "ol", items: [] };
      }
      currentList.items.push({ text: olMatch[3], num: olMatch[2], indent });
      continue;
    } else if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }

    // Blank lines
    if (!line.trim()) {
      blocks.push({ type: "spacer" });
      continue;
    }

    // Normal Paragraph / Text
    blocks.push({ type: "p", text: line });
  }

  if (inCodeBlock) {
    blocks.push({ type: "codeblock", lang: codeBlockLang, content: codeBlockContent.join("\n") });
  }
  if (currentList) blocks.push(currentList);
  if (currentQuote) blocks.push(currentQuote);

  return (
    <div className={`discord-markdown-root ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "h1":
            return <h1 key={idx} className="dm-h1">{parseInline(block.text)}</h1>;
          case "h2":
            return <h2 key={idx} className="dm-h2">{parseInline(block.text)}</h2>;
          case "h3":
            return <h3 key={idx} className="dm-h3">{parseInline(block.text)}</h3>;
          case "quote":
            return (
              <blockquote key={idx} className="dm-quote">
                {block.lines.map((l, lIdx) => (
                  <div key={lIdx}>{parseInline(l)}</div>
                ))}
              </blockquote>
            );
          case "list":
            if (block.listType === "ol") {
              return (
                <ol key={idx} className="dm-ol">
                  {block.items.map((item, iIdx) => (
                    <li key={iIdx} style={{ marginLeft: item.indent ? `${item.indent * 12}px` : undefined }}>
                      {parseInline(item.text)}
                    </li>
                  ))}
                </ol>
              );
            }
            return (
              <ul key={idx} className="dm-ul">
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} style={{ marginLeft: item.indent ? `${item.indent * 12}px` : undefined }}>
                    {parseInline(item.text)}
                  </li>
                ))}
              </ul>
            );
          case "codeblock":
            return (
              <div key={idx} className="dm-codeblock-wrapper">
                {block.lang && <span className="dm-codeblock-lang">{block.lang}</span>}
                <pre className="dm-codeblock">
                  <code>{block.content}</code>
                </pre>
              </div>
            );
          case "divider":
            return <hr key={idx} className="dm-divider" />;
          case "spacer":
            return <div key={idx} className="dm-spacer" />;
          case "p":
          default:
            return <p key={idx} className="dm-p">{parseInline(block.text)}</p>;
        }
      })}

      <style jsx global>{`
        .discord-markdown-root {
          font-family: inherit;
          line-height: 1.6;
          color: var(--text-bright, #fff);
          word-break: break-word;
        }

        .discord-markdown-root .dm-h1 {
          font-family: 'Cinzel', serif;
          font-size: 1.35rem;
          color: var(--red-bright, #ff3b4f);
          margin: 1.2rem 0 0.6rem;
          letter-spacing: 0.08em;
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.1));
          padding-bottom: 0.3rem;
          text-shadow: 0 0 8px var(--red-glow, rgba(255,59,79,0.3));
        }

        .discord-markdown-root .dm-h2 {
          font-family: 'Cinzel', serif;
          font-size: 1.15rem;
          color: var(--red-bright, #ff3b4f);
          margin: 1rem 0 0.5rem;
          letter-spacing: 0.06em;
          text-shadow: 0 0 6px var(--red-glow, rgba(255,59,79,0.25));
        }

        .discord-markdown-root .dm-h3 {
          font-family: 'Orbitron', monospace;
          font-size: 0.95rem;
          color: var(--red-bright, #ff3b4f);
          margin: 0.8rem 0 0.4rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .discord-markdown-root .dm-p {
          margin: 0 0 0.5rem;
          line-height: 1.65;
        }

        .discord-markdown-root .dm-spacer {
          height: 0.6rem;
        }

        .discord-markdown-root .dm-quote {
          margin: 0.6rem 0;
          padding: 0.5rem 0.8rem 0.5rem 1rem;
          background: rgba(192, 0, 26, 0.08);
          border-left: 3px solid var(--red-bright, #ff3b4f);
          color: var(--text, #ddd);
          font-style: italic;
          border-radius: 0 4px 4px 0;
        }

        .discord-markdown-root .dm-ul,
        .discord-markdown-root .dm-ol {
          margin: 0.4rem 0 0.8rem 1.4rem;
          padding: 0;
        }

        .discord-markdown-root .dm-ul li {
          list-style-type: disc;
          margin-bottom: 0.25rem;
        }

        .discord-markdown-root .dm-ol li {
          list-style-type: decimal;
          margin-bottom: 0.25rem;
        }

        .discord-markdown-root .dm-divider {
          border: none;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--red-dim, rgba(255,59,79,0.3)), transparent);
          margin: 1.2rem 0;
        }

        .discord-markdown-root .discord-inline-code {
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 59, 79, 0.25);
          color: var(--red-bright, #ff3b4f);
          padding: 0.15rem 0.35rem;
          border-radius: 3px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.85em;
        }

        .discord-markdown-root .dm-codeblock-wrapper {
          position: relative;
          margin: 0.8rem 0;
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid var(--border-hot, rgba(255,59,79,0.35));
          border-radius: 4px;
          overflow: hidden;
        }

        .discord-markdown-root .dm-codeblock-lang {
          position: absolute;
          top: 4px;
          right: 8px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.65rem;
          color: var(--text-dim, #888);
          text-transform: uppercase;
        }

        .discord-markdown-root .dm-codeblock {
          padding: 0.8rem 1rem;
          margin: 0;
          overflow-x: auto;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.88rem;
          line-height: 1.5;
          color: #eee;
        }

        .discord-markdown-root .discord-spoiler {
          background: #202225;
          color: transparent;
          cursor: pointer;
          border-radius: 3px;
          padding: 0 0.3rem;
          user-select: none;
          transition: all 0.2s;
        }

        .discord-markdown-root .discord-spoiler.revealed {
          background: rgba(255, 255, 255, 0.1);
          color: inherit;
          user-select: text;
        }

        .discord-markdown-root .discord-link {
          color: var(--red-bright, #ff3b4f);
          text-decoration: underline;
          text-underline-offset: 3px;
          transition: opacity 0.2s;
        }
        .discord-markdown-root .discord-link:hover {
          opacity: 0.8;
          text-shadow: 0 0 6px var(--red-glow, rgba(255,59,79,0.4));
        }
      `}</style>
    </div>
  );
}
