import { getCellType } from './tableUtils';

/**
 * Escapes special HTML characters to prevent XSS / unwanted HTML injection.
 */
export const escapeHtml = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Render format for 'text' cells: returns escaped raw text.
 */
export const renderTextHtml = (text: string): string => {
  return escapeHtml(text);
};

/**
 * Render format for 'number' cells: returns escaped number text.
 */
export const renderNumberHtml = (text: string): string => {
  return escapeHtml(text);
};

/**
 * Render format for 'formula' cells: returns evaluated value or formula string.
 */
export const renderFormulaHtml = (cell: { text: string; value?: string }): string => {
  const val = cell.value ?? cell.text;
  return escapeHtml(val);
};

/**
 * Render format for 'markdown' cells using Daring Fireball Markdown syntax rules:
 * - Bold: **text** or __text__ -> <strong>text</strong>
 * - Italics: *text* or _text_ -> <em>text</em>
 * - Inline code: `code` -> <code>code</code>
 * - Links: [label](url) -> <a href="url" target="_blank" rel="noopener noreferrer">label</a>
 * - Strikethrough: ~~text~~ -> <del>text</del>
 * - Blockquotes: > line -> <blockquote>line</blockquote>
 * - Line breaks: \n -> <br/>
 */
export const renderMarkdownToHtml = (markdownText: string): string => {
  if (!markdownText) return '';

  // Escape raw HTML first
  let html = escapeHtml(markdownText);

  // Links: [label](url) -> <a href="url" target="_blank" rel="noopener noreferrer">label</a>
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Inline code: `code` -> <code>code</code>
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold + Italic: ***text*** or ___text___ -> <strong><em>text</em></strong>
  html = html.replace(/(\*\*\*|___)(.*?)\1/g, '<strong><em>$2</em></strong>');

  // Bold: **text** or __text__ -> <strong>text</strong>
  html = html.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');

  // Italic: *text* or _text_ -> <em>text</em>
  html = html.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');

  // Strikethrough: ~~text~~ -> <del>text</del>
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

  // Auto-link bare URLs (not inside an existing <a> tag)
  html = html.replace(/(^|[^">])(https?:\/\/[^\s<)]+)/g, (match, prefix, url, offset, string) => {
    const before = string.slice(0, offset);
    const lastOpenA = before.lastIndexOf('<a ');
    const lastCloseA = before.lastIndexOf('</a>');
    if (lastOpenA > lastCloseA) {
      return match;
    }
    return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  // Blockquotes: > line
  html = html.replace(/^&gt;\s+(.*)$/gm, '<blockquote>$1</blockquote>');

  // Line breaks
  html = html.replace(/\r?\n/g, '<br/>');

  return html;
};

/**
 * Main dispatcher: transforms cell content into rendered HTML based on cell type.
 */
export const renderCellHtml = (cell: { className?: string; text: string; value?: string }): string => {
  const type = getCellType(cell.className);
  switch (type) {
    case 'markdown':
      return renderMarkdownToHtml(cell.text);
    case 'formula':
      return renderFormulaHtml(cell);
    case 'number':
      return renderNumberHtml(cell.text);
    case 'text':
    default:
      return renderTextHtml(cell.text);
  }
};
