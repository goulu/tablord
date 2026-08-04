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

  /** Default format for text content cells (e.g. 'markdown' for MarkdownImporter, 'text' for base) */
  defaultContentFormat: 'text' | 'markdown' = 'text';

  /**
   * Examines a line and returns heading level & title if it's a heading, or null otherwise.
   * Default implementation parses "# Title", "## Title", etc., cleaning anchor tags and bold delimiters.
   */
  parseHeading(line: string): HeadingInfo | null {
    const trimmed = line.trim();
    const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      let title = match[2].trim();
      // Clean HTML anchors like <a id="..."></a>
      title = title.replace(/<a\b[^>]*>(?:<\/a>)?/gi, '').trim();
      // Clean leading/trailing bold markers if title is wrapped in __ or **
      title = title.replace(/^(__|\*\*)(.*)\1$/, '$2').trim();
      return {
        level: match[1].length,
        title,
      };
    }
    return null;
  }

  /**
   * Examines a line and returns list item marker & text if it's a list item, or null otherwise.
   * Default implementation parses bullets (*, +, -) and ordered list markers (1., 2., 1), 2)).
   */
  parseListItem(line: string): ListItemInfo | null {
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

  /**
   * Main entry point to parse text content into a Tablord Table.
   */
  parse(content: string | ArrayBuffer): Table | Promise<Table> {
    const textContent = typeof content === 'string'
      ? content
      : new TextDecoder().decode(content);
    const lines = textContent.split(/\r?\n/);
    return this.parseLevelContainer(lines, 0, lines.length, 1);
  }

  /**
   * Parses a slice of lines into a 2-column container table ('A', 'B') for headings of a specific level.
   * Each heading of this level adds 1 row of 2 cells:
   * - Col A: =INC() (className: "formula hN")
   * - Col B: Sub-table of 2 rows (Row 1: Heading Title, Row 2: Content bodyTable)
   */
  protected parseLevelContainer(lines: string[], startIndex: number, endIndex: number, level: number): Table {
    const rows: Row[] = [];
    let i = startIndex;

    // Advance past any leading non-headings before first heading of this level
    while (i < endIndex) {
      const heading = this.parseHeading(lines[i]);
      if (heading && heading.level <= level) break;
      i++;
    }

    if (i >= endIndex) {
      // No headings of this level found, fallback to block parsing
      return this.parseBlock(lines, startIndex, endIndex, level - 1);
    }

    // Process all headings of this level (and their sections)
    while (i < endIndex) {
      const heading = this.parseHeading(lines[i]);

      if (heading && heading.level === level) {
        const headingLevel = heading.level;

        // Find range of lines for this section (until next heading of level <= level)
        let j = i + 1;
        while (j < endIndex) {
          const nextHeading = this.parseHeading(lines[j]);
          if (nextHeading && nextHeading.level <= level) {
            break;
          }
          j++;
        }

        // Parse section content body (lines i+1 to j) at parentLevel = level
        const bodyTable = this.parseBlock(lines, i + 1, j, level);

        const headingClass = `h${headingLevel}`;

        // Create 2-row sub-table for Col B (Title & Content)
        const headingSubTable: Table = {
          id: generateId(),
          columns: ['A'],
          rows: [
            {
              id: generateId(),
              cells: [
                {
                  id: generateId(),
                  text: heading.title,
                  className: `${this.defaultContentFormat} ${headingClass}`,
                },
              ],
            },
            {
              id: generateId(),
              cells: [
                {
                  id: generateId(),
                  text: '',
                  className: 'text',
                  table: bodyTable,
                },
              ],
            },
          ],
        };

        // Create 2-cell row for container table: Col A = =INC(), Col B = headingSubTable
        const sectionRow: Row = {
          id: generateId(),
          cells: [
            {
              id: generateId(),
              text: '=INC()',
              className: `formula ${headingClass}`,
            },
            {
              id: generateId(),
              text: '',
              className: 'text',
              table: headingSubTable,
            },
          ],
        };

        rows.push(sectionRow);
        i = j;
      } else if (heading && heading.level < level) {
        // Higher-level (numerically smaller) heading belongs to outer parent block
        break;
      } else {
        i++;
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
      columns: ['A', 'B'],
      rows,
    };
  }

  /**
   * Recursively parses content lines at parentLevel.
   * Non-heading lines and list items are added directly.
   * When sub-headings of level > parentLevel are encountered, a child level container sub-table is created.
   */
  protected parseBlock(lines: string[], startIndex: number, endIndex: number, parentLevel: number): Table {
    const rows: Row[] = [];
    let i = startIndex;

    while (i < endIndex) {
      const line = lines[i];
      const heading = this.parseHeading(line);

      if (heading) {
        if (heading.level > parentLevel) {
          const targetLevel = heading.level;

          // Find range of all sub-headings of level >= targetLevel up to next heading <= parentLevel
          let j = i + 1;
          while (j < endIndex) {
            const nextHeading = this.parseHeading(lines[j]);
            if (nextHeading && nextHeading.level <= parentLevel) {
              break;
            }
            j++;
          }

          // Create level container sub-table for sub-headings
          const levelSubTable = this.parseLevelContainer(lines, i, j, targetLevel);

          rows.push({
            id: generateId(),
            cells: [
              {
                id: generateId(),
                text: '',
                className: 'text',
                table: levelSubTable,
              },
            ],
          });

          i = j;
        } else {
          // Heading level <= parentLevel: break to let outer parent block handle it
          break;
        }
      } else {
        const listItem = this.parseListItem(line);
        if (listItem) {
          // Collect all consecutive list items in this list group
          let j = i;
          const listRows: Row[] = [];
          let inListGroup = false;

          while (j < endIndex) {
            const item = this.parseListItem(lines[j]);
            if (!item) break;

            const colAText = inListGroup ? '=INC()' : item.marker;
            const colAClass = colAText.startsWith('=') ? 'formula' : 'number';

            listRows.push({
              id: generateId(),
              cells: [
                {
                  id: generateId(),
                  text: colAText,
                  className: colAClass,
                },
                {
                  id: generateId(),
                  text: item.text,
                  className: this.defaultContentFormat,
                },
              ],
            });

            inListGroup = true;
            j++;
          }

          const listSubTable: Table = {
            id: generateId(),
            columns: ['A', 'B'],
            rows: listRows,
          };

          rows.push({
            id: generateId(),
            cells: [
              {
                id: generateId(),
                text: '',
                className: 'text',
                table: listSubTable,
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
    }

    if (rows.length === 0) {
      rows.push({
        id: generateId(),
        cells: [{ id: generateId(), text: '', className: this.defaultContentFormat }],
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

    let className: string = this.defaultContentFormat;
    if (!isNaN(Number(trimmed))) {
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
