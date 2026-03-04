import type { Table, Row, Cell } from '../types/document';

// Parse HTML string back to TableType
export const parseHtmlToTable = (htmlString: string): Table | null => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const rootTable = doc.querySelector('table');
  if (!rootTable) return null;

  const parseTable = (tableEl: HTMLTableElement, isRoot: boolean): Table => {
    const rows: Row[] = [];
    const tbody = tableEl.querySelector('tbody');
    const trElements = tbody ? Array.from(tbody.children) as HTMLTableRowElement[] : [];
    
    // We assume columns are defined by the first row's length, 
    // and lettered A, B, C...
    const colCount = trElements[0] ? trElements[0].children.length : 1;
    const columns: string[] = [];
    for (let i = 0; i < colCount; i++) {
       columns.push(String.fromCharCode(65 + i)); // A, B, C...
    }

    const tableId = isRoot ? 'document' : `subtable_${Math.random().toString(36).substring(2, 9)}`;

    trElements.forEach((tr, rIdx) => {
      const rowId = (rIdx + 1).toString();
      const cells: Cell[] = Array.from(tr.children).map((tdEl, cIdx) => {
        const td = tdEl as HTMLTableCellElement;
        
        // Find if there's a nested table
        const nestedTableEl = td.querySelector('table');
        let nestedTable: Table | undefined = undefined;
        if (nestedTableEl) {
           nestedTable = parseTable(nestedTableEl, false);
        }

        // The text content is whatever is directly in the td, excluding the nested table text
        // To extract just the text, we can clone, remove the table, and get textContent
        const clone = td.cloneNode(true) as HTMLTableCellElement;
        const innerTables = clone.querySelectorAll('table');
        innerTables.forEach(t => t.remove());
        const text = clone.textContent?.trim() || '';

        // Extract class names (excluding 'selected')
        const classNames = Array.from(td.classList).filter(c => c !== 'selected').join(' ');

        return {
          id: `${isRoot ? '' : tableId + '_'}${columns[cIdx]}.${rowId}`,
          text,
          className: classNames,
          table: nestedTable
        };
      });
      rows.push({ id: rowId, cells });
    });

    return {
      id: tableId,
      columns,
      rows
    };
  };

  return parseTable(rootTable, true);
};
