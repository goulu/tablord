import { describe, it, expect } from 'vitest';
import { parseMarkdownToTable, markdownImporter } from '../src/import/markdownImporter';
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

describe('TextDocumentImporter & MarkdownImporter hierarchy', () => {
  it('creates 2-cell section sub-tables for headings with title and body content', () => {
    const dummy = new DummyTextImporter();
    const txt = `
H1: Section 1
Paragraph A
Paragraph B
H1: Section 2
Paragraph C
`;
    const table = dummy.parse(txt);
    expect(table.columns).toEqual(['A']);
    expect(table.rows.length).toBe(2); // Two top-level section cells (Section 1 and Section 2)

    // Section 1 sub-table
    const sec1Table = table.rows[0].cells[0].table;
    expect(sec1Table).toBeDefined();
    expect(sec1Table?.rows.length).toBe(2); // Exactly 2 rows (Title and Content)

    // Cell 1: Title
    expect(sec1Table?.rows[0].cells[0].text).toBe('H1: Section 1');
    expect(sec1Table?.rows[0].cells[0].className).toContain('h1');

    // Cell 2: Body content
    const sec1Body = sec1Table?.rows[1].cells[0].table;
    expect(sec1Body).toBeDefined();
    expect(sec1Body?.rows.length).toBe(2);
    expect(sec1Body?.rows[0].cells[0].text).toBe('Paragraph A');
    expect(sec1Body?.rows[1].cells[0].text).toBe('Paragraph B');

    // Section 2 sub-table
    const sec2Table = table.rows[1].cells[0].table;
    expect(sec2Table).toBeDefined();
    expect(sec2Table?.rows[0].cells[0].text).toBe('H1: Section 2');
  });

  it('supports recursive nesting for child headings of level > N', () => {
    const md = `
# Title 1
Content 1

## Subtitle 1.1
Content 1.1

### Sub-subtitle 1.1.1
Content 1.1.1

# Title 2
Content 2
`;
    const table = parseMarkdownToTable(md);
    expect(table.rows.length).toBe(2); // Title 1 and Title 2

    // # Title 1 section
    const t1Sec = table.rows[0].cells[0].table;
    expect(t1Sec?.rows.length).toBe(2);
    expect(t1Sec?.rows[0].cells[0].text).toBe('# Title 1');
    expect(t1Sec?.rows[0].cells[0].className).toBe('text h1');

    const t1Body = t1Sec?.rows[1].cells[0].table;
    expect(t1Body?.rows.length).toBe(2); // Content 1 + ## Subtitle 1.1 section cell
    expect(t1Body?.rows[0].cells[0].text).toBe('Content 1');

    // ## Subtitle 1.1 section
    const subSec = t1Body?.rows[1].cells[0].table;
    expect(subSec?.rows.length).toBe(2);
    expect(subSec?.rows[0].cells[0].text).toBe('## Subtitle 1.1');
    expect(subSec?.rows[0].cells[0].className).toBe('text h2');

    const subBody = subSec?.rows[1].cells[0].table;
    expect(subBody?.rows[0].cells[0].text).toBe('Content 1.1');

    // ### Sub-subtitle 1.1.1 section
    const subSubSec = subBody?.rows[1].cells[0].table;
    expect(subSubSec?.rows.length).toBe(2);
    expect(subSubSec?.rows[0].cells[0].text).toBe('### Sub-subtitle 1.1.1');
    expect(subSubSec?.rows[0].cells[0].className).toBe('text h3');

    const subSubBody = subSubSec?.rows[1].cells[0].table;
    expect(subSubBody?.rows[0].cells[0].text).toBe('Content 1.1.1');
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
    expect(table.rows.length).toBe(1);

    const h1Sec = table.rows[0].cells[0].table;
    expect(h1Sec?.rows.length).toBe(2);
    expect(h1Sec?.rows[0].cells[0].text).toBe('# Header 1');
    expect(h1Sec?.rows[0].cells[0].className).toBe('text h1');

    const body = h1Sec?.rows[1].cells[0].table;
    expect(body?.rows.length).toBe(3);
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
