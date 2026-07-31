import { describe, it, expect } from 'vitest';
import { 
  renderTextHtml, renderNumberHtml, renderFormulaHtml, 
  renderMarkdownToHtml, renderCellHtml 
} from '../src/utils/htmlRenderer';
import { parseMarkdownToTable } from '../src/import/markdownImporter';
import { parseHtmlToTable } from '../src/utils/htmlUtils';
import { getCellType } from '../src/utils/tableUtils';

describe('htmlRenderer format rendering functions', () => {
  it('renderTextHtml escapes raw HTML and returns plain text', () => {
    expect(renderTextHtml('hello <world> & "friends"')).toBe('hello &lt;world&gt; &amp; &quot;friends&quot;');
  });

  it('renderNumberHtml escapes number strings', () => {
    expect(renderNumberHtml('123.45')).toBe('123.45');
  });

  it('renderFormulaHtml returns evaluated value or text', () => {
    expect(renderFormulaHtml({ text: '=INC()', value: '12' })).toBe('12');
    expect(renderFormulaHtml({ text: '=2+3', value: '5' })).toBe('5');
    expect(renderFormulaHtml({ text: '=UNKNOWN()' })).toBe('=UNKNOWN()');
  });

  it('renderMarkdownToHtml formats bold, italic, code, links, strikethrough, blockquotes per Daring Fireball syntax', () => {
    expect(renderMarkdownToHtml('**bold text**')).toBe('<strong>bold text</strong>');
    expect(renderMarkdownToHtml('*italic text*')).toBe('<em>italic text</em>');
    expect(renderMarkdownToHtml('`const x = 10;`')).toBe('<code>const x = 10;</code>');
    expect(renderMarkdownToHtml('[Tablord](https://example.com)')).toBe('<a href="https://example.com" target="_blank" rel="noopener noreferrer">Tablord</a>');
    expect(renderMarkdownToHtml('🌐 **[Try it online → https://goulu.github.io/tablord/](https://goulu.github.io/tablord/)**')).toBe('🌐 <strong><a href="https://goulu.github.io/tablord/" target="_blank" rel="noopener noreferrer">Try it online → https://goulu.github.io/tablord/</a></strong>');
    expect(renderMarkdownToHtml('~~deleted~~')).toBe('<del>deleted</del>');
    expect(renderMarkdownToHtml('---')).toBe('<hr/>');
    expect(renderMarkdownToHtml('***')).toBe('<hr/>');
    expect(renderMarkdownToHtml('* * *')).toBe('<hr/>');
    expect(renderMarkdownToHtml('- - -')).toBe('<hr/>');
    expect(renderMarkdownToHtml('---------------------------------------')).toBe('<hr/>');
    expect(renderMarkdownToHtml('_ _ _')).toBe('<hr/>');
    expect(renderMarkdownToHtml('> quote line')).toBe('<blockquote>quote line</blockquote>');
    expect(renderMarkdownToHtml('line 1\nline 2')).toBe('line 1<br/>line 2');
  });

  it('renderCellHtml dispatches to the correct format renderer based on cell type', () => {
    expect(renderCellHtml({ className: 'text', text: 'plain & simple' })).toBe('plain &amp; simple');
    expect(renderCellHtml({ className: 'number', text: '42' })).toBe('42');
    expect(renderCellHtml({ className: 'formula', text: '=2+3', value: '5' })).toBe('5');
    expect(renderCellHtml({ className: 'markdown h1', text: 'Welcome to **Tablord**' })).toBe('Welcome to <strong>Tablord</strong>');
  });
});

describe('Markdown Importer format assignment', () => {
  it('assigns markdown format to content cells and formula/number/text format to numbering cells', () => {
    const md = `# Tablord
> Spreadsheet editor with sub-tables.

## Features
* **Nested tables**
* Formulas
`;

    const table = parseMarkdownToTable(md);

    // Root section row Col A: formula (=INC())
    const rootRow0 = table.rows[0];
    expect(rootRow0.cells[0].text).toBe('=INC()');
    expect(getCellType(rootRow0.cells[0].className)).toBe('formula');

    // Title cell inside heading sub-table: markdown
    const headingSubTable = rootRow0.cells[1].table!;
    const titleCell = headingSubTable.rows[0].cells[0];
    expect(titleCell.text).toBe('Tablord');
    expect(getCellType(titleCell.className)).toBe('markdown');

    // Preamble quote cell: markdown
    const bodyTable = headingSubTable.rows[1].cells[0].table!;
    const quoteCell = bodyTable.rows[0].cells[0];
    expect(quoteCell.text).toBe('> Spreadsheet editor with sub-tables.');
    expect(getCellType(quoteCell.className)).toBe('markdown');
  });

  it('preserves raw markdown text and className across HTML save and reload (page refresh simulation)', () => {
    const html = `<div class="document"><table><tbody><tr><td class="markdown h1" data-cell-id="cell1" data-text="Welcome to **Tablord**">Welcome to <strong>Tablord</strong></td></tr></tbody></table></div>`;
    const loaded = parseHtmlToTable(html);
    expect(loaded).not.toBeNull();
    expect(loaded!.rows[0].cells[0].text).toBe('Welcome to **Tablord**');
    expect(getCellType(loaded!.rows[0].cells[0].className)).toBe('markdown');
  });
});
