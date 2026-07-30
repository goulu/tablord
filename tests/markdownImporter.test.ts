import { describe, it, expect } from 'vitest';
import { parseMarkdownToTable } from '../src/import/markdownImporter';

describe('markdownImporter', () => {
  it('parses a simple markdown table into a sub-sub-table', () => {
    const md = `
| Action | Key / Input |
|---|---|
| Select a cell | Click |
| Move to next cell | Tab |
`;
    const table = parseMarkdownToTable(md);
    expect(table.columns).toEqual(['A']);
    expect(table.rows.length).toBe(1);
    
    const subSubTable = table.rows[0].cells[0].table;
    expect(subSubTable).toBeDefined();
    expect(subSubTable?.columns).toEqual(['A', 'B']);
    expect(subSubTable?.rows.length).toBe(3); // Header + 2 data rows
    expect(subSubTable?.rows[0].cells[0].text).toBe('Action');
    expect(subSubTable?.rows[0].cells[1].text).toBe('Key / Input');
    expect(subSubTable?.rows[1].cells[0].text).toBe('Select a cell');
    expect(subSubTable?.rows[1].cells[1].text).toBe('Click');
    expect(subSubTable?.rows[2].cells[0].text).toBe('Move to next cell');
    expect(subSubTable?.rows[2].cells[1].text).toBe('Tab');
  });

  it('parses mixed markdown creating text cells and sub-sub-tables for markdown tables', () => {
    const md = `# Header 1

Some description paragraph.

| Col A | Col B | Col C |
|---|---|---|
| 10 | 20 | 30 |

Final footer text.
`;
    const table = parseMarkdownToTable(md);
    expect(table.columns).toEqual(['A']);
    expect(table.rows.length).toBe(4);

    // Row 1: Header
    expect(table.rows[0].cells[0].text).toBe('# Header 1');
    expect(table.rows[0].cells[0].table).toBeUndefined();

    // Row 2: Paragraph
    expect(table.rows[1].cells[0].text).toBe('Some description paragraph.');
    expect(table.rows[1].cells[0].table).toBeUndefined();

    // Row 3: Markdown table as sub-sub-table
    const subSubTable = table.rows[2].cells[0].table;
    expect(subSubTable).toBeDefined();
    expect(subSubTable?.columns).toEqual(['A', 'B', 'C']);
    expect(subSubTable?.rows.length).toBe(2);
    expect(subSubTable?.rows[0].cells[0].text).toBe('Col A');
    expect(subSubTable?.rows[0].cells[1].text).toBe('Col B');
    expect(subSubTable?.rows[0].cells[2].text).toBe('Col C');
    expect(subSubTable?.rows[1].cells[0].text).toBe('10');
    expect(subSubTable?.rows[1].cells[0].className).toBe('number');

    // Row 4: Final footer text
    expect(table.rows[3].cells[0].text).toBe('Final footer text.');
    expect(table.rows[3].cells[0].table).toBeUndefined();
  });

  it('handles empty string gracefully', () => {
    const table = parseMarkdownToTable('');
    expect(table.columns).toEqual(['A']);
    expect(table.rows.length).toBe(1);
    expect(table.rows[0].cells[0].text).toBe('');
  });
});
