"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isEmperorArchiveRobloxId } from "../../modules/auth/emperor-archive-access.js";
import { preloadHierarchyImages } from "../lib/preload-images.js";

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

function clearCachedAccess() {
  try {
    sessionStorage.removeItem("holonet:access:global");
  } catch {
    return null;
  }
}

function currentPageKey(pathname = "/") {
  const segments = String(pathname || "/").split("/").filter(Boolean);
  if (segments[0] === "archives" && segments[1]) return `archives-${segments[1]}`;

  const page = segments.length === 0 ? "home" : segments[0].replace(".html", "") || "home";
  return page === "index" ? "home" : page;
}

const DIVISION_ROUTES = {
  reavers: { base: "/reavers", theme: "theme-reavers" },
  "dark-honor-guards": { base: "/dark-honor-guards", theme: "theme-dhg" },
  inquisitors: { base: "/inquisitors", theme: "theme-inquisitors" },
  "dread-masters": { base: "/dread-masters", theme: "theme-dreadmasters" },
  highranks: { base: "/highranks", theme: "theme-highranks" },
  "dark-council": { base: "/dark-council", theme: "theme-dark-council" }
};

function currentDivisionContext(pathname = "/") {
  const segments = String(pathname || "/").split("/").filter(Boolean);
  const route = DIVISION_ROUTES[segments[0]];
  if (!route) return null;

  return {
    ...route,
    section: segments[1] || "home"
  };
}

function canAccessEmperorArchives(access) {
  const profile = access?.profile;
  const roles = profile?.authorityRoles || {};

  return Boolean(
    access?.authorized &&
    (
      profile?.isSuperUser ||
      roles.groupOwner ||
      roles.projectManager ||
      isEmperorArchiveRobloxId(profile?.robloxId)
    )
  );
}

function NavLink({ href, page, prefix, label, account = false, children, activePage, onClick, onPointerEnter, onFocus }) {
  const isActive = activePage === page || (page === "index" && activePage === "home");

  return (
    <a
      href={href}
      className={`nav-link${account ? " account-link" : ""}${isActive ? " active" : ""}`}
      data-page={page}
      onClick={onClick}
      onFocus={onFocus}
      onPointerEnter={onPointerEnter}
    >
      {children || (
        <>
          <div className="nav-link-corners" aria-hidden="true" />
          {prefix ? <span className="nav-link-prefix">{prefix}</span> : null}
          <span className="nav-link-label">{label}</span>
        </>
      )}
    </a>
  );
}

function PrivilegedLinks({ permissions, activePage, onClick }) {
  return (
    <>
      <NavLink href="/lookup" page="lookup" account activePage={activePage} onClick={onClick}>
        <div className="account-text"><span className="nav-link-label">Lookup</span></div>
        <div className="account-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <div className="nav-link-corners" aria-hidden="true" />
      </NavLink>
      {permissions?.canAccessAdmin ? (
        <NavLink href="/admin" page="admin" account activePage={activePage} onClick={onClick}>
          <div className="account-text"><span className="nav-link-label">Admin</span></div>
          <div className="account-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="nav-link-corners" aria-hidden="true" />
        </NavLink>
      ) : null}
    </>
  );
}

