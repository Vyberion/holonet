"use client";

import React, { useState, useEffect } from "react";

function readCachedAccess() {
  try {
    const raw = sessionStorage.getItem("holonet:access:global");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedAccess(payload) {
  try {
    sessionStorage.setItem("holonet:access:global", JSON.stringify(payload));
  } catch {
    return null;
  }
}

function checkAccessRules(access) {
  if (!access) return { canViewDarkCouncil: false, canViewAnyDomain: false };

  const rawPerms = access?.permissions;
  const permsList = Array.isArray(rawPerms)
    ? rawPerms
    : (rawPerms && typeof rawPerms === "object"
      ? Object.entries(rawPerms).filter(([, val]) => Boolean(val)).map(([key]) => key)
      : []);
  const perms = new Set(permsList);
  const divisions = access?.profile?.divisions || {};
  const authority = access?.profile?.authorityRoles || {};
  const isAdmin = Boolean(access?.permissions?.canAccessAdmin || perms.has("pages:view:all") || perms.has("admin:access"));

  const canViewDarkCouncil = Boolean(
    isAdmin ||
    perms.has("pages:view:darkcouncil") ||
    (divisions.darkCouncil && divisions.darkCouncil !== "none") ||
    authority.darkCouncil
  );

  const canViewHighRanks = Boolean(
    isAdmin ||
    perms.has("pages:view:highranks") ||
    (access?.profile?.highRank && access?.profile?.highRank !== "none") ||
    authority.highCommand
  );

  const divisionList = ["reavers", "dhg", "inquisitors", "dreadmasters"];
  const canViewAnyDomain = Boolean(
    canViewHighRanks ||
    divisionList.some(id =>
      isAdmin ||
      perms.has(`pages:view:${id}`) ||
      perms.has("pages:view:divisions") ||
      (divisions[id] && divisions[id] !== "none")
    )
  );

  return { canViewDarkCouncil, canViewAnyDomain };
}

export function HomeNavGrid() {
  const [access, setAccess] = useState(readCachedAccess);

  useEffect(() => {
    let cancelled = false;

    function applyPayload(payload) {
      if (cancelled) return;
      if (payload?.authorized) {
        setAccess(payload);
      } else {
        setAccess(null);
      }
    }

    fetch("/api/auth/check-access")
      .then(res => res.json())
      .then(payload => {
        if (payload) writeCachedAccess(payload);
        applyPayload(payload);
      })
      .catch(() => applyPayload(null));

    function handleAccessUpdate(event) {
      if (event?.detail) {
        writeCachedAccess(event.detail);
        applyPayload(event.detail);
      }
    }

    window.addEventListener("holonet:access:update", handleAccessUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("holonet:access:update", handleAccessUpdate);
    };
  }, []);

  const { canViewDarkCouncil, canViewAnyDomain } = checkAccessRules(access);

  const secondRowCards = [];

  if (canViewAnyDomain) {
    secondRowCards.push({
      href: "/disciplines",
      title: "The Disciplines",
      glyph: "IV",
      hex: "0x4D  SECT.04",
      clearance: "CLEARANCE: RESTRICTED",
      designation: "DESIGNATION: LEVEL 2",
      category: "Section 04 — Disciplines",
      desc: "Specialised divisions."
    });
  }

  if (canViewDarkCouncil) {
    secondRowCards.push({
      href: "/council",
      title: "The Council",
      glyph: "V",
      hex: "0x5E  SECT.05",
      clearance: "CLEARANCE: CLASSIFIED",
      designation: "DESIGNATION: LEVEL 3",
      category: "Section 05 — Council",
      desc: "Dark Council."
    });
  }

  const secondRowClass = `second-row-count-${secondRowCards.length}`;

  return (
    <>
      <nav className={`nav-grid nav-grid--home ${secondRowClass}`} aria-label="Holonet Sections">
        {/* Row 1: Always 3 cards (Codex, Archives, Powerbases) */}
        <a href="/codex" className="nav-card top-row-card" aria-label="Enter The Codex">
          <div className="card-inner-border" aria-hidden="true" />
          <div className="card-corners" aria-hidden="true" />
          <div className="card-vline" aria-hidden="true" />
          <div className="card-scan" aria-hidden="true" />
          <div className="card-bg-glyph" aria-hidden="true">I</div>
          <div className="card-hex" aria-hidden="true">0x1A&nbsp;&nbsp;SECT.01</div>
          <div className="card-data" aria-hidden="true">
            CLEARANCE: UNCLASSIFIED<br />
            DESIGNATION: LEVEL 1<br />
          </div>
          <span className="card-category">Section 01 &mdash; Doctrine</span>
          <h2 className="card-title">The Codex</h2>
          <p className="card-desc">Supreme law.</p>
          <span className="card-enter" aria-hidden="true">Enter &rsaquo;&rsaquo;</span>
        </a>

        <a href="/archives" className="nav-card top-row-card" aria-label="Enter The Archives">
          <div className="card-inner-border" aria-hidden="true" />
          <div className="card-corners" aria-hidden="true" />
          <div className="card-vline" aria-hidden="true" />
          <div className="card-scan" aria-hidden="true" />
          <div className="card-bg-glyph" aria-hidden="true">II</div>
          <div className="card-hex" aria-hidden="true">0x2B&nbsp;&nbsp;SECT.02</div>
          <div className="card-data" aria-hidden="true">
            CLEARANCE: UNCLASSIFIED<br />
            DESIGNATION: LEVEL 1<br />
          </div>
          <span className="card-category">Section 02 &mdash; Records</span>
          <h2 className="card-title">The Archives</h2>
          <p className="card-desc">Sith lore.</p>
          <span className="card-enter" aria-hidden="true">Enter &rsaquo;&rsaquo;</span>
        </a>

        <a href="/powerbases" className="nav-card top-row-card" aria-label="Enter The Powerbases">
          <div className="card-inner-border" aria-hidden="true" />
          <div className="card-corners" aria-hidden="true" />
          <div className="card-vline" aria-hidden="true" />
          <div className="card-scan" aria-hidden="true" />
          <div className="card-bg-glyph" aria-hidden="true">III</div>
          <div className="card-hex" aria-hidden="true">0x3C&nbsp;&nbsp;SECT.03</div>
          <div className="card-data" aria-hidden="true">
            CLEARANCE: UNCLASSIFIED<br />
            DESIGNATION: LEVEL 1<br />
          </div>
          <span className="card-category">Section 04 &mdash; Political Factions</span>
          <h2 className="card-title">The Powerbases</h2>
          <p className="card-desc">Political factions.</p>
          <span className="card-enter" aria-hidden="true">Enter &rsaquo;&rsaquo;</span>
        </a>

        {/* Row 2: Only shows if user can access council or any domain */}
        {secondRowCards.map((card) => (
          <a key={card.href} href={card.href} className="nav-card second-row-card" aria-label={`Enter ${card.title}`}>
            <div className="card-inner-border" aria-hidden="true" />
            <div className="card-corners" aria-hidden="true" />
            <div className="card-vline" aria-hidden="true" />
            <div className="card-scan" aria-hidden="true" />
            <div className="card-bg-glyph" aria-hidden="true">{card.glyph}</div>
            <div className="card-hex" aria-hidden="true">{card.hex}</div>
            <div className="card-data" aria-hidden="true">
              {card.clearance}<br />
              {card.designation}<br />
            </div>
            <span className="card-category">{card.category}</span>
            <h2 className="card-title">{card.title}</h2>
            <p className="card-desc">{card.desc}</p>
            <span className="card-enter" aria-hidden="true">Enter &rsaquo;&rsaquo;</span>
          </a>
        ))}
      </nav>

      <style>{`
        .nav-grid--home {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 1.5rem;
          margin: 1.5rem 0 3rem;
        }

        .nav-grid--home > .nav-card {
          height: clamp(380px, 38vh, 540px);
          min-height: 380px;
          display: flex;
          flex-direction: column;
        }

        /* Top row: 3 cards, 2 cols each = full 6-col width */
        .nav-grid--home > .nav-card.top-row-card {
          grid-column: span 2;
        }

        /* Second row: if 2 cards, split 50% each (3 cols each) */
        .nav-grid--home.second-row-count-2 > .nav-card.second-row-card {
          grid-column: span 3;
        }

        /* Second row: if 1 card, full row width (6 cols) */
        .nav-grid--home.second-row-count-1 > .nav-card.second-row-card {
          grid-column: span 6;
        }

        @media (max-width: 860px) {
          .nav-grid--home {
            grid-template-columns: 1fr;
          }

          .nav-grid--home > .nav-card,
          .nav-grid--home > .nav-card.top-row-card,
          .nav-grid--home.second-row-count-2 > .nav-card.second-row-card,
          .nav-grid--home.second-row-count-1 > .nav-card.second-row-card {
            grid-column: auto;
            height: auto;
            min-height: 340px;
          }
        }
      `}</style>
    </>
  );
}
