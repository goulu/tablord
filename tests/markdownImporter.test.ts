import { describe, it, expect } from 'vitest';
import { parseMarkdownToTable } from '../src/import/markdownImporter';
import { TextDocumentImporter, type HeadingInfo } from '../src/import/textDocumentImporter';
import { getCellType } from '../src/utils/tableUtils';

// Dummy concrete class to test TextDocumentImporter directly
class DummyTextImporter extends TextDocumentImporter {
  id = 'dummy';
  name = 'dummy';
  fileExtensions = ['.txt'];

  parseHeading(line: string): HeadingInfo | null {
    const trimmed = line.trim();
    if (trimmed.startsWith('H1:')) return { level: 1, title: trimmed };
    if (trimmed.startsWith('H2:')) return { level: 2, title: trimmed };
    if (trimmed.startsWith('H3:')) return { level: 3, title: trimmed };
    return null;
  }
}

describe('TextDocumentImporter & MarkdownImporter new structure', () => {
  it('creates a 2-cell row per heading in container table, Col B containing a 2-row sub-table (Title & Content)', () => {
    const dummy = new DummyTextImporter();
    const txt = `
H1: Section 1
Paragraph A
Paragraph B
H1: Section 2
Paragraph C
`;
    const table = dummy.parse(txt);
    expect(table.columns).toEqual(['A', 'B']);
    // 2 level 1 headings = 2 rows in the root container table
    expect(table.rows.length).toBe(2);

    // --- Section 1 (Row 1 of root container table) ---
    // Col A: =INC()
    expect(table.rows[0].cells[0].text).toBe('=INC()');
    expect(table.rows[0].cells[0].className).toBe('formula h1');

    // Col B: 2-row sub-table (Title & Content)
    const sec1SubTable = table.rows[0].cells[1].table;
    expect(sec1SubTable).toBeDefined();
    expect(sec1SubTable?.columns).toEqual(['A']);
    expect(sec1SubTable?.rows.length).toBe(2);

    // Row 1 of sec1SubTable: Title text
    expect(sec1SubTable?.rows[0].cells[0].text).toBe('H1: Section 1');
    expect(sec1SubTable?.rows[0].cells[0].className).toBe('text h1');

    // Row 2 of sec1SubTable: Section content bodyTable
    const sec1Body = sec1SubTable?.rows[1].cells[0].table;
    expect(sec1Body?.rows.length).toBe(2);
    expect(sec1Body?.rows[0].cells[0].text).toBe('Paragraph A');
    expect(sec1Body?.rows[1].cells[0].text).toBe('Paragraph B');

    // --- Section 2 (Row 2 of root container table) ---
    // Col A: =INC()
    expect(table.rows[1].cells[0].text).toBe('=INC()');
    expect(table.rows[1].cells[0].className).toBe('formula h1');

    // Col B: 2-row sub-table (Title & Content)
    const sec2SubTable = table.rows[1].cells[1].table;
    expect(sec2SubTable?.rows[0].cells[0].text).toBe('H1: Section 2');
    expect(sec2SubTable?.rows[0].cells[0].className).toBe('text h1');

    const sec2Body = sec2SubTable?.rows[1].cells[0].table;
    expect(sec2Body?.rows[0].cells[0].text).toBe('Paragraph C');
  });

  it('strips ### hashes from heading titles in MarkdownImporter while using new structure', () => {
    const md = `
# Title Level 1
### Title Level 3
`;
    const table = parseMarkdownToTable(md);
    expect(table.columns).toEqual(['A', 'B']);

    // Title Level 1 (Row 1 Col B sub-table)
    const h1Sub = table.rows[0].cells[1].table;
    expect(h1Sub?.rows[0].cells[0].text).toBe('Title Level 1');
    expect(h1Sub?.rows[0].cells[0].className).toBe('markdown h1');

    // Title Level 3 in h1Body
    const h1Body = h1Sub?.rows[1].cells[0].table;
    const level3Container = h1Body?.rows[0].cells[0].table;
    const h3Row = level3Container?.rows[0];
    expect(h3Row?.cells[0].text).toBe('=INC()');
    expect(h3Row?.cells[0].className).toBe('formula h3');

    const h3Sub = h3Row?.cells[1].table;
    expect(h3Sub?.rows[0].cells[0].text).toBe('Title Level 3');
    expect(h3Sub?.rows[0].cells[0].className).toBe('markdown h3');
  });

  it('parses lists into sub-tables with marker on first item and =INC() on subsequent items', () => {
    const md = `
* First bullet
* Second bullet
* Third bullet

1. First ordered
2. Second ordered
3. Third ordered
`;
    const table = parseMarkdownToTable(md);

    // Bullet list sub-table in row 0
    const bulletListTable = table.rows[0].cells[0].table;
    expect(bulletListTable).toBeDefined();
    expect(bulletListTable?.rows[0].cells[0].text).toBe('*');
    expect(bulletListTable?.rows[0].cells[0].className).toBe('number');
    expect(bulletListTable?.rows[0].cells[1].text).toBe('First bullet');

    expect(bulletListTable?.rows[1].cells[0].text).toBe('=INC()');
    expect(bulletListTable?.rows[1].cells[0].className).toBe('formula');
    expect(bulletListTable?.rows[1].cells[1].text).toBe('Second bullet');

    expect(bulletListTable?.rows[2].cells[0].text).toBe('=INC()');
    expect(bulletListTable?.rows[2].cells[0].className).toBe('formula');
    expect(bulletListTable?.rows[2].cells[1].text).toBe('Third bullet');

    // Ordered list sub-table in row 1
    const orderedListTable = table.rows[1].cells[0].table;
    expect(orderedListTable).toBeDefined();
    expect(orderedListTable?.rows[0].cells[0].text).toBe('1.');
    expect(orderedListTable?.rows[0].cells[0].className).toBe('number');
    expect(orderedListTable?.rows[0].cells[1].text).toBe('First ordered');

    expect(orderedListTable?.rows[1].cells[0].text).toBe('=INC()');
    expect(orderedListTable?.rows[1].cells[0].className).toBe('formula');
    expect(orderedListTable?.rows[1].cells[1].text).toBe('Second ordered');

    expect(orderedListTable?.rows[2].cells[0].text).toBe('=INC()');
    expect(orderedListTable?.rows[2].cells[0].className).toBe('formula');
    expect(orderedListTable?.rows[2].cells[1].text).toBe('Third ordered');
  });

  it('puts non-heading, non-list paragraphs in 1-cell rows without an empty cell on the left', () => {
    const md = `
Some description paragraph.

Another paragraph text.
`;
    const table = parseMarkdownToTable(md);
    expect(table.rows.length).toBe(2);

    expect(table.rows[0].cells.length).toBe(1);
    expect(table.rows[0].cells[0].text).toBe('Some description paragraph.');

    expect(table.rows[1].cells.length).toBe(1);
    expect(table.rows[1].cells[0].text).toBe('Another paragraph text.');
  });

  it('handles empty string gracefully', () => {
    const table = parseMarkdownToTable('');
    expect(table.columns).toEqual(['A']);
    expect(table.rows.length).toBe(1);
    expect(table.rows[0].cells[0].text).toBe('');
  });

  it('keeps markdown format for content lines starting with = instead of auto-converting to formula', () => {
    const md = `
=2 + 3 -> 5
=Expression starting with =
`;
    const table = parseMarkdownToTable(md);
    expect(table.rows.length).toBe(2);
    expect(table.rows[0].cells[0].text).toBe('=2 + 3 -> 5');
    expect(getCellType(table.rows[0].cells[0].className)).toBe('markdown');

    expect(table.rows[1].cells[0].text).toBe('=Expression starting with =');
    expect(getCellType(table.rows[1].cells[0].className)).toBe('markdown');
  });
});
