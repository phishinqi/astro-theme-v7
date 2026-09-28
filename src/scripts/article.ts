import { currentUI } from '../i18n/client';
const ui = new Proxy({} as ReturnType<typeof currentUI>, {
  get: (_target, key) => currentUI()[key as keyof ReturnType<typeof currentUI>],
});

const article = document.querySelector<HTMLElement>('#article-body');
article?.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
  if (pre.querySelector('[data-mermaid-source]')) return;
  const code = pre.querySelector('code');
  if (!code) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'code-block';
  pre.before(wrapper);
  wrapper.append(pre);
  const button = document.createElement('button');
  button.className = 'copy-button';
  button.type = 'button';
  button.textContent = ui.copy;
  button.setAttribute('aria-live', 'polite');
  button.setAttribute('data-pagefind-ignore', 'all');
  wrapper.append(button);
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent || '');
      button.textContent = ui.copied;
    } catch {
      button.textContent = ui.copyError;
    }
    setTimeout(() => {
      button.textContent = ui.copy;
    }, 2200);
  });
});
article?.querySelectorAll<HTMLElement>('h2[id], h3[id]').forEach((heading) => {
  const anchor = document.createElement('a');
  anchor.className = 'heading-anchor';
  anchor.href = `#${heading.id}`;
  anchor.textContent = '#';
  anchor.setAttribute('aria-label', heading.textContent || '#');
  anchor.setAttribute('data-pagefind-ignore', 'all');
  heading.append(anchor);
});

interface Diagram {
  source: string;
  output: HTMLElement;
  fallback: HTMLDetailsElement;
  figure: HTMLElement;
  renderedTheme?: string;
  visible: boolean;
}
const diagrams: Diagram[] = [];
article?.querySelectorAll<HTMLElement>('code[data-mermaid-source]').forEach((code) => {
  const pre = code.closest('pre');
  if (!pre) return;
  const figure = document.createElement('figure');
  figure.className = 'mermaid-figure';
  const output = document.createElement('div');
  output.className = 'mermaid-output';
  output.tabIndex = 0;
  output.setAttribute('role', 'img');
  output.setAttribute('aria-label', ui.diagramLabel);
  output.setAttribute('data-pagefind-ignore', 'all');
  const fallback = document.createElement('details');
  fallback.className = 'mermaid-source';
  fallback.open = true;
  const summary = document.createElement('summary');
  summary.textContent = ui.diagramSource;
  pre.before(figure);
  fallback.append(summary, pre);
  figure.append(output, fallback);
  diagrams.push({ source: code.textContent || '', output, fallback, figure, visible: false });
});
let counter = 0;
let queue = Promise.resolve();
async function renderVisible() {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default';
  const pending = diagrams.filter((diagram) => diagram.visible && diagram.renderedTheme !== theme);
  if (!pending.length) return;
  try {
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme,
      fontFamily: 'sans-serif',
      suppressErrorRendering: true,
    });
    for (const diagram of pending) {
      try {
        const { svg } = await mermaid.render(`v7-diagram-${counter++}`, diagram.source);
        diagram.output.innerHTML = svg; // Mermaid sanitizes SVG in strict security mode.
        const rendered = diagram.output.querySelector('svg');
        if (rendered) {
          rendered.removeAttribute('height');
          rendered.setAttribute('aria-label', ui.diagramLabel);
          const width = rendered.viewBox.baseVal.width;
          if (Number.isFinite(width) && width > 0) {
            // Preserve readable labels; the focusable container scrolls on narrow screens.
            rendered.style.width = `${width}px`;
            rendered.style.maxWidth = 'none';
          }
        }
        diagram.fallback.open = false;
        diagram.renderedTheme = theme;
        diagram.figure.querySelector('.diagram-error')?.remove();
      } catch {
        showError(diagram);
      }
    }
  } catch {
    pending.forEach(showError);
  }
}
function showError(diagram: Diagram) {
  diagram.output.replaceChildren();
  diagram.fallback.open = true;
  if (!diagram.figure.querySelector('.diagram-error')) {
    const message = document.createElement('p');
    message.className = 'diagram-error';
    message.textContent = ui.diagramError;
    diagram.figure.prepend(message);
  }
}
function enqueue() {
  queue = queue.then(renderVisible).catch(() => {
    /* Keep future theme changes retryable. */
  });
}
if (diagrams.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const diagram = diagrams.find((item) => item.figure === entry.target);
          if (diagram) diagram.visible = true;
          observer.unobserve(entry.target);
        }
      }
      enqueue();
    },
    { rootMargin: '200px' },
  );
  diagrams.forEach((diagram) => observer.observe(diagram.figure));
  window.addEventListener('v7:theme', enqueue);
}
