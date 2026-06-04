/* Active page highlighting */
(function () {
  const page = location.pathname === '/'
    ? 'home'
    : location.pathname.split('/').pop().replace('.html', '') || 'home';

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
