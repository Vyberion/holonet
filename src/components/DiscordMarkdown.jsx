"use client";

import React, { useState } from "react";

function parseInline(text) {
  if (!text) return null;

  // Replace Discord mentions: <#123>, <@123>, <@&123>
  const processed = String(text);

  // Token pattern matching in order of priority:
  // 1. Code: `code`
  // 2. Spoiler: ||spoiler||
  // 3. Bold Italic: ***text***
  // 4. Bold: **text**
  // 5. Underline: __text__
  // 6. Strikethrough: ~~text~~
  // 7. Italic: *text* or (isolated) _text_
  // 8. Link: [text](url)
  // 9. Channel/User mention: <#id> or <@id>
  const regex = /(`[^`]+`|\|\|[\s\S]*?\|\||\*\*\*(?:(?!\*\*\*).)+\*\*\*|\*\*(?:(?!\*\*).)+\*\*|__(?:(?!__).)+__|~~(?:(?!~~).)+~~|\*(?:(?!\*).)+\*|(?<=\s|^)_(?:(?!_).)+_(?=\s|$|[.,!?;:])|\[[^\]]+\]\([^)]+\)|<#[0-9]+>|<@!?[0-9]+>|<@&[0-9]+>)/g;

  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(processed)) !== null) {
    if (match.index > lastIndex) {
      elements.push(processed.substring(lastIndex, match.index));
    }

    const raw = match[0];
    const key = `el-${match.index}`;

    if (raw.startsWith("`") && raw.endsWith("`")) {
      elements.push(<code key={key} className="discord-inline-code">{raw.slice(1, -1)}</code>);
    } else if (raw.startsWith("||") && raw.endsWith("||")) {
      elements.push(<SpoilerItem key={key} content={raw.slice(2, -2)} />);
    } else if (raw.startsWith("***") && raw.endsWith("***")) {
      elements.push(<strong key={key}><em>{parseInline(raw.slice(3, -3))}</em></strong>);
    } else if (raw.startsWith("**") && raw.endsWith("**")) {
      elements.push(<strong key={key}>{parseInline(raw.slice(2, -2))}</strong>);
    } else if (raw.startsWith("__") && raw.endsWith("__")) {
      elements.push(<u key={key}>{parseInline(raw.slice(2, -2))}</u>);
    } else if (raw.startsWith("~~") && raw.endsWith("~~")) {
      elements.push(<del key={key}>{parseInline(raw.slice(2, -2))}</del>);
    } else if (raw.startsWith("*") && raw.endsWith("*")) {
      elements.push(<em key={key}>{parseInline(raw.slice(1, -1))}</em>);
    } else if (raw.startsWith("_") && raw.endsWith("_")) {
      elements.push(<em key={key}>{parseInline(raw.slice(1, -1))}</em>);
    } else if (raw.startsWith("[") && raw.includes("](") && raw.endsWith(")")) {
      const splitIndex = raw.indexOf("](");
      const linkText = raw.substring(1, splitIndex);
      const linkUrl = raw.substring(splitIndex + 2, raw.length - 1);
      elements.push(
        <a
          key={key}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="discord-link"
          onClick={(e) => e.stopPropagation()}
        >
          {linkText}
        </a>
      );
    } else if (raw.startsWith("<#") && raw.endsWith(">")) {
      elements.push(
        <span key={key} className="discord-mention-channel">
          #channel
        </span>
      );
    } else if (raw.startsWith("<@") && raw.endsWith(">")) {
      elements.push(
        <span key={key} className="discord-mention-user">
          @mention
        </span>
      );
    } else {
      elements.push(raw);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < processed.length) {
    elements.push(processed.substring(lastIndex));
  }

  return elements;
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

    // Multiline Codeblock
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

    // Headers (check from 4 to 1)
    const h4Match = line.match(/^####\s+(.*)$/);
    if (h4Match) {
      if (currentList) { blocks.push(currentList); currentList = null; }
      if (currentQuote) { blocks.push(currentQuote); currentQuote = null; }
      blocks.push({ type: "h4", text: h4Match[1] });
      continue;
    }

    const h3Match = line.match(/^###\s+(.*)$/);
    if (h3Match) {
      if (currentList) { blocks.push(currentList); currentList = null; }
      if (currentQuote) { blocks.push(currentQuote); currentQuote = null; }
      blocks.push({ type: "h3", text: h3Match[1] });
      continue;
    }

    const h2Match = line.match(/^##\s+(.*)$/);
    if (h2Match) {
      if (currentList) { blocks.push(currentList); currentList = null; }
      if (currentQuote) { blocks.push(currentQuote); currentQuote = null; }
      blocks.push({ type: "h2", text: h2Match[1] });
      continue;
    }

    const h1Match = line.match(/^#\s+(.*)$/);
    if (h1Match) {
      if (currentList) { blocks.push(currentList); currentList = null; }
      if (currentQuote) { blocks.push(currentQuote); currentQuote = null; }
      blocks.push({ type: "h1", text: h1Match[1] });
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

    // Normal Paragraph
    blocks.push({ type: "p", text: line });
  }

  if (inCodeBlock) {
    blocks.push({ type: "codeblock", lang: codeBlockLang, content: codeBlockContent.join("\n") });
  }
  if (currentList) blocks.push(currentList);
  if (currentQuote) blocks.push(currentQuote);

  return (
    <div className={`discord-markdown-container ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "h1":
            return <h1 key={idx} className="dm-h1">{parseInline(block.text)}</h1>;
          case "h2":
            return <h2 key={idx} className="dm-h2">{parseInline(block.text)}</h2>;
          case "h3":
            return <h3 key={idx} className="dm-h3">{parseInline(block.text)}</h3>;
          case "h4":
            return <h4 key={idx} className="dm-h4">{parseInline(block.text)}</h4>;
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
    </div>
  );
}
