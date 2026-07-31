import type { Table, Row } from '../types/document';
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
   * Recursively parses a slice of lines [startIndex, endIndex) at parentLevel.
   * All headings of the SAME level (> parentLevel) are added directly as 2-row pairs
   * (Row 1: Title, Row 2: Content) inside the current 2-column table.
   * Only child headings of a higher level (> heading.level) create a new child sub-table.
   */
  protected parseBlock(lines: string[], startIndex: number, endIndex: number, parentLevel: number): Table {
    const rows: Row[] = [];
    let i = startIndex;

    while (i < endIndex) {
      const line = lines[i];
      const heading = this.parseHeading(line);

      if (heading) {
        if (heading.level > parentLevel) {
          const headingLevel = heading.level;
          const headingLine = line;

          // Find range of lines belonging to this section (until next heading of level <= headingLevel)
          let j = i + 1;
          while (j < endIndex) {
            const nextHeading = this.parseHeading(lines[j]);
            if (nextHeading && nextHeading.level <= headingLevel) {
              break;
            }
            j++;
          }

          // Parse section body content (lines from i+1 to j) at headingLevel
          const bodyTable = this.parseBlock(lines, i + 1, j, headingLevel);

          // Add the 2-row pair (4 cells total) for this section into the CURRENT table:
          // Row 1 (Title): Col A = "=INC()", Col B = Heading title
          // Row 2 (Content): Col A = "", Col B = bodyTable
          const headingClass = `h${headingLevel}`;

          const titleRow: Row = {
            id: generateId(),
            cells: [
              {
                id: generateId(),
                text: '=INC()',
                className: `formula ${headingClass}`,
              },
              {
                id: generateId(),
                text: headingLine.trim(),
                className: `text ${headingClass}`,
              },
            ],
          };

          const contentRow: Row = {
            id: generateId(),
            cells: [
              {
                id: generateId(),
                text: '',
                className: 'text',
              },
              {
                id: generateId(),
                text: '',
                className: 'text',
                table: bodyTable,
              },
            ],
          };

          rows.push(titleRow, contentRow);
          i = j;
        } else {
          // Heading level <= parentLevel: belongs to outer parent block
          break;
        }
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
        cells: [
          { id: generateId(), text: '', className: 'text' },
          { id: generateId(), text: '', className: 'text' },
        ],
      });
    }

    return {
      id: generateId(),
      columns: ['A', 'B'],
      rows,
    };
  }

  /**
   * Helper to parse single non-heading content items into a 2-cell row (Col A empty, Col B content).
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
            text: '',
            className: 'text',
          },
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
