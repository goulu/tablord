import type { Table, Row } from '../types/document';
import { generateId } from '../types/document';
import type { Importer } from './types';

export interface HeadingInfo {
  level: number;
  title: string;
}

export interface ListItemInfo {
  marker: string;
  text: string;
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
   * Examines a line and returns list item marker & text if it's a list item, or null otherwise.
   */
  parseListItem(_line: string): ListItemInfo | null {
    return null;
  }

  /**
   * Main entry point to parse text content into a Tablord Table.
   */
  parse(content: string): Table {
    const lines = content.split(/\r?\n/);
    return this.parseBlock(lines, 0, lines.length, 0);
  }

  /**
   * Recursively parses a slice of lines [startIndex, endIndex) at parentLevel.
   * Headings of level > parentLevel are added as 2 rows (Title row & Content row) to the current table.
   * List items are added as 2-cell rows (Col A: marker / =INC(), Col B: item text).
   * Non-heading, non-list lines are added as 1-cell rows (no empty cell on the left!).
   */
  protected parseBlock(lines: string[], startIndex: number, endIndex: number, parentLevel: number): Table {
    const rows: Row[] = [];
    let i = startIndex;
    let inList = false;

    while (i < endIndex) {
      const line = lines[i];
      const heading = this.parseHeading(line);

      if (heading) {
        inList = false; // Heading resets list state
        if (heading.level > parentLevel) {
          const headingLevel = heading.level;

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
                text: heading.title,
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
        const listItem = this.parseListItem(line);
        if (listItem) {
          // List item: 2 cells
          // Col A: marker for first item of list, else =INC()
          // Col B: item text
          const colAText = inList ? '=INC()' : listItem.marker;
          const colAClass = colAText.startsWith('=') ? 'formula' : 'text';

          rows.push({
            id: generateId(),
            cells: [
              {
                id: generateId(),
                text: colAText,
                className: colAClass,
              },
              {
                id: generateId(),
                text: listItem.text,
                className: 'text',
              },
            ],
          });

          inList = true;
          i++;
        } else {
          inList = false; // Non-list line resets list state
          const { nextIndex, row } = this.parseSingleContentItem(lines, i, endIndex);
          if (row) {
            rows.push(row);
          }
          i = nextIndex;
        }
      }
    }

    if (rows.length === 0) {
      rows.push({
        id: generateId(),
        cells: [{ id: generateId(), text: '', className: 'text' }],
      });
    }

    const maxCols = Math.max(1, ...rows.map(r => r.cells.length));
    const columns: string[] = [];
    for (let c = 0; c < maxCols; c++) {
      columns.push(String.fromCharCode(65 + c));
    }

    return {
      id: generateId(),
      columns,
      rows,
    };
  }

  /**
   * Helper to parse single non-heading, non-list content items into a 1-cell row (no empty cell on the left!).
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
