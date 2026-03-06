/**
 * functions.ts
 * Excel-like built-in functions available in tablord formulas.
 * Call makeFunctions(cellId, getCell) to get a set of functions bound to the current cell.
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
    const num = Number(val);
    return val !== '' && !isNaN(num) ? num : val;
  };

/** Build a context object of functions bound to the current cell and lookup map */
export const makeFunctions = (
  currentCellId: string,
  getCell: (id: string) => string = () => ''
) => ({
  COLUMN: makeColumnFn(currentCellId),
  ROW: makeRowFn(currentCellId),
  NAME: makeNameFn(currentCellId),
  REF: makeRefFn(getCell),
});
