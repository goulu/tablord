import { describe, it, expect } from 'vitest';
import { parseMarkdownToTable } from '../src/import/markdownImporter';
import { TextDocumentImporter, type HeadingInfo } from '../src/import/textDocumentImporter';

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

describe('TextDocumentImporter & MarkdownImporter full features', () => {
  it('strips ### hashes from heading titles in MarkdownImporter', () => {
    const md = `
# Title Level 1
### Title Level 3
`;
    const table = parseMarkdownToTable(md);
    expect(table.rows[0].cells[1].text).toBe('Title Level 1');
    expect(table.rows[0].cells[1].className).toBe('text h1');

    const body = table.rows[1].cells[1].table;
    expect(body?.rows[0].cells[1].text).toBe('Title Level 3');
    expect(body?.rows[0].cells[1].className).toBe('text h3');
  });

  it('parses unordered and ordered lists with marker on first item and =INC() on subsequent items', () => {
    const md = `
* First bullet
* Second bullet
* Third bullet

1. First ordered
2. Second ordered
3. Third ordered
`;
    const table = parseMarkdownToTable(md);

    // Bullet list: 3 items (2-cell rows)
    expect(table.rows[0].cells[0].text).toBe('*');
    expect(table.rows[0].cells[1].text).toBe('First bullet');

    expect(table.rows[1].cells[0].text).toBe('=INC()');
    expect(table.rows[1].cells[0].className).toBe('formula');
    expect(table.rows[1].cells[1].text).toBe('Second bullet');

    expect(table.rows[2].cells[0].text).toBe('=INC()');
    expect(table.rows[2].cells[1].text).toBe('Third bullet');

    // Ordered list: 3 items (2-cell rows)
    expect(table.rows[3].cells[0].text).toBe('1.');
    expect(table.rows[3].cells[1].text).toBe('First ordered');

    expect(table.rows[4].cells[0].text).toBe('=INC()');
    expect(table.rows[4].cells[1].text).toBe('Second ordered');

    expect(table.rows[5].cells[0].text).toBe('=INC()');
    expect(table.rows[5].cells[1].text).toBe('Third ordered');
  });

  it('puts non-heading, non-list paragraphs in 1-cell rows without an empty cell on the left', () => {
    const md = `
Some description paragraph.

Another paragraph text.
`;
    const table = parseMarkdownToTable(md);
    expect(table.rows.length).toBe(2);

    // Row 1: 1-cell row containing paragraph
    expect(table.rows[0].cells.length).toBe(1);
    expect(table.rows[0].cells[0].text).toBe('Some description paragraph.');

    // Row 2: 1-cell row containing paragraph
    expect(table.rows[1].cells.length).toBe(1);
    expect(table.rows[1].cells[0].text).toBe('Another paragraph text.');
  });

  it('groups all headings of the same level N in the SAME 2-column table', () => {
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
    expect(table.rows.length).toBe(4);

    // Row 1: Section 1 Title
    expect(table.rows[0].cells[0].text).toBe('=INC()');
    expect(table.rows[0].cells[1].text).toBe('H1: Section 1');

    // Row 2: Section 1 Content
    const sec1Body = table.rows[1].cells[1].table;
    expect(sec1Body?.rows.length).toBe(2);
    expect(sec1Body?.rows[0].cells[0].text).toBe('Paragraph A');
    expect(sec1Body?.rows[1].cells[0].text).toBe('Paragraph B');

    // Row 3: Section 2 Title in SAME root table!
    expect(table.rows[2].cells[0].text).toBe('=INC()');
    expect(table.rows[2].cells[1].text).toBe('H1: Section 2');
  });

  it('parses mixed markdown with GFM tables inside sections', () => {
    const md = `
# Header 1

Some description paragraph.

| Col A | Col B | Col C |
|---|---|---|
| 10 | 20 | 30 |

Final footer text.
`;
    const table = parseMarkdownToTable(md);
    expect(table.columns).toEqual(['A', 'B']);
    expect(table.rows[0].cells[0].text).toBe('=INC()');
    expect(table.rows[0].cells[1].text).toBe('Header 1'); // Stripped #
    expect(table.rows[0].cells[1].className).toBe('text h1');

    const body = table.rows[1].cells[1].table;
    expect(body?.rows[0].cells[0].text).toBe('Some description paragraph.');

    // GFM table sub-sub-table
    const gfmTable = body?.rows[1].cells[0].table;
    expect(gfmTable?.columns).toEqual(['A', 'B', 'C']);
    expect(gfmTable?.rows[0].cells[0].text).toBe('Col A');
    expect(gfmTable?.rows[1].cells[0].text).toBe('10');
    expect(gfmTable?.rows[1].cells[0].className).toBe('number');

    expect(body?.rows[2].cells[0].text).toBe('Final footer text.');
  });

  it('handles empty string gracefully', () => {
    const table = parseMarkdownToTable('');
    expect(table.columns).toEqual(['A']);
    expect(table.rows.length).toBe(1);
    expect(table.rows[0].cells[0].text).toBe('');
  });
});
