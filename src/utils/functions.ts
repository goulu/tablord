/**
 * functions.ts
 * Excel-like built-in functions available in tablord formulas.
 * They are injected into the evaluation context by evaluateFormula().
 */

/** Returns the column number of a cell (A=1, B=2, AA=27, ...) */
export const COLUMN = (cellId: string): number => {
  const match = cellId.match(/([A-Z]+)\.\d+$/);
  if (!match) return 0;
  let num = 0;
  for (const ch of match[1]) {
    num = num * 26 + (ch.charCodeAt(0) - 64);
  }
  return num;
};

/** Returns the row number of a cell */
export const ROW = (cellId: string): number => {
  const match = cellId.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
};

/**
 * Returns the full cell name (path) from its id.
 * Equivalent to the cell address shown in the status bar.
 */
export const NAME = (cellId: string): string => cellId;
