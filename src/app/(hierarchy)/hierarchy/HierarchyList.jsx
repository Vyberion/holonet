const MAX_PATH_ROW_CARDS = 4;

function glyphLinesFor(glyph) {
  if (!glyph || glyph.length <= 4) return [glyph];

  const tensMatch = glyph.match(/^(X+)(.*)$/);
  if (tensMatch?.[2]) return [tensMatch[1], tensMatch[2]];

  const splitAt = Math.ceil(glyph.length / 2);
  return [glyph.slice(0, splitAt), glyph.slice(splitAt)];
}

function splitTitledName(name = "") {
  const match = String(name).match(/^(.+?)\s+the\s+(.+)$/i);
  if (!match) return { title: name, subtitle: "" };

  return {
    title: match[1],
    subtitle: `The ${match[2]}`
  };
}

function cardSubtitleFor(item, splitSubtitle) {
  if (splitSubtitle) return splitSubtitle;
  if (item.cardSubtitle) return item.cardSubtitle;
  if (item.category && item.category.toLowerCase() !== item.name.toLowerCase()) return item.category;
  return item.groupTitle || "";
}

export function HierarchyCard({ item }) {
  const glyph = item.cardGlyph;
  const glyphLines = glyphLinesFor(glyph);
  const glyphLength = glyph
    ? Math.min(Math.max(...glyphLines.map(line => line.length)), 7)
    : 0;
  const showCardSubtitle = item.groupId === "emperor-archive";
  const cardText = showCardSubtitle ? splitTitledName(item.name) : { title: item.name, subtitle: "" };
  const cardSubtitle = showCardSubtitle ? cardSubtitleFor(item, cardText.subtitle) : "";
  const cardClassName = `nav-card hierarchy-card${glyph ? " hierarchy-card--glyph" : ""}`;
  const enterLabel = glyph ? "Enter" : "Open";

  return (
    <a className={cardClassName} href={item.href} aria-label={`Open ${item.name}`}>
      <div className="card-inner-border" aria-hidden="true" />
      <div className="card-corners" aria-hidden="true" />
      <div className="card-vline" aria-hidden="true" />
      <div className="card-scan" aria-hidden="true" />
      {glyph ? (
        <div className={`card-bg-glyph hierarchy-card-glyph hierarchy-card-glyph--lines-${glyphLines.length} card-bg-glyph--len-${glyphLength}`} aria-hidden="true">
          {glyphLines.map((line, index) => (
            <span key={`${line}-${index}`}>{line}</span>
          ))}
        </div>
      ) : (
        <img className="hierarchy-card-bg" src={item.image} alt="" loading="lazy" aria-hidden="true" />
      )}
      <div className="hierarchy-card-label">
        {cardSubtitle ? <span className="card-category">{cardSubtitle}</span> : null}
        <h2 className="card-title">{cardText.title}</h2>
      </div>
      <span className="card-enter" aria-hidden="true">{enterLabel} &rsaquo;&rsaquo;</span>
    </a>
  );
}

export function HierarchyGrid({ items }) {
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

function pathWeight(pathItems) {
  return Math.max(1, Math.min(pathItems.length, MAX_PATH_ROW_CARDS));
}

function pathTakesOwnRow(pathItems) {
  return pathItems.some(item => item.pathOwnRow || item.ownPathRow || item.forceOwnPathRow);
}

function buildPathRows(pathEntries) {
  const rows = [];
  let currentRow = [];
  let currentWeight = 0;

  pathEntries.forEach(([path, pathItems]) => {
    const weight = pathWeight(pathItems);
    const ownRow = pathTakesOwnRow(pathItems);
    const entry = { path, pathItems, weight, ownRow };

    if (ownRow) {
      if (currentRow.length) {
        rows.push(currentRow);
        currentRow = [];
        currentWeight = 0;
      }

      rows.push([entry]);
      return;
    }

    if (currentRow.length && currentWeight + weight > MAX_PATH_ROW_CARDS) {
      rows.push(currentRow);
      currentRow = [];
      currentWeight = 0;
    }

    currentRow.push(entry);
    currentWeight += weight;

    if (currentWeight >= MAX_PATH_ROW_CARDS) {
      rows.push(currentRow);
      currentRow = [];
      currentWeight = 0;
    }
  });

  if (currentRow.length) rows.push(currentRow);

  return rows;
}

function chunkPathItems(items) {
  const rows = [];

  for (let index = 0; index < items.length; index += MAX_PATH_ROW_CARDS) {
    rows.push(items.slice(index, index + MAX_PATH_ROW_CARDS));
  }

  return rows;
}

function pathCardRowColumns(items, rowItems) {
  return items.length > MAX_PATH_ROW_CARDS ? MAX_PATH_ROW_CARDS : rowItems.length;
}

function HierarchyPathCardRows({ items }) {
  return (
    <div className="hierarchy-path-card-rows">
      {chunkPathItems(items).map((rowItems, rowIndex) => (
        <div
          className="hierarchy-path-card-row"
          key={rowItems.map(item => item.slug).join("-") || rowIndex}
          style={{ "--path-card-row-columns": pathCardRowColumns(items, rowItems) }}
        >
          {rowItems.map(item => (
            <HierarchyCard item={item} key={`${item.groupId}-${item.slug}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function HierarchyPathGroups({ items }) {
  const directItems = items.filter(item => !item.path);

  const pathGroups = items
    .filter(item => item.path)
    .reduce((groups, item) => {
      if (!groups[item.path]) groups[item.path] = [];
      groups[item.path].push(item);
      return groups;
    }, {});

  const pathRows = buildPathRows(Object.entries(pathGroups));

  return (
    <>
      {directItems.length ? <HierarchyGrid items={directItems} /> : null}

      {pathRows.length ? (
        <div className="hierarchy-path-grid">
          {pathRows.map((row, rowIndex) => {
            const rowWeight = row.reduce((total, entry) => total + entry.weight, 0);

            return (
              <div
                className="hierarchy-path-row"
                key={row.map(entry => entry.path).join("-") || rowIndex}
                style={{ "--path-row-cards": rowWeight }}
              >
                {row.map(({ path, pathItems, weight }) => {
                  const headingId = pathHeadingId(path);

                  return (
                    <section
                      className="hierarchy-path-column"
                      aria-labelledby={headingId}
                      key={path}
                      style={{ "--path-span": weight }}
                    >
                      <h3 id={headingId}>{path}</h3>
                      <HierarchyPathCardRows items={pathItems} />
                    </section>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

export function HierarchySection({ group, items }) {
  return (
    <section className="registry-section hierarchy-section" aria-labelledby={`hierarchy-${group.id}`}>
      <div className="section-header">
        <span className="section-tag" id={`hierarchy-${group.id}`}>// {group.title}</span>
        <div className="section-rule" />
      </div>
      {group.description ? <p className="hierarchy-section-copy">{group.description}</p> : null}
      <HierarchyPathGroups items={items} />
    </section>
  );
}
