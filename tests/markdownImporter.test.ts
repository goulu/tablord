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

describe('TextDocumentImporter & MarkdownImporter level grouping', () => {
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
    // All level 1 sections are rows in the root table (2 rows per section = 4 rows total)
    expect(table.rows.length).toBe(4);

    // Row 1: Section 1 Title
    expect(table.rows[0].cells[0].text).toBe('=INC()');
    expect(table.rows[0].cells[0].className).toBe('formula h1');
    expect(table.rows[0].cells[1].text).toBe('H1: Section 1');
    expect(table.rows[0].cells[1].className).toBe('text h1');

    // Row 2: Section 1 Content
    const sec1Body = table.rows[1].cells[1].table;
    expect(sec1Body).toBeDefined();
    expect(sec1Body?.rows.length).toBe(2);
    expect(sec1Body?.rows[0].cells[1].text).toBe('Paragraph A');
    expect(sec1Body?.rows[1].cells[1].text).toBe('Paragraph B');

    // Row 3: Section 2 Title in SAME root table!
    expect(table.rows[2].cells[0].text).toBe('=INC()');
    expect(table.rows[2].cells[0].className).toBe('formula h1');
    expect(table.rows[2].cells[1].text).toBe('H1: Section 2');

    // Row 4: Section 2 Content
    const sec2Body = table.rows[3].cells[1].table;
    expect(sec2Body).toBeDefined();
    expect(sec2Body?.rows[0].cells[1].text).toBe('Paragraph C');
  });

  it('supports recursive nesting: child headings (> N) create a child sub-table', () => {
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
    expect(table.columns).toEqual(['A', 'B']);
    // Root table holds Title 1 (rows 0, 1) and Title 2 (rows 2, 3)
    expect(table.rows.length).toBe(4);

    // Title 1
    expect(table.rows[0].cells[0].text).toBe('=INC()');
    expect(table.rows[0].cells[1].text).toBe('# Title 1');
    expect(table.rows[0].cells[1].className).toBe('text h1');

    const t1Body = table.rows[1].cells[1].table;
    expect(t1Body?.rows.length).toBe(3); // Content 1 + Subtitle 1.1 (2 rows)
    expect(t1Body?.rows[0].cells[1].text).toBe('Content 1');

    // Subtitle 1.1 (level 2 heading in t1Body)
    expect(t1Body?.rows[1].cells[0].text).toBe('=INC()');
    expect(t1Body?.rows[1].cells[0].className).toBe('formula h2');
    expect(t1Body?.rows[1].cells[1].text).toBe('## Subtitle 1.1');
    expect(t1Body?.rows[1].cells[1].className).toBe('text h2');

    const subBody = t1Body?.rows[2].cells[1].table;
    expect(subBody?.rows[0].cells[1].text).toBe('Content 1.1');

    // Sub-subtitle 1.1.1 (level 3 heading in subBody)
    expect(subBody?.rows[1].cells[0].text).toBe('=INC()');
    expect(subBody?.rows[1].cells[0].className).toBe('formula h3');
    expect(subBody?.rows[1].cells[1].text).toBe('### Sub-subtitle 1.1.1');

    const subSubBody = subBody?.rows[2].cells[1].table;
    expect(subSubBody?.rows[0].cells[1].text).toBe('Content 1.1.1');

    // Title 2 (Row 3 & 4 in root table)
    expect(table.rows[2].cells[0].text).toBe('=INC()');
    expect(table.rows[2].cells[1].text).toBe('# Title 2');
  });

  it('assigns exact class hN for heading level N (h1..h6)', () => {
    const md = `
#### Level 4 Heading
##### Level 5 Heading
###### Level 6 Heading
`;
    const table = parseMarkdownToTable(md);

    // Level 4 in root table
    expect(table.rows[0].cells[0].text).toBe('=INC()');
    expect(table.rows[0].cells[0].className).toBe('formula h4');
    expect(table.rows[0].cells[1].text).toBe('#### Level 4 Heading');
    expect(table.rows[0].cells[1].className).toBe('text h4');

    // Level 5 in h4 body table
    const h4Body = table.rows[1].cells[1].table;
    expect(h4Body?.rows[0].cells[0].text).toBe('=INC()');
    expect(h4Body?.rows[0].cells[0].className).toBe('formula h5');
    expect(h4Body?.rows[0].cells[1].text).toBe('##### Level 5 Heading');
    expect(h4Body?.rows[0].cells[1].className).toBe('text h5');

    // Level 6 in h5 body table
    const h5Body = h4Body?.rows[1].cells[1].table;
    expect(h5Body?.rows[0].cells[0].text).toBe('=INC()');
    expect(h5Body?.rows[0].cells[0].className).toBe('formula h6');
    expect(h5Body?.rows[0].cells[1].text).toBe('###### Level 6 Heading');
    expect(h5Body?.rows[0].cells[1].className).toBe('text h6');
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
    expect(table.rows[0].cells[1].text).toBe('# Header 1');
    expect(table.rows[0].cells[1].className).toBe('text h1');

    const body = table.rows[1].cells[1].table;
    expect(body?.rows.length).toBe(3);
    expect(body?.rows[0].cells[1].text).toBe('Some description paragraph.');

    // GFM table sub-sub-table
    const gfmTable = body?.rows[1].cells[1].table;
    expect(gfmTable?.columns).toEqual(['A', 'B', 'C']);
    expect(gfmTable?.rows[0].cells[0].text).toBe('Col A');
    expect(gfmTable?.rows[1].cells[0].text).toBe('10');
    expect(gfmTable?.rows[1].cells[0].className).toBe('number');

    expect(body?.rows[2].cells[1].text).toBe('Final footer text.');
  });

  it('handles empty string gracefully', () => {
    const table = parseMarkdownToTable('');
    expect(table.columns).toEqual(['A', 'B']);
    expect(table.rows.length).toBe(1);
    expect(table.rows[0].cells[0].text).toBe('');
  });
});
