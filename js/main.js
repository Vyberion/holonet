'use strict';
const RUNES = [
  'ꖐ','ꗢ','ꕤ','ꗑ','ꖴ','ꕪ','ꕀ','ꗿ','ꕥ','ꖌ',
  '᛭','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ','ᚺ','ᚾ',
  '⌖','⌗','⌘','⊕','⊗','⊘','⊙','⊛','⊜','⊝',
  '⟁','⟂','⟃','⟄','⟇','⟈','⟐','⟑','⟒','⟓',
  '☽','☿','♄','♃','♂','♁','♀','☉','☊','☋',
];
const MARQUEE_ITEMS = [
  'PEACE IS A LIE, THERE IS ONLY PASSION',
  '✦',
  'THROUGH PASSION, I GAIN STRENGTH',
  '✦',
  'THROUGH STRENGTH, I GAIN POWER',
  '✦',
  'THROUGH POWER, I GAIN VICTORY',
  '✦',
  'THROUGH VICTORY, MY CHAINS ARE BROKEN',
  '✦',
  'THE FORCE SHALL FREE ME',
  '✦',
];

const DIVISION_ROUTES = {
  '/reavers': {
    node: 'RVR-01',
    shortName: 'Reavers',
    title: 'Reavers Handbooks',
    summary: 'Reaver handbook and guide archive.'
  },
  '/guards': {
    node: 'DHG-02',
    shortName: 'DHG',
    title: 'DHG Handbooks',
    summary: 'Dark Honor Guard handbook and guide archive.'
  },
  '/dark-honor-guards': {
    node: 'DHG-02',
    shortName: 'DHG',
    title: 'DHG Handbooks',
    summary: 'Dark Honor Guard handbook and guide archive.'
  },
  '/inquisitors': {
    node: 'IQ-03',
    shortName: 'Inquisitors',
    title: 'Inquisitor Handbooks',
    summary: 'Inquisitor handbook and guide archive.'
  },
  '/dreads': {
    node: 'DM-04',
    shortName: 'Dread Masters',
    title: 'Dread Master Handbooks',
    summary: 'Dread Master handbook and guide archive.'
  },
  '/dread-masters': {
    node: 'DM-04',
    shortName: 'Dread Masters',
    title: 'Dread Master Handbooks',
    summary: 'Dread Master handbook and guide archive.'
  },
  '/instructors': {
    node: 'HR-05',
    shortName: 'High Ranks',
    title: 'High Rank Handbooks',
    summary: 'High Rank handbook and guide archive.'
  },
  '/highranks': {
    node: 'HR-05',
    shortName: 'High Ranks',
    title: 'High Rank Handbooks',
    summary: 'High Rank handbook and guide archive.'
  },
  '/council': {
    node: 'DC-06',
    shortName: 'Dark Council',
    title: 'Dark Council Handbooks',
    summary: 'Dark Council handbook and guide archive.'
  },
  '/dark-council': {
    node: 'DC-06',
    shortName: 'Dark Council',
    title: 'Dark Council Handbooks',
    summary: 'Dark Council handbook and guide archive.'
  },
};

const DIVISION_SUBDOMAIN_ROUTES = {
  reavers: DIVISION_ROUTES['/reavers'],
  guards: DIVISION_ROUTES['/guards'],
  inquisitors: DIVISION_ROUTES['/inquisitors'],
  dreads: DIVISION_ROUTES['/dreads'],
  instructors: DIVISION_ROUTES['/instructors'],
  council: DIVISION_ROUTES['/council']
};

function buildMarquee() {
  const track = document.querySelector('.marquee-track');
  if (!track || track.children.length > 0) return;
  const full = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  full.forEach((item, i) => {
    const span = document.createElement('span');
    if (item === '✦') {
      span.className = 'sep';
      span.textContent = '✦';
    } else {
      span.textContent = item;
    }
    track.appendChild(span);
  });
}
function updateTimestamp() {
  const el = document.getElementById('timestamp');
  if (!el) return;
  const now = new Date();
  const galYear = 3956 + (now.getFullYear() - 2024);
  const day  = String(now.getDate()).padStart(3, '0');
  const hr   = String(now.getHours()).padStart(2, '0');
  const min  = String(now.getMinutes()).padStart(2, '0');
  const sec  = String(now.getSeconds()).padStart(2, '0');

  el.textContent = `${galYear}.${day} / ${hr}:${min}:${sec} GST`;
}

setInterval(updateTimestamp, 1000);

function updateSignalReadout() {
  const barsEl = document.getElementById('signal-bars');
  const percentEl = document.getElementById('signal-percent');
  if (!barsEl || !percentEl) return;

  const pct = 72 + Math.floor(Math.random() * 19);
  const lit = Math.max(0, Math.min(10, Math.round(pct / 10)));
  
  barsEl.innerHTML =
    '<span style="vertical-align:middle">' + '█'.repeat(lit) + '</span>' +
    '<span style="vertical-align:middle;opacity:0.35">' + '█'.repeat(10 - lit) + '</span>';
  
  percentEl.textContent = `${pct}%`;
}
updateSignalReadout();
setInterval(updateSignalReadout, 1000);

