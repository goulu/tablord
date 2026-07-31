import type { Table, Row, Cell } from '../types/document';
import { generateId } from '../types/document';

// Parse HTML string back to TableType
export const parseHtmlToTable = (htmlString: string): Table | null => {
  if (!htmlString || !htmlString.includes('<table')) return null;

  if (typeof DOMParser === 'undefined') {
    // Fallback for Node environment unit tests where DOMParser is not global
    const tdMatches = [...htmlString.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)];
    if (tdMatches.length === 0) return null;
    const cells: Cell[] = tdMatches.map(m => {
      const attrs = m[1];
      const inner = m[2];
      const classMatch = attrs.match(/class="([^"]*)"/i);
      const dataTextMatch = attrs.match(/data-text="([^"]*)"/i);
      const dataFormulaMatch = attrs.match(/data-formula="([^"]*)"/i);

      const rawText = dataTextMatch ? dataTextMatch[1] : (dataFormulaMatch ? dataFormulaMatch[1] : inner.replace(/<[^>]+>/g, '').trim());
      return {
        id: generateId(),
        text: rawText,
        className: classMatch ? classMatch[1] : 'text',
      };
    });
    return {
      id: 'document',
      columns: ['A'],
      rows: [{ id: generateId(), cells }],
    };
  }

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

    trElements.forEach((tr) => {
      const rowId = generateId();
      const cells: Cell[] = Array.from(tr.children).map((tdEl) => {
        const td = tdEl as HTMLTableCellElement;
        const cellId = generateId();
        
        // Find if there's a nested table
        const nestedTableEl = td.querySelector(':scope > div.document > table, :scope > table');
        let nestedTable: Table | undefined = undefined;
        if (nestedTableEl) {
           // Sub-table is named using a new UUID
           nestedTable = parseTable(nestedTableEl as HTMLTableElement, generateId());
        }

        // Extract direct text: clone td, remove nested divs/tables, get textContent
        const clone = td.cloneNode(true) as HTMLTableCellElement;
        const innerDivs = clone.querySelectorAll('div.document');
        innerDivs.forEach(d => d.remove());
        const rawTextContent = clone.textContent?.trim() || '';
        const dataTextAttr = td.getAttribute('data-text');
        const formulaAttr = td.getAttribute('data-formula');
        const text = dataTextAttr ?? formulaAttr ?? rawTextContent;

        // Extract class names, excluding transient UI-only classes
        const TRANSIENT = new Set(['selected', 'formula-ref-target']);
        const classNames = Array.from(td.classList).filter(c => !TRANSIENT.has(c)).join(' ');

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
