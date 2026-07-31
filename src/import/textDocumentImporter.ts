import type { Table, Row, Cell } from '../types/document';
import { generateId } from '../types/document';
import type { Importer } from './types';

export interface HeadingInfo {
  level: number;
  title: string;
}

export abstract class TextDocumentImporter implements Importer {
  abstract id: string;
  abstract name: string;
  abstract fileExtensions: string[];

  /**
   * Examines a line and returns heading level & title if it's a heading, or null otherwise.
   */
  abstract parseHeading(line: string): HeadingInfo | null;

  /**
   * Main entry point to parse text content into a Tablord Table.
   */
  parse(content: string): Table {
    const lines = content.split(/\r?\n/);
    return this.parseBlock(lines, 0, lines.length, 0);
  }

  /**
   * Recursively parses a slice of lines [startIndex, endIndex) at a given parent heading level.
   */
  protected parseBlock(lines: string[], startIndex: number, endIndex: number, parentLevel: number): Table {
    const rows: Row[] = [];
    let i = startIndex;

    while (i < endIndex) {
      const line = lines[i];
      const heading = this.parseHeading(line);

      if (heading && heading.level > parentLevel) {
        const headingLevel = heading.level;
        const headingLine = line;

        // Collect lines for this section until the next heading of level <= headingLevel
        let j = i + 1;
        while (j < endIndex) {
          const nextHeading = this.parseHeading(lines[j]);
          if (nextHeading && nextHeading.level <= headingLevel) {
            break;
          }
          j++;
        }

        // Recursively parse the body content of this section
        const bodyTable = this.parseBlock(lines, i + 1, j, headingLevel);

        // Build 2-cell section sub-table (Cell 1: Title, Cell 2: Content)
        const sectionSubTable = this.createSectionTable(headingLine, headingLevel, bodyTable);

        rows.push({
          id: generateId(),
          cells: [
            {
              id: generateId(),
              text: '',
              className: 'text',
              table: sectionSubTable,
            },
          ],
        });

        i = j;
      } else {
        const { nextIndex, row } = this.parseSingleContentItem(lines, i, endIndex);
        if (row) {
          rows.push(row);
        }
        i = nextIndex;
      }
    }

    if (rows.length === 0) {
      rows.push({
        id: generateId(),
        cells: [{ id: generateId(), text: '', className: 'text' }],
      });
    }

    return {
      id: generateId(),
      columns: ['A'],
      rows,
    };
  }

  /**
   * Creates a 2x2 sub-table for a section:
   * - Top-left (Row 1, Col A): contains "=INC()", className: "formula hN"
   * - Top-right (Row 1, Col B): contains heading text, className: "text hN"
   * - Bottom-left (Row 2, Col A): empty cell
   * - Bottom-right (Row 2, Col B): contains bodyTable
   */
  protected createSectionTable(headingText: string, headingLevel: number, bodyTable: Table): Table {
    const headingClass = `h${headingLevel}`;

    const topLeftCell: Cell = {
      id: generateId(),
      text: '=INC()',
      className: `formula ${headingClass}`,
    };

    const topRightCell: Cell = {
      id: generateId(),
      text: headingText.trim(),
      className: `text ${headingClass}`,
    };

    const bottomLeftCell: Cell = {
      id: generateId(),
      text: '',
      className: 'text',
    };

    const bottomRightCell: Cell = {
      id: generateId(),
      text: '',
      className: 'text',
      table: bodyTable,
    };

    return {
      id: generateId(),
      columns: ['A', 'B'],
      rows: [
        {
          id: generateId(),
          cells: [topLeftCell, topRightCell],
        },
        {
          id: generateId(),
          cells: [bottomLeftCell, bottomRightCell],
        },
      ],
    };
  }

  /**
   * Parses non-heading single content items. Subclasses can override for code blocks, GFM tables, etc.
   */
  protected parseSingleContentItem(lines: string[], i: number, _endIndex: number): { nextIndex: number; row: Row | null } {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') {
      return { nextIndex: i + 1, row: null };
    }

    let className = 'text';
    if (trimmed.startsWith('=')) {
      className = 'formula';
    } else if (!isNaN(Number(trimmed))) {
      className = 'number';
    }

    return {
      nextIndex: i + 1,
      row: {
        id: generateId(),
        cells: [
          {
            id: generateId(),
            text: trimmed,
            className,
          },
        ],
      },
    };
  }
}