function initCardCorruption() {
  document.querySelectorAll('.nav-card:not([data-corrupt-bound]), .dir-card:not([data-corrupt-bound])').forEach(card => {
    card.setAttribute('data-corrupt-bound', 'true');
    const titleEl = card.querySelector('.card-title, .dir-card-title');
    if (!titleEl) return;

    const originalText = titleEl.textContent;
    const CORRUPT_CHARS = '█▓▒░⟁⊗☿᛭ꖐ⌖✦✧⌘';

    let interval;

    card.addEventListener('mouseenter', () => {
      let frame = 0;
      interval = setInterval(() => {
        if (frame > 6) {
          titleEl.textContent = originalText;
          clearInterval(interval);
          return;
        }

        let corrupted = '';
        for (let i = 0; i < originalText.length; i++) {
          if (originalText[i] === ' ') {
            corrupted += ' ';
          } else if (Math.random() < (0.8 - frame * 0.12)) {
            corrupted += CORRUPT_CHARS[Math.floor(Math.random() * CORRUPT_CHARS.length)];
          } else {
            corrupted += originalText[i];
          }
        }
        titleEl.textContent = corrupted;
        frame++;
      }, 50);
    });

    card.addEventListener('mouseleave', () => {
      clearInterval(interval);
      titleEl.textContent = originalText;
    });
  });
}

function currentDivisionRoute() {
  const hostLabel = window.location.hostname.split('.')[0]?.toLowerCase() || '';
  if (DIVISION_SUBDOMAIN_ROUTES[hostLabel]) return DIVISION_SUBDOMAIN_ROUTES[hostLabel];

  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';

  return Object.entries(DIVISION_ROUTES).find(([route]) => (
    pathname === route || pathname.startsWith(`${route}/`)
  ))?.[1] || null;
}

function isHandbookRoute() {
  return window.location.pathname.replace(/\/+$/, '').endsWith('/handbooks');
}

function injectDivisionLayoutOverrides() {
  if (document.getElementById('division-layout-overrides')) return;

  const style = document.createElement('style');
  style.id = 'division-layout-overrides';
  style.textContent = `
    .hub-shell > .status-bar,
    .division-generated-shell > .status-bar {
      max-width: none;
      margin: -2px 0 6px;
    }

    .hub-shell > .council-floor-card {
      justify-self: stretch;
      max-width: none;
      width: 100%;
    }

    .division-generated-shell {
      display: grid;
      gap: 18px;
      margin: 0 auto;
      max-width: 1100px;
      width: 100%;
    }

    .division-generated-shell .document-shell {
      max-width: 100%;
    }

    body.theme-reavers .pdf-search-mark {
      background: color-mix(in srgb, #ff2e45 28%, transparent);
      outline-color: color-mix(in srgb, #ff2e45 45%, transparent);
      box-shadow: 0 0 10px rgba(255, 46, 69, 0.34);
    }

    body.theme-reavers .pdf-search-mark.is-active {
      background: color-mix(in srgb, #ff2e45 40%, transparent);
      outline-color: #ff2e45;
      box-shadow:
        0 0 8px #ff2e45,
        0 0 22px rgba(255, 46, 69, 0.34);
    }

    body.theme-reavers .document-viewer-page .search-result-snippet mark {
      background: color-mix(in srgb, #ff2e45 16%, transparent);
      border-color: #771521;
      color: #ff2e45;
      text-shadow: 0 0 6px rgba(255, 46, 69, 0.34);
    }
  `;
  document.head.appendChild(style);
}

function ensureDivisionHandbookHero(route) {
  if (!route || !isHandbookRoute()) return false;
  if (document.querySelector('main .hub-hero')) return true;

  const documentShell = document.querySelector('main .document-shell');
  if (!documentShell || documentShell.closest('.division-generated-shell')) return false;

  const shell = document.createElement('section');
  shell.className = 'hub-shell division-generated-shell';
  shell.setAttribute('aria-label', `${route.shortName} handbook archive`);

  const hero = document.createElement('div');
  hero.className = 'hub-hero division-generated-hero';
  hero.innerHTML = `
    <div class="hub-identity">
      <div>
        <span class="hub-kicker">Registry Node / ${route.node}</span>
        <h2 class="hub-title">${route.title}</h2>
      </div>
      <div>
        <span class="hub-kicker">Status</span>
        <span class="hub-value">Secure Viewer</span>
      </div>
    </div>
    <p class="hub-summary">${route.summary}</p>
  `;

  documentShell.parentNode.insertBefore(shell, documentShell);
  shell.appendChild(hero);
  shell.appendChild(documentShell);
  return true;
}

function placeDivisionStatusBar() {
  const route = currentDivisionRoute();
  if (!route) return false;

  ensureDivisionHandbookHero(route);

  const statusBar = document.querySelector('.status-bar');
  const hero = document.querySelector('main .hub-shell > .hub-hero');
  if (!statusBar || !hero) return false;
  if (hero.nextElementSibling === statusBar) return true;

  hero.insertAdjacentElement('afterend', statusBar);
  statusBar.dataset.divisionPlacement = 'title-card';
  return true;
}

function initDivisionLayoutFixes() {
  injectDivisionLayoutOverrides();
  if (placeDivisionStatusBar()) return;
  if (!currentDivisionRoute()) return;

  const target = document.querySelector('main') || document.body;
  if (!target || !window.MutationObserver) return;

  const observer = new MutationObserver(() => {
    if (placeDivisionStatusBar()) observer.disconnect();
  });

  observer.observe(target, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
}

function boot() {
  buildMarquee();
  updateTimestamp();
  initDivisionLayoutFixes();
  setTimeout(initCardCorruption, 500);
}
window.initHolonetMain = function() {
  buildMarquee();
  setTimeout(initCardCorruption, 500);
  initDivisionLayoutFixes();
};
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
