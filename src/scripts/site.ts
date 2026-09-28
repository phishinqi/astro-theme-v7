import { applyLocale, currentLocale, currentUI } from '../i18n/client';
import siteConfig from '../../site.config.json';
const root = document.documentElement;
const themeButton = document.querySelector<HTMLButtonElement>('#theme-toggle');
const scheme = matchMedia('(prefers-color-scheme: dark)');
const applyTheme = (theme: string) => {
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-changing');
    setTimeout(() => root.classList.remove('theme-changing'), 450);
  }
  root.dataset.theme = theme;
  themeButton?.setAttribute('aria-pressed', String(theme === 'dark'));
  window.dispatchEvent(new CustomEvent('v7:theme', { detail: theme }));
};
if (themeButton) {
  themeButton.hidden = false;
  themeButton.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
  themeButton.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('v7-theme', theme);
    } catch {
      /* The current page still switches without storage. */
    }
    applyTheme(theme);
  });
}
scheme.addEventListener('change', (event) => {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem('v7-theme');
  } catch {
    /* Use system preference. */
  }
  if (stored !== 'dark' && stored !== 'light') applyTheme(event.matches ? 'dark' : 'light');
});
window.addEventListener('storage', (event) => {
  if (event.key === 'v7-theme')
    applyTheme(
      event.newValue === 'dark' || event.newValue === 'light'
        ? event.newValue
        : scheme.matches
          ? 'dark'
          : 'light',
    );
});
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const hero = document.querySelector('.hero');
if (hero && !reducedMotion.matches)
  void import('gsap').then(({ gsap }) =>
    gsap.fromTo(
      hero.children,
      { opacity: 0.6, y: 5 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out', clearProps: 'all' },
    ),
  );
const menu = document.querySelector<HTMLDetailsElement>('#mobile-nav');
menu?.addEventListener('toggle', () => {
  if (menu.open && !reducedMotion.matches)
    void import('gsap').then(({ gsap }) => {
      if (menu.open)
        gsap.fromTo(
          menu.querySelector('nav'),
          { opacity: 0.3, y: -4 },
          { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out', clearProps: 'all' },
        );
    });
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu?.open) {
    menu.open = false;
    menu.querySelector('summary')?.focus();
  }
});
document.addEventListener('click', (event) => {
  if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
});

const languageButton = document.querySelector<HTMLButtonElement>('#language-toggle');
if (languageButton) {
  languageButton.hidden = false;
  languageButton.addEventListener('click', () => {
    const locale = currentLocale() === 'en' ? 'zh-CN' : 'en';
    try {
      localStorage.setItem('v7-locale', locale);
    } catch {
      /* Current page still changes. */
    }
    applyLocale(locale);
  });
}
applyLocale(currentLocale());
document.querySelectorAll<HTMLButtonElement>('[data-copy-link]').forEach((button) =>
  button.addEventListener('click', async () => {
    const label = button.querySelector('span');
    if (!label) return;
    try {
      await navigator.clipboard.writeText(button.dataset.copyLink!);
      label.textContent = currentUI().linkCopied;
    } catch {
      label.textContent = currentUI().linkCopyError;
    }
    setTimeout(() => {
      label.textContent = currentUI().copyLink;
    }, 2200);
  }),
);
document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
  if (
    !/^https?:/.test(link.href) ||
    new URL(link.href).origin === location.origin ||
    new URL(link.href).origin === new URL(siteConfig.siteURL).origin
  )
    return;
  if (siteConfig.links.externalNewTab) {
    link.target = '_blank';
    link.rel = Array.from(
      new Set([...link.rel.split(' ').filter(Boolean), 'noopener', 'noreferrer']),
    ).join(' ');
  }
  if (link.closest('.prose,.friends-list')) link.classList.add('external-link');
});
const more = document.querySelector<HTMLDetailsElement>('.more-nav');
document.addEventListener('click', (event) => {
  if (more?.open && !more.contains(event.target as Node)) more.open = false;
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && more?.open) {
    more.open = false;
    more.querySelector('summary')?.focus();
  }
});
const days = document.querySelector<HTMLElement>('[data-started-at]');
if (days)
  days.textContent = String(
    Math.max(0, Math.floor((Date.now() - new Date(days.dataset.startedAt!).getTime()) / 86400000)),
  );
