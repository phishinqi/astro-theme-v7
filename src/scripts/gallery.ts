import { currentUI } from '../i18n/client';
const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-lightbox]'));
if (links.length) {
  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  const close = document.createElement('button');
  close.className = 'lightbox-close';
  close.textContent = '×';
  close.setAttribute('aria-label', currentUI().close);
  const img = document.createElement('img');
  const caption = document.createElement('p');
  const previous = document.createElement('button');
  previous.textContent = '←';
  previous.setAttribute('aria-label', currentUI().previousPage);
  const next = document.createElement('button');
  next.textContent = '→';
  next.setAttribute('aria-label', currentUI().nextPage);
  dialog.append(close, previous, img, next, caption);
  document.body.append(dialog);
  let index = 0;
  let active: HTMLAnchorElement | undefined;
  const show = (i: number) => {
    index = (i + links.length) % links.length;
    const link = links[index]!;
    img.src = link.href;
    img.alt = link.querySelector('img')?.alt || '';
    caption.textContent =
      link.closest('figure')?.querySelector('figcaption')?.textContent || img.alt;
  };
  links.forEach((link, i) =>
    link.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      active = link;
      show(i);
      dialog.showModal();
      document.body.style.overflow = 'hidden';
      close.focus();
    }),
  );
  close.onclick = () => dialog.close();
  previous.onclick = () => show(index - 1);
  next.onclick = () => show(index + 1);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      show(index + 1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      show(index - 1);
    }
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = '';
    active?.focus();
  });
}
