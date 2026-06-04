/* Active page highlighting */
(function () {
  const segments = location.pathname.split('/').filter(Boolean);
  let page = segments.length === 0
    ? 'home'
    : segments[0].replace('.html', '') || 'home';

  if (page === 'index') page = 'registry';

  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.dataset.page === page) {
      link.classList.add('active');
    }
  });

  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const expanded =
        toggle.getAttribute('aria-expanded') === 'true';

      toggle.setAttribute('aria-expanded', String(!expanded));
      links.classList.toggle('open', !expanded);
    });

    links.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        toggle.setAttribute('aria-expanded', 'false');
        links.classList.remove('open');
      });
    });
  }
})();
