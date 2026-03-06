/**
 * functions.ts
 * Excel-like built-in functions available in tablord formulas.
 * Call makeFunctions(cellId) to get a set of functions bound to the current cell.
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

/** Returns the column number of a cell, or of the current cell if no argument given */
export const makeColumnFn = (currentCellId: string) =>
  (cellId?: string): number => colFromId(cellId ?? currentCellId);

/** Returns the row number of a cell, or of the current cell if no argument given */
export const makeRowFn = (currentCellId: string) =>
  (cellId?: string): number => rowFromId(cellId ?? currentCellId);

/** Returns the full cell name (path), or the current cell's name if no argument given */
export const makeNameFn = (currentCellId: string) =>
  (cellId?: string): string => cellId ?? currentCellId;

/** Build a context object of functions bound to the current cell */
export const makeFunctions = (currentCellId: string) => ({
  COLUMN: makeColumnFn(currentCellId),
  ROW: makeRowFn(currentCellId),
  NAME: makeNameFn(currentCellId),
});
