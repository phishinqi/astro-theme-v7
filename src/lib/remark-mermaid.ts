import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

// Preserve a real fenced code block for no-JS/failure fallback. HAST metadata
// survives Markdown and MDX compilation; exclude Mermaid from Shiki.
export default function remarkMermaid() {
  return (tree: Root) => {
    visit(tree, 'code', (node) => {
      if (node.lang !== 'mermaid') return;
      node.data = { ...node.data, hProperties: { 'data-mermaid-source': '' } };
    });
  };
}
