import type { Table, Row, Cell } from '../types/document';
import { generateId } from '../types/document';
import type { Importer } from './types';

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
      let className = 'text';
      if (text.startsWith('=')) {
        className = 'formula';
      } else if (text !== '' && !isNaN(Number(text))) {
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
      cells: [{ id: generateId(), text: '', className: 'text' }],
    });
  }

  return {
    id: generateId(),
    columns,
    rows,
  };
};

export const parseMarkdownToTable = (content: string): Table => {
  const lines = content.split(/\r?\n/);
  const rows: Row[] = [];

  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Handle code blocks ``` ... ```
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        inCodeBlock = false;
        if (codeBlockBuffer.length > 0) {
          const text = codeBlockBuffer.join('\n');
          rows.push({
            id: generateId(),
            cells: [{ id: generateId(), text, className: 'text' }],
          });
          codeBlockBuffer = [];
        }
      } else {
        // Start of code block
        inCodeBlock = true;
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line);
      i++;
      continue;
    }

    // Check if we hit a GFM Markdown Table block
    if (isTableRow(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && (isTableRow(lines[i]) || isTableSeparator(lines[i]))) {
        tableLines.push(lines[i]);
        i++;
      }
      const subSubTable = parseGfmTable(tableLines);
      rows.push({
        id: generateId(),
        cells: [
          {
            id: generateId(),
            text: '',
            className: 'text',
            table: subSubTable,
          },
        ],
      });
      continue;
    }

    // Regular markdown text line (heading, list item, blockquote, paragraph)
    const trimmed = line.trim();
    if (trimmed !== '') {
      let className = 'text';
      if (trimmed.startsWith('=')) {
        className = 'formula';
      } else if (!isNaN(Number(trimmed))) {
        className = 'number';
      }
      rows.push({
        id: generateId(),
        cells: [
          {
            id: generateId(),
            text: trimmed,
            className,
          },
        ],
      });
    }

    i++;
  }

  // Handle empty file case
  if (rows.length === 0) {
    rows.push({
      id: generateId(),
      cells: [{ id: generateId(), text: '', className: 'text' }],
    });
  }

  return {
    id: generateId(),
    columns: ['A'], // Main sub-table has 1 column, rows represent markdown lines / elements
    rows,
  };
};

export const markdownImporter: Importer = {
  id: 'markdown',
  name: 'markdown (.md)',
  fileExtensions: ['.md', '.markdown'],
  parse: parseMarkdownToTable,
};
