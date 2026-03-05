import type { Table, Row, Cell } from '../types/document';

// Parse HTML string back to TableType
export const parseHtmlToTable = (htmlString: string): Table | null => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const rootTable = doc.querySelector('table');
  if (!rootTable) return null;

  const parseTable = (tableEl: HTMLTableElement, tableId: string): Table => {
    const rows: Row[] = [];
    const tbody = tableEl.querySelector('tbody');
    const trElements = tbody ? Array.from(tbody.children) as HTMLTableRowElement[] : [];
    
    const colCount = trElements[0] ? trElements[0].children.length : 1;
    const columns: string[] = [];
    for (let i = 0; i < colCount; i++) {
       columns.push(String.fromCharCode(65 + i)); // A, B, C...
    }

    const isRoot = tableId === 'document';
    const prefix = isRoot ? '' : tableId + '.';

    trElements.forEach((tr, rIdx) => {
      const rowId = (rIdx + 1).toString();
      const cells: Cell[] = Array.from(tr.children).map((tdEl, cIdx) => {
        const td = tdEl as HTMLTableCellElement;
        const cellId = `${prefix}${columns[cIdx]}.${rowId}`;
        
        // Find if there's a nested table
        const nestedTableEl = td.querySelector(':scope > div.document > table, :scope > table');
        let nestedTable: Table | undefined = undefined;
        if (nestedTableEl) {
           // Sub-table is named after the parent cell
           nestedTable = parseTable(nestedTableEl as HTMLTableElement, cellId);
        }

        // Extract direct text: clone td, remove nested divs/tables, get textContent
        const clone = td.cloneNode(true) as HTMLTableCellElement;
        const innerDivs = clone.querySelectorAll('div.document');
        innerDivs.forEach(d => d.remove());
        const text = clone.textContent?.trim() || '';

        // Extract class names (excluding 'selected')
        const classNames = Array.from(td.classList).filter(c => c !== 'selected').join(' ');

        return {
          id: cellId,
          text,
          className: classNames,
          table: nestedTable
        };
      });
      rows.push({ id: rowId, cells });
    });

    return { id: tableId, columns, rows };
  };

  return parseTable(rootTable, 'document');
};
