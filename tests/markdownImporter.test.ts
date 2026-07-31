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

describe('TextDocumentImporter & MarkdownImporter 2x2 section sub-table hierarchy', () => {
  it('creates 2x2 section sub-tables for headings with =INC(), title, empty cell and body content', () => {
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
    expect(table.rows.length).toBe(2); // Two top-level section cells

    // Section 1 sub-table (2x2)
    const sec1Table = table.rows[0].cells[0].table;
    expect(sec1Table).toBeDefined();
    expect(sec1Table?.columns).toEqual(['A', 'B']);
    expect(sec1Table?.rows.length).toBe(2);

    // Row 1, Col A (Top-Left): =INC()
    expect(sec1Table?.rows[0].cells[0].text).toBe('=INC()');
    expect(sec1Table?.rows[0].cells[0].className).toBe('formula h1');

    // Row 1, Col B (Top-Right): Title
    expect(sec1Table?.rows[0].cells[1].text).toBe('H1: Section 1');
    expect(sec1Table?.rows[0].cells[1].className).toBe('text h1');

    // Row 2, Col A (Bottom-Left): Empty
    expect(sec1Table?.rows[1].cells[0].text).toBe('');
    expect(sec1Table?.rows[1].cells[0].table).toBeUndefined();

    // Row 2, Col B (Bottom-Right): Body content sub-table
    const sec1Body = sec1Table?.rows[1].cells[1].table;
    expect(sec1Body).toBeDefined();
    expect(sec1Body?.rows.length).toBe(2);
    expect(sec1Body?.rows[0].cells[0].text).toBe('Paragraph A');
    expect(sec1Body?.rows[1].cells[0].text).toBe('Paragraph B');

    // Section 2 sub-table (2x2)
    const sec2Table = table.rows[1].cells[0].table;
    expect(sec2Table).toBeDefined();
    expect(sec2Table?.columns).toEqual(['A', 'B']);
    expect(sec2Table?.rows[0].cells[0].text).toBe('=INC()');
    expect(sec2Table?.rows[0].cells[1].text).toBe('H1: Section 2');
  });

  it('supports recursive 2x2 nesting for child headings of level > N', () => {
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

    // # Title 1 section (2x2)
    const t1Sec = table.rows[0].cells[0].table;
    expect(t1Sec?.columns).toEqual(['A', 'B']);
    expect(t1Sec?.rows[0].cells[0].text).toBe('=INC()');
    expect(t1Sec?.rows[0].cells[0].className).toBe('formula h1');
    expect(t1Sec?.rows[0].cells[1].text).toBe('# Title 1');
    expect(t1Sec?.rows[0].cells[1].className).toBe('text h1');

    const t1Body = t1Sec?.rows[1].cells[1].table;
    expect(t1Body?.rows.length).toBe(2); // Content 1 + ## Subtitle 1.1 section cell
    expect(t1Body?.rows[0].cells[0].text).toBe('Content 1');

    // ## Subtitle 1.1 section (2x2)
    const subSec = t1Body?.rows[1].cells[0].table;
    expect(subSec?.columns).toEqual(['A', 'B']);
    expect(subSec?.rows[0].cells[0].text).toBe('=INC()');
    expect(subSec?.rows[0].cells[0].className).toBe('formula h2');
    expect(subSec?.rows[0].cells[1].text).toBe('## Subtitle 1.1');
    expect(subSec?.rows[0].cells[1].className).toBe('text h2');

    const subBody = subSec?.rows[1].cells[1].table;
    expect(subBody?.rows[0].cells[0].text).toBe('Content 1.1');

    // ### Sub-subtitle 1.1.1 section (2x2)
    const subSubSec = subBody?.rows[1].cells[0].table;
    expect(subSubSec?.columns).toEqual(['A', 'B']);
    expect(subSubSec?.rows[0].cells[0].text).toBe('=INC()');
    expect(subSubSec?.rows[0].cells[0].className).toBe('formula h3');
    expect(subSubSec?.rows[0].cells[1].text).toBe('### Sub-subtitle 1.1.1');
    expect(subSubSec?.rows[0].cells[1].className).toBe('text h3');

    const subSubBody = subSubSec?.rows[1].cells[1].table;
    expect(subSubBody?.rows[0].cells[0].text).toBe('Content 1.1.1');
  });

  it('assigns exact class hN for heading level N (h1..h6) on top-left and top-right cells', () => {
    const md = `
#### Level 4 Heading
##### Level 5 Heading
###### Level 6 Heading
`;
    const table = parseMarkdownToTable(md);

    // Level 4
    const h4Sec = table.rows[0].cells[0].table;
    expect(h4Sec?.rows[0].cells[0].text).toBe('=INC()');
    expect(h4Sec?.rows[0].cells[0].className).toBe('formula h4');
    expect(h4Sec?.rows[0].cells[1].text).toBe('#### Level 4 Heading');
    expect(h4Sec?.rows[0].cells[1].className).toBe('text h4');

    // Level 5
    const h4Body = h4Sec?.rows[1].cells[1].table;
    const h5Sec = h4Body?.rows[0].cells[0].table;
    expect(h5Sec?.rows[0].cells[0].text).toBe('=INC()');
    expect(h5Sec?.rows[0].cells[0].className).toBe('formula h5');
    expect(h5Sec?.rows[0].cells[1].text).toBe('##### Level 5 Heading');
    expect(h5Sec?.rows[0].cells[1].className).toBe('text h5');

    // Level 6
    const h5Body = h5Sec?.rows[1].cells[1].table;
    const h6Sec = h5Body?.rows[0].cells[0].table;
    expect(h6Sec?.rows[0].cells[0].text).toBe('=INC()');
    expect(h6Sec?.rows[0].cells[0].className).toBe('formula h6');
    expect(h6Sec?.rows[0].cells[1].text).toBe('###### Level 6 Heading');
    expect(h6Sec?.rows[0].cells[1].className).toBe('text h6');
  });

  it('parses mixed markdown with GFM tables inside 2x2 sections', () => {
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
    expect(h1Sec?.columns).toEqual(['A', 'B']);
    expect(h1Sec?.rows[0].cells[0].text).toBe('=INC()');
    expect(h1Sec?.rows[0].cells[1].text).toBe('# Header 1');
    expect(h1Sec?.rows[0].cells[1].className).toBe('text h1');

    const body = h1Sec?.rows[1].cells[1].table;
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
