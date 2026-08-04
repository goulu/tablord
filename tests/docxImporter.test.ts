import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { docxImporter, DocxImporter } from '../src/import/docxImporter';
import { TextDocumentImporter } from '../src/import/textDocumentImporter';

describe('DocxImporter', () => {
  it('instantiates DocxImporter as a direct subclass of TextDocumentImporter', () => {
    expect(docxImporter).toBeInstanceOf(TextDocumentImporter);
    expect(docxImporter).toBeInstanceOf(DocxImporter);
    expect(docxImporter.id).toBe('docx');
    expect(docxImporter.fileExtensions).toEqual(['.docx']);
    expect(docxImporter.isBinary).toBe(true);
  });

  it('parses tests/docx/sample-files.com-basic-text.docx into a hierarchical Tablord Table', async () => {
    const filePath = path.resolve(__dirname, 'docx/sample-files.com-basic-text.docx');
    const buffer = fs.readFileSync(filePath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    const table = await docxImporter.parse(arrayBuffer);

    expect(table).toBeDefined();
    expect(table.columns).toEqual(['A', 'B']);
    expect(table.rows.length).toBeGreaterThan(0);

    // Row 1 of root container table represents Level 1 heading ("Sample Document")
    const h1Row = table.rows[0];
    expect(h1Row.cells[0].text).toBe('=INC()');
    expect(h1Row.cells[0].className).toBe('formula h1');

    const h1SubTable = h1Row.cells[1].table;
    expect(h1SubTable).toBeDefined();

    // H1 title cell
    const h1TitleCell = h1SubTable?.rows[0].cells[0];
    expect(h1TitleCell?.text).toBe('Sample Document');
    expect(h1TitleCell?.className).toBe('markdown h1');

    // H1 body table
    const h1BodyTable = h1SubTable?.rows[1].cells[0].table;
    expect(h1BodyTable).toBeDefined();

    // Contains paragraph description
    const firstBodyText = h1BodyTable?.rows[0].cells[0].text;
    expect(firstBodyText).toContain('This is a simple one-page document');

    // Contains Level 2 sub-table ("Basic Text Formatting" & "Different Sizes and Alignment")
    const level2ContainerRow = h1BodyTable?.rows[1];
    const level2Table = level2ContainerRow?.cells[0].table;
    expect(level2Table).toBeDefined();
    expect(level2Table?.rows.length).toBe(2); // 2 Level 2 sections

    // Section 2.1: Basic Text Formatting
    const sec2_1_SubTable = level2Table?.rows[0].cells[1].table;
    expect(sec2_1_SubTable?.rows[0].cells[0].text).toBe('Basic Text Formatting');

    // Section 2.2: Different Sizes and Alignment
    const sec2_2_SubTable = level2Table?.rows[1].cells[1].table;
    expect(sec2_2_SubTable?.rows[0].cells[0].text).toBe('Different Sizes and Alignment');
  });
});