export function HolonetNav() {
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [access, setAccess] = useState(null);
  const pathname = usePathname();
  const activePage = currentPageKey(pathname);
  const divisionContext = currentDivisionContext(pathname);
  const showDivisionReturn = divisionContext && !["home", "info"].includes(divisionContext.section);
  const showEmperorArchives = canAccessEmperorArchives(access);
  const centerLinks = [
    { href: "/", page: "home", prefix: "00", label: "Home" },
    { href: "/codex", page: "codex", prefix: "01", label: "Codex" },
    {
      href: "/archives",
      page: "archives",
      prefix: "02",
      label: "Archives",
      ...(showEmperorArchives
        ? { dropdown: [{ href: "/archives/emperors", page: "archives-emperors", label: "Emperors" }] }
        : {})
    },
    { href: "/hierarchy", page: "hierarchy", prefix: "03", label: "Hierarchy", preload: preloadHierarchyImages },
    ...(access?.permissions?.canAccessRegistry
      ? [{ href: "/registry", page: "registry", prefix: "04", label: "Registry" }]
      : [])
  ];

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

    function refreshAccess() {
      fetch("/api/auth/check-access")
        .then(response => response.json())
        .then(payload => {
          if (payload) writeCachedAccess(payload);
          applyPayload(payload);
        })
        .catch(() => applyPayload(null));
    }

    function handleAccessUpdate(event) {
      clearCachedAccess();
      if (event.detail) {
        writeCachedAccess(event.detail);
        applyPayload(event.detail);
        return;
      }

      refreshAccess();
    }

    const cached = readCachedAccess();
    if (cached?.authorized) applyPayload(cached);

    refreshAccess();
    window.addEventListener("holonet:access-updated", handleAccessUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener("holonet:access-updated", handleAccessUpdate);
    };
  }, []);

  const closeNav = () => {
    setOpen(false);
    setOpenDropdown(null);
  };

  const toggleDropdown = page => {
    setOpenDropdown(value => (value === page ? null : page));
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <nav className="site-nav" aria-label="Site navigation">
        <div className="nav-scan" aria-hidden="true" />
        <div className="nav-inner">
          <div className="nav-left">
            {showDivisionReturn ? (
              <NavLink href={`${divisionContext.base}/home`} page="division-return" account activePage="" onClick={closeNav}>
                <div className="account-text"><span className="nav-link-label">Return</span></div>
                <div className="account-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 19-7-7 7-7" />
                    <path d="M19 12H5" />
                  </svg>
                </div>
                <div className="nav-link-corners" aria-hidden="true" />
              </NavLink>
            ) : null}
          </div>

          <button
            className="nav-toggle"
            aria-controls="nav-links"
            aria-expanded={open}
            aria-label="Toggle navigation"
            onClick={() => setOpen(value => !value)}
          >
            <span />
            <span />
            <span />
          </button>

          <div className="nav-center">
            <ul className={`nav-links${open ? " open" : ""}`} id="nav-links" role="list">
              {centerLinks.map((link, index) => {
                const dropdownOpen = openDropdown === link.page;

                return (
                <React.Fragment key={link.page}>
                  {index ? <li className="nav-sep" aria-hidden="true" /> : null}
                  <li className={`nav-item${link.dropdown ? " nav-item--dropdown" : ""}${dropdownOpen ? " dropdown-open" : ""}`}>
                    {link.dropdown ? (
                      <>
                        <div className="nav-split">
                          <NavLink
                            {...link}
                            activePage={activePage}
                            onClick={closeNav}
                            onFocus={link.preload}
                            onPointerEnter={link.preload}
                          />
                          <button
                            type="button"
                            className="nav-dropdown-toggle"
                            aria-controls={`nav-dropdown-${link.page}`}
                            aria-expanded={dropdownOpen}
                            aria-label={`${link.label} sections`}
                            onClick={() => toggleDropdown(link.page)}
                            onFocus={link.preload}
                            onPointerEnter={link.preload}
                          >
                            <span className="nav-dropdown-caret" aria-hidden="true" />
                          </button>
                        </div>
                        <ul className="nav-dropdown-menu" id={`nav-dropdown-${link.page}`} role="list">
                          {link.dropdown.map(child => (
                            <li key={child.href}>
                              <a
                                className={`nav-dropdown-link${activePage === child.page ? " active" : ""}`}
                                href={child.href}
                                onClick={closeNav}
                              >
                                <div className="nav-link-corners" aria-hidden="true" />
                                <span className="nav-link-label">{child.label}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <NavLink
                        {...link}
                        activePage={activePage}
                        onClick={closeNav}
                        onFocus={link.preload}
                        onPointerEnter={link.preload}
                      />
                    )}
                  </li>
                </React.Fragment>
                );
              })}
            </ul>
          </div>

          <div className="nav-right">
            <div className="nav-privileged" data-nav-privileged>
              <PrivilegedLinks permissions={access?.permissions} activePage={activePage} onClick={closeNav} />
            </div>
            <NavLink href="/account" page="account" account activePage={activePage} onClick={closeNav}>
              <div className="account-text">
                <span className="nav-link-label">Account</span>
              </div>
              <div className="account-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="nav-link-corners" aria-hidden="true" />
            </NavLink>
          </div>
        </div>
      </nav>

      <button type="button" className="back-to-top-btn" aria-label="Back to top" onClick={scrollToTop}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
    </>
  );
}
