/* ═══════════════════════════════════════════════
   SITH HOLONET — main.js
   Ambient effects, rune particles, glitch bursts,
   cursor tracking, and boot sequence
═══════════════════════════════════════════════ */

'use strict';

// ─── Sith rune-like symbols (mix of Aurebesh-inspired + decorative) ───
const RUNES = [
  'ꖐ','ꗢ','ꕤ','ꗑ','ꖴ','ꕪ','ꕀ','ꗿ','ꕥ','ꖌ',
  '᛭','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ','ᚺ','ᚾ',
  '⌖','⌗','⌘','⊕','⊗','⊘','⊙','⊛','⊜','⊝',
  '⟁','⟂','⟃','⟄','⟇','⟈','⟐','⟑','⟒','⟓',
  '☽','☿','♄','♃','♂','♁','♀','☉','☊','☋',
];

// ─── Marquee content ───
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


// ─── Marquee ─────────────────────────────────────
function buildMarquee() {
  const track = document.querySelector('.marquee-track');
  if (!track) return;

  // Double the items for seamless loop
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


// ─── Live Clock / Timestamp ──────────────────────
function updateTimestamp() {
  const el = document.getElementById('timestamp');
  if (!el) return;

  // Fictional Sith timestamp format
  const now = new Date();
  const galYear = 3956 + (now.getFullYear() - 2024); // set in ~Old Republic era
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
  barsEl.textContent = '█'.repeat(lit) + '░'.repeat(10 - lit);
  percentEl.textContent = `${pct}%`; 
}
updateSignalReadout();
setInterval(updateSignalReadout, 1000);

// ─── Card hover: random corrupt text effect ──────
function initCardCorruption() {
  document.querySelectorAll('.nav-card').forEach(card => {
    const titleEl = card.querySelector('.card-title');
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


// ─── BOOT SEQUENCE ───────────────────────────────
function boot() {
  // Build marquee immediately
  buildMarquee();


  // Timestamp
  updateTimestamp();

  // Card corruption effect for nav cards
  setTimeout(initCardCorruption, 500);
}

// ─── Entry point ─────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
