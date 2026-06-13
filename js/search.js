(function () {
  'use strict';

  let teardown = null;

  function init() {
    teardown?.();

    const articles = document.querySelectorAll('.codex-article');
    const searchOverlay = document.getElementById('search-overlay');
    const searchContainer = document.getElementById('search-container');
    let searchInput, searchResults, searchCloseBtn, prevBtn, nextBtn, counterDisplay;
    let currentMatches = [];
    let currentMatchIndex = 0;
    const disposers = [];

    function on(target, event, handler) {
      target.addEventListener(event, handler);
      disposers.push(() => target.removeEventListener(event, handler));
    }

    convertArticlesToCollapsible();
    setupArticleToggle();

    if (searchOverlay && searchContainer) {
      buildSearchHTML();
      cacheSearchElements();
      setupSearchHandling();
      setupSearchClose();
    }

    teardown = () => {
      disposers.forEach(dispose => dispose());
      teardown = null;
    };

    function convertArticlesToCollapsible() {
      articles.forEach((article, index) => {
        article.setAttribute('data-article', index + 1);
        article.setAttribute('data-expanded', 'true');

        const header = article.querySelector('.article-header');
        if (header) {
          header.setAttribute('aria-expanded', 'true');
          header.setAttribute('role', 'button');
          header.setAttribute('tabindex', '0');
          if (!header.querySelector('.article-chevron')) addChevron(header);
        }

        const content = article.querySelector('.article-content');
        if (content) {
          content.classList.add('article-collapsible');
          content.style.maxHeight = `${content.scrollHeight}px`;
          content.querySelectorAll('img').forEach(image => {
            if (image.complete) return;
            on(image, 'load', () => {
              if (article.getAttribute('data-expanded') === 'true') {
                content.style.maxHeight = `${content.scrollHeight}px`;
              }
            });
          });
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
          on(header, 'click', e => {
            if (e.target.closest('button, a, input, textarea, select, label')) return;
            toggleArticle(article);
          });
          on(header, 'keydown', e => {
            if (e.target.closest('button, a, input, textarea, select, label')) return;
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
      if (content) content.style.maxHeight = expanded ? content.scrollHeight + 'px' : '0';
      if (chev) {
        chev.style.transform = expanded
          ? 'translateY(-50%) rotate(90deg)'
          : 'translateY(-50%) rotate(0deg)';
      }
    }

    function buildSearchHTML() {
      const searchScope = getSearchScopeLabel();

      searchContainer.innerHTML = `
        <div class="search-topbar">
          <span class="search-eyebrow">&#x2731;&nbsp; HOLONET SEARCH</span>
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

    function setupSearchHandling() {
      on(document, 'keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          e.preventDefault();
          openSearch();
        }
        if (e.key === 'Escape' && searchOverlay.classList.contains('active')) {
          closeSearch();
        }
      });

      on(searchInput, 'input', () => runSearch(searchInput.value.trim()));
      on(searchInput, 'keydown', e => {
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

      on(prevBtn, 'click', () => stepMatch(-1));
      on(nextBtn, 'click', () => stepMatch(1));
    }

    function openSearch() {
      searchOverlay.classList.add('active');
      searchInput.focus();
      searchInput.select();
      if (searchInput.value.trim()) runSearch(searchInput.value.trim());
    }

    function setupSearchClose() {
      on(searchCloseBtn, 'click', closeSearch);
      on(searchOverlay, 'click', e => {
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
          const subClauses = Array.from(reg.querySelectorAll('.sub-clause p')).map(p => p.textContent.trim()).join(' ');
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
      snippet.textContent = buildSnippet(matchObj.fullText, query);

      item.appendChild(meta);
      item.appendChild(snippet);
      on(item, 'click', () => {
        currentMatchIndex = index;
        jumpToCurrentMatch();
      });

      return item;
    }

    function buildSnippet(text, query) {
      const lower = text.toLowerCase();
      const idx = lower.indexOf(query.toLowerCase());
      if (idx === -1) return text.slice(0, 160);
      const start = Math.max(0, idx - 70);
      const end = Math.min(text.length, idx + query.length + 70);
      return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
    }

    function highlightMatch(index) {
      currentMatchIndex = ((index % currentMatches.length) + currentMatches.length) % currentMatches.length;
      document.querySelectorAll('.search-result-item').forEach((item, itemIndex) => {
        item.classList.toggle('active', itemIndex === currentMatchIndex);
      });
      updateCounter();
    }

    function stepMatch(direction) {
      if (!currentMatches.length) return;
      highlightMatch(currentMatchIndex + direction);
      document.querySelector(`.search-result-item[data-match-index="${currentMatchIndex}"]`)?.scrollIntoView({ block: 'nearest' });
    }

    function jumpToCurrentMatch() {
      const current = currentMatches[currentMatchIndex];
      if (!current) return;

      setArticleExpanded(current.article, true);
      current.reg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      current.reg.classList.add('reg-flash');
      setTimeout(() => current.reg.classList.remove('reg-flash'), 1200);
      closeSearch();
    }

    function updateCounter() {
      if (!counterDisplay) return;
      counterDisplay.textContent = currentMatches.length ? `${currentMatchIndex + 1}/${currentMatches.length}` : '';
    }
  }

  window.initHolonetSearch = init;
  init();
})();
