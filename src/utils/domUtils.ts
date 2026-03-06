/**
 * Finds the visual name of a cell (e.g. "A.1", "B.3.A.2") based solely on its position
 * in the live HTML DOM tree. This makes references resilient to row/column insertions.
 */
export const getCellNameFromDOM = (tdElement: HTMLTableCellElement): string => {
  let currentEl: HTMLElement | null = tdElement;
  const parts: string[] = [];

  while (currentEl) {
    // We are looking for the <td> element to determine the column
    if (currentEl.tagName.toLowerCase() === 'td') {
      const td = currentEl as HTMLTableCellElement;
      // The parent <tr> gives us the row number
      const tr = td.closest('tr');
      if (tr) {
        // rowIndex is 0-indexed in the table, but we might have header rows.
        // Assuming our table structure: <thead> with 1 row, then <tbody>.
        // So tr.rowIndex is 1 for the first data row. This perfectly matches "A.1".
        // If there's no thead or it's built differently, we might need to adjust.
        // Let's use the tr.rowIndex assuming 1-based data rows (0 is header).
        // Wait, cellIndex is also 0-indexed. The first data column is A, but there is a row header column?
        // Tablord doesn't use row headers, column 0 is A.
        
        let rIndex = tr.rowIndex;
        // In the Table component, there's a <thead><tr><th>...</th></tr></thead>
        // So the first <tr> in <tbody> has rowIndex 1.
        
        // Convert cellIndex to column name (0 -> A, 1 -> B)
        let cIndex = td.cellIndex;
        // Let's create a local function for column letters
        const getColName = (num: number) => {
          let name = '';
          while (num >= 0) {
            name = String.fromCharCode(65 + (num % 26)) + name;
            num = Math.floor(num / 26) - 1;
          }
          return name;
        };
        const colName = getColName(cIndex);
        
        parts.unshift(`${colName}.${rIndex}`);
      }
    }
    
    // Move up to the next parent table
    const table = currentEl.closest('table') as HTMLTableElement | null;
    if (!table) break;
    
    // Is this table nested inside another cell?
    const parentTd = table.closest('td') as HTMLTableCellElement | null;
    currentEl = parentTd;
  }

  return parts.join('.');
};
