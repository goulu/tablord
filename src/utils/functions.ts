/**
 * functions.ts
 * Excel-like built-in functions available in tablord formulas.
 * Call makeFunctions(cellId, getCell, valueMap) to get a set of functions bound to the current cell.
 */

const colLetterToNumber = (col: string): number => {
  let num = 0;
  for (const ch of col) {
    num = num * 26 + (ch.charCodeAt(0) - 64);
  }
  return num;
};

const colFromId = (cellId: string): number => {
  const match = cellId.match(/([A-Z]+)\.\d+$/);
  return match ? colLetterToNumber(match[1]) : 0;
};

const rowFromId = (cellId: string): number => {
  const match = cellId.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
};

/** COLUMN(cellId?) — column number; defaults to current cell */
export const makeColumnFn = (currentCellId: string) =>
  (cellId?: string): number => colFromId(cellId ?? currentCellId);

/** ROW(cellId?) — row number; defaults to current cell */
export const makeRowFn = (currentCellId: string) =>
  (cellId?: string): number => rowFromId(cellId ?? currentCellId);

/** NAME(cellId?) — full cell address; defaults to current cell */
export const makeNameFn = (currentCellId: string) =>
  (cellId?: string): string => cellId ?? currentCellId;

/**
 * REF(cellId) — returns the value of another cell.
 * Returns a number if the value is numeric, otherwise a string.
 */
export const makeRefFn = (getCell: (id: string) => string) =>
  (cellId: string): number | string => {
    const val = getCell(cellId);
    if (val === '') return 0; // Empty cells count as 0 in formulas
    const num = Number(val);
    return !isNaN(num) ? num : val;
  };

/**
 * SUM(startCell?, endCell?)
 * If startCell and endCell are provided (e.g. SUM("A.1", "A.5")), it sums that range.
 * If no arguments are provided, it sums everything above the current cell in the same table/column.
 */
export const makeSumFn = (currentCellId: string, valueMap: Record<string, string>) => 
  (startCell?: string, endCell?: string): number => {
    // Helper to get prefix, col, row from a visual cell id like "B.3.A.5" -> { prefix: "B.3.", col: "A", row: 5 }
    const parseCellId = (id: string) => {
      const match = id.match(/^(.*\.)?([A-Z]+)\.(\d+)$/);
      if (!match) return null;
      return {
        prefix: match[1] || '',
        col: match[2],
        row: parseInt(match[3], 10)
      };
    };

    const current = parseCellId(currentCellId);
    if (!current) return 0;

    let targetPrefix = current.prefix;
    let targetCol = current.col;
    let startRow = 1;
    let endRow = current.row - 1; // Default: above current cell

    if (startCell && endCell) {
      const start = parseCellId(startCell);
      const end = parseCellId(endCell);
      if (start && end && start.prefix === end.prefix && start.col === end.col) {
        targetPrefix = start.prefix;
        targetCol = start.col;
        startRow = Math.min(start.row, end.row);
        endRow = Math.max(start.row, end.row);
      } else {
        return NaN; // Invalid or cross-column range not supported yet
      }
    }

    let sum = 0;
    for (let r = startRow; r <= endRow; r++) {
      const cellName = `${targetPrefix}${targetCol}.${r}`;
      if (cellName === currentCellId) continue; // prevent immediate self-reference
      const val = valueMap[cellName];
      if (val !== undefined && val !== '') {
        const num = Number(val);
        if (!isNaN(num)) sum += num;
      }
    }
    return sum;
  };

/** Build a context object of functions bound to the current cell and lookup map */
export const makeFunctions = (
  currentCellId: string,
  getCell: (id: string) => string = () => '',
  valueMap: Record<string, string> = {}
) => ({
  COLUMN: makeColumnFn(currentCellId),
  ROW: makeRowFn(currentCellId),
  NAME: makeNameFn(currentCellId),
  REF: makeRefFn(getCell),
  SUM: makeSumFn(currentCellId, valueMap),
});
