import type { Table, Row, Cell } from '../types/document';
import { generateId } from '../types/document';
import { TextDocumentImporter, type HeadingInfo, type ListItemInfo } from './textDocumentImporter';

const convertNumberToCol = (num: number): string => {
  let colName = '';
  while (num > 0) {
    const modulo = (num - 1) % 26;
    colName = String.fromCharCode(65 + modulo) + colName;
    num = Math.floor((num - modulo) / 26);
  }
  return colName;
};

// Check if a line is a markdown table separator line like "|---|---|", "|:---|---:|", etc.
const isTableSeparator = (line: string): boolean => {
  const trimmed = line.trim();
  return /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(trimmed);
};

// Check if a line looks like a markdown table row (contains '|' separators)
const isTableRow = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  return trimmed.startsWith('|') || trimmed.endsWith('|') || (trimmed.match(/\|/g) || []).length >= 2;
};

// Split a markdown table row by '|', trimming edges and whitespace
const parseTableRow = (line: string): string[] => {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map(cell => cell.trim());
};

// Helper: Parse a block of GFM table lines into a sub-sub-table
const parseGfmTable = (lines: string[]): Table => {
  const rawRows: string[][] = [];
  for (const line of lines) {
    if (isTableSeparator(line)) continue;
    if (isTableRow(line)) {
      const cells = parseTableRow(line);
      if (cells.length > 0) {
        rawRows.push(cells);
      }
    }
  }

  let maxCols = 1;
  for (const rowCells of rawRows) {
    if (rowCells.length > maxCols) maxCols = rowCells.length;
  }

  const columns: string[] = [];
  for (let c = 1; c <= maxCols; c++) {
    columns.push(convertNumberToCol(c));
  }

  const rows: Row[] = rawRows.map((rowCells) => {
    const cells: Cell[] = [];
    for (let colIdx = 0; colIdx < maxCols; colIdx++) {
      const text = rowCells[colIdx] ?? '';
      let className = 'markdown';
      if (text !== '' && !isNaN(Number(text))) {
        className = 'number';
      }
      cells.push({
        id: generateId(),
        text,
        className,
      });
    }
    return {
      id: generateId(),
      cells,
    };
  });

  if (rows.length === 0) {
    rows.push({
      id: generateId(),
      cells: [{ id: generateId(), text: '', className: 'markdown' }],
    });
  }

  return {
    id: generateId(),
    columns,
    rows,
  };
};

export class MarkdownImporter extends TextDocumentImporter {
  id = 'markdown';
  name = 'markdown (.md)';
  fileExtensions = ['.md', '.markdown'];

  override defaultContentFormat: 'text' | 'markdown' = 'markdown';

  /**
   * Parses markdown headings like "# Title", "## Title", "### Title", etc.
   * Strips leading '#' hashes from the title text!
   */
  parseHeading(line: string): HeadingInfo | null {
    const trimmed = line.trim();
    const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      return {
        level: match[1].length,
        title: match[2].trim(), // Stripped ### hashes from title text
      };
    }
    return null;
  }

  /**
   * Parses Markdown list items per Daring Fireball syntax:
   * - Unordered: *, +, -
   * - Ordered: 1., 2., 1), 2)
   */
  override parseListItem(line: string): ListItemInfo | null {
    const trimmed = line.trim();

    // Unordered lists (*, +, -)
    const bulletMatch = trimmed.match(/^(\*|\+|-)\s+(.*)$/);
    if (bulletMatch) {
      return {
        marker: bulletMatch[1],
        text: bulletMatch[2].trim(),
      };
    }

    // Ordered lists (1., 2., 1), 2))
    const orderedMatch = trimmed.match(/^(\d+[\.\)])\s+(.*)$/);
    if (orderedMatch) {
      return {
        marker: orderedMatch[1],
        text: orderedMatch[2].trim(),
      };
    }

    return null;
  }

  protected override parseSingleContentItem(lines: string[], i: number, endIndex: number): { nextIndex: number; row: Row | null } {
    const line = lines[i];

    // Handle code blocks ``` ... ```
    if (line.trim().startsWith('```')) {
      let j = i + 1;
      const codeBlockBuffer: string[] = [];
      while (j < endIndex && !lines[j].trim().startsWith('```')) {
        codeBlockBuffer.push(lines[j]);
        j++;
      }
      if (j < endIndex && lines[j].trim().startsWith('```')) {
        j++; // consume closing ```
      }
      const text = codeBlockBuffer.join('\n');
      return {
        nextIndex: j,
        row: {
          id: generateId(),
          cells: [
            { id: generateId(), text, className: 'markdown' },
          ],
        },
      };
    }

    // Handle GFM Markdown tables
    if (isTableRow(line)) {
      const tableLines: string[] = [];
      let j = i;
      while (j < endIndex && (isTableRow(lines[j]) || isTableSeparator(lines[j]))) {
        tableLines.push(lines[j]);
        j++;
      }
      const subSubTable = parseGfmTable(tableLines);
      return {
        nextIndex: j,
        row: {
          id: generateId(),
          cells: [
            {
              id: generateId(),
              text: '',
              className: 'text',
              table: subSubTable,
            },
          ],
        },
      };
    }

    return super.parseSingleContentItem(lines, i, endIndex);
  }
}

export const markdownImporter = new MarkdownImporter();

export const parseMarkdownToTable = (content: string): Table => {
  return markdownImporter.parse(content);
};
