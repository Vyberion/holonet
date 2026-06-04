(function () {
  'use strict';

  const articles = document.querySelectorAll('.codex-article');
  const searchOverlay = document.getElementById('search-overlay');
  const searchContainer = document.getElementById('search-container');

  let searchInput, searchResults, searchCloseBtn, prevBtn, nextBtn, counterDisplay;
  let currentMatches = [];
  let currentMatchIndex = 0;

  init();

  function init() {
    convertArticlesToCollapsible();
    setupArticleToggle();
    
    // Only initialize search functionality if the core elements exist in the DOM
    if (searchOverlay && searchContainer) {
      buildSearchHTML();
      cacheSearchElements();
      setupSearchHandling();
      setupSearchClose();
    }
  }

  // ─── COLLAPSIBLE ARTICLES ───────────────────────────────────────

  function convertArticlesToCollapsible() {
    articles.forEach((article, index) => {
      article.setAttribute('data-article', index + 1);
      article.setAttribute('data-expanded', 'false');

      const header = article.querySelector('.article-header');
      if (header) {
        header.setAttribute('aria-expanded', 'false');
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        addChevron(header);
      }

      const content = article.querySelector('.article-content');
      if (content) {
        content.classList.add('article-collapsible');
        content.style.maxHeight = '0';
      }
    });
  }

  function addChevron(header) {
    const chev = document.createElement('span');
    chev.className = 'article-chevron';
    chev.setAttribute('aria-hidden', 'true');
    chev.textContent = '▸';
    header.appendChild(chev);
  }

  function setupArticleToggle() {
    articles.forEach(article => {
      const header = article.querySelector('.article-header');
      if (header) {
        header.addEventListener('click', () => toggleArticle(article));
        header.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleArticle(article);
          }
        });
      }
    });
  }

  function toggleArticle(article) {
    const isExpanded = article.getAttribute('data-expanded') === 'true';
    setArticleExpanded(article, !isExpanded);
  }

  function setArticleExpanded(article, expanded) {
    article.setAttribute('data-expanded', String(expanded));

    const header = article.querySelector('.article-header');
    const content = article.querySelector('.article-collapsible');
    const chev = article.querySelector('.article-chevron');

    if (header) header.setAttribute('aria-expanded', String(expanded));

    if (content) {
      content.style.maxHeight = expanded ? content.scrollHeight + 'px' : '0';
    }

    if (chev) {
      chev.style.transform = expanded
        ? 'translateY(-50%) rotate(90deg)'
        : 'translateY(-50%) rotate(0deg)';
    }
  }

  // ─── SEARCH MARKUP GENERATION & CACHING ──────────────────────────

  function buildSearchHTML() {
    const searchScope = getSearchScopeLabel();

    searchContainer.innerHTML = `
      <div class="search-topbar">
        <span class="search-eyebrow">&#x2731;&nbsp; Holonet Search Protocol</span>
        <button class="search-close" aria-label="Close search">ESC &nbsp;/ CLOSE</button>
      </div>
      <div class="search-input-row">
        <span class="search-caret" aria-hidden="true">&#x25B8;</span>
        <input
          type="text"
          id="search-input"
          placeholder="Search ${searchScope}..."
          aria-label="Search ${searchScope}"
          autocomplete="off"
          spellcheck="false"
        />
        <span class="search-counter" id="search-counter-display"></span>
        <div class="search-nav-btns">
          <button class="search-nav-btn" id="search-prev" title="Previous match" aria-label="Previous match">&#x2191;</button>
          <button class="search-nav-btn" id="search-next" title="Next match" aria-label="Next match">&#x2193;</button>
        </div>
      </div>
      <div id="search-results"></div>
      <div class="search-footer">
        <span class="search-hint"><kbd>&#x2191;</kbd><kbd>&#x2193;</kbd>&nbsp;navigate</span>
        <span class="search-hint"><kbd>Enter</kbd>&nbsp;jump to</span>
        <span class="search-hint"><kbd>Esc</kbd>&nbsp;close</span>  
      </div>
    `;
  }

  function getSearchScopeLabel() {
    const title = document.querySelector('.site-title')?.textContent.trim();
    if (!title) return 'records';
    return title.toLowerCase().replace(/^the\s+/, 'the ');
  }

  function cacheSearchElements() {
    searchInput = document.getElementById('search-input');
    searchResults = document.getElementById('search-results');
    searchCloseBtn = searchContainer.querySelector('.search-close');
    prevBtn = document.getElementById('search-prev');
    nextBtn = document.getElementById('search-next');
    counterDisplay = document.getElementById('search-counter-display');
  }

  // ─── SEARCH LOGIC & CONTROLS ─────────────────────────────────────

  function setupSearchHandling() {
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape' && searchOverlay.classList.contains('active')) {
        closeSearch();
      }
    });

    searchInput.addEventListener('input', () => {
      runSearch(searchInput.value.trim());
    });

    searchInput.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        stepMatch(1);
      }
      if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        stepMatch(-1);
      }
      if (e.key === 'Enter') {
        jumpToCurrentMatch();
      }
    });

    prevBtn.addEventListener('click', () => stepMatch(-1));
    nextBtn.addEventListener('click', () => stepMatch(1));
  }

  function openSearch() {
    searchOverlay.classList.add('active');
    searchInput.focus();
    searchInput.select();
    if (searchInput.value.trim()) {
      runSearch(searchInput.value.trim());
    }
  }

  function setupSearchClose() {
    searchCloseBtn.addEventListener('click', closeSearch);
    searchOverlay.addEventListener('click', e => {
      if (e.target === searchOverlay) closeSearch();
    });
  }

  function closeSearch() {
    searchOverlay.classList.remove('active');
    searchResults.innerHTML = '';
    currentMatches = [];
    currentMatchIndex = 0;
    updateCounter();
  }

  function runSearch(query) {
    searchResults.innerHTML = '';
    currentMatches = [];
    currentMatchIndex = 0;

    if (!query || query.length < 2) {
      updateCounter();
      return;
    }

    const q = query.toLowerCase();

    articles.forEach((article, aIdx) => {
      const articleNum = article.querySelector('.article-number')?.textContent.trim() || `Article ${aIdx + 1}`;
      const articleTitle = article.querySelector('.article-title')?.textContent.trim() || '';
      const regulations = article.querySelectorAll('.regulation');

      regulations.forEach(reg => {
        const regTitle = reg.querySelector('.reg-title')?.textContent.trim() || '';
        const regText = reg.querySelector('.reg-text')?.textContent.trim() || '';
        const subClauses = Array.from(reg.querySelectorAll('.sub-clause p'))
          .map(p => p.textContent.trim()).join(' ');
        const fullText = `${regText} ${subClauses}`;

        if (
          fullText.toLowerCase().includes(q) ||
          regTitle.toLowerCase().includes(q) ||
          articleTitle.toLowerCase().includes(q)
        ) {
          const matchObj = { article, articleNum, articleTitle, reg, regTitle, fullText };
          const idx = currentMatches.length;
          currentMatches.push(matchObj);
          searchResults.appendChild(buildResultItem(matchObj, idx, query));
        }
      });
    });

    if (currentMatches.length === 0) {
      searchResults.innerHTML = `<div class="search-no-results">// NO RECORDS FOUND</div>`;
    } else {
      highlightMatch(0);
    }

    updateCounter();
  }

  function buildResultItem(matchObj, index, query) {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.setAttribute('data-match-index', index);

    const meta = document.createElement('div');
    meta.className = 'search-result-meta';
    meta.textContent = `${matchObj.articleNum} › ${matchObj.articleTitle} › ${matchObj.regTitle}`;

    const snippet = document.createElement('div');
    snippet.className = 'search-result-snippet';
    snippet.innerHTML = highlightText(truncate(matchObj.fullText, 120), query);

    item.appendChild(meta);
    item.appendChild(snippet);

    item.addEventListener('click', () => {
      highlightMatch(index);
      jumpToCurrentMatch();
    });

    return item;
  }

  function highlightText(text, query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escaped})`, 'gi');
    return text.replace(re, '<mark>$1</mark>');
  }

  function truncate(text, max) {
    if (text.length <= max) return text;
    return text.slice(0, max) + '…';
  }

  function highlightMatch(index) {
    const items = searchResults.querySelectorAll('.search-result-item');
    items.forEach((el, i) => el.classList.toggle('active', i === index));

    currentMatchIndex = index;
    updateCounter();

    const activeItem = items[index];
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }

  function stepMatch(direction) {
    if (!currentMatches.length) return;
    const next = (currentMatchIndex + direction + currentMatches.length) % currentMatches.length;
    highlightMatch(next);
  }

  function jumpToCurrentMatch() {
    if (!currentMatches.length) return;
    const match = currentMatches[currentMatchIndex];
    if (!match) return;

    setArticleExpanded(match.article, true);
    closeSearch();

    // Phase 1: Apply reg-scrolling immediately so the regulation is highlighted
    // the instant the user presses Enter, before scrolling even begins.
    setTimeout(() => {
      match.reg.classList.remove('reg-flash');
      match.reg.classList.add('reg-scrolling');
      match.reg.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Phase 2: Detect scroll completion via IntersectionObserver, then
      // swap to reg-flash for the 1.5s thermal discharge.
      // Fallback timeout (800ms) handles edge cases where the element is
      // already in view and the observer fires instantly or not at all.
      let settled = false;

      function triggerFlash() {
        if (settled) return;
        settled = true;
        observer.disconnect();
        match.reg.classList.add('reg-flash');
        match.reg.classList.remove('reg-scrolling');
        setTimeout(() => match.reg.classList.remove('reg-flash'), 1500);
      }

      // The observer fires when the regulation reaches ≥60% visibility,
      // meaning the smooth scroll has effectively completed.
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].intersectionRatio >= 0.6) {
          triggerFlash();
        }
      }, { threshold: 0.6 });

      observer.observe(match.reg);

      // Fallback: if scroll takes longer than expected or element is small,
      // fire after 900ms regardless.
      setTimeout(triggerFlash, 900);
    }, 380); // 380ms lets the closeSearch overlay fade clear first
  }

  function updateCounter() {
    if (!counterDisplay) return;
    counterDisplay.textContent = currentMatches.length
      ? `${currentMatchIndex + 1} / ${currentMatches.length}`
      : '';
  }

})();
