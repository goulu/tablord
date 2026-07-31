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

/**
 * Increment letter sequence preserving case:
 * 'a' -> 'b', 'z' -> 'aa', 'A' -> 'B', 'Z' -> 'AA', 'az' -> 'ba'
 */
export const incrementLetterSequence = (str: string): string => {
  const isUpper = str === str.toUpperCase();
  const base = isUpper ? 65 : 97;
  const chars = str.split('');
  let carry = 1;
  for (let i = chars.length - 1; i >= 0; i--) {
    if (carry === 0) break;
    const code = chars[i].charCodeAt(0) - base;
    const nextCode = code + carry;
    if (nextCode >= 26) {
      chars[i] = String.fromCharCode(base + (nextCode % 26));
      carry = 1;
    } else {
      chars[i] = String.fromCharCode(base + nextCode);
      carry = 0;
    }
  }
  if (carry > 0) {
    chars.unshift(String.fromCharCode(base));
  }
  return chars.join('');
};

/**
 * Increments the rightmost number or letter sequence in a string.
 * Example: "1" -> "2", "A" -> "B", "11)" -> "12)", "Art. 12" -> "Art. 13",
 * "Art. 112 - alinéa 14a" -> "Art. 112 - alinéa 14b".
 * Returns "#ERROR" if the string contains text but no incrementable sequence.
 */
export const incrementValue = (val: string): string => {
  const trimmed = val.trim();
  if (trimmed === '*' || trimmed === '-' || trimmed === '+' || trimmed === '•') {
    return val;
  }

  const regex = /\d+|[A-Za-z]+/g;
  const matches = Array.from(val.matchAll(regex));
  if (matches.length === 0) {
    return '#ERROR';
  }

  const lastMatch = matches[matches.length - 1];
  const matchedStr = lastMatch[0];
  const index = lastMatch.index!;

  let incrementedStr = '';
  if (/^\d+$/.test(matchedStr)) {
    const num = parseInt(matchedStr, 10) + 1;
    incrementedStr = String(num);
  } else {
    incrementedStr = incrementLetterSequence(matchedStr);
  }

  return val.slice(0, index) + incrementedStr + val.slice(index + matchedStr.length);
};

/**
 * INC(targetCell?)
 * Increments the content of targetCell or the first non-empty cell above the current cell.
 * Returns "" if target is empty, or "#ERROR" if non-empty but cannot be incremented.
 */
export const makeIncFn = (currentCellId: string, valueMap: Record<string, string>) => 
  (targetCellArg?: string): string => {
    let rawVal: string | undefined = undefined;

    if (targetCellArg !== undefined && targetCellArg !== null && String(targetCellArg).trim() !== '') {
      rawVal = valueMap[String(targetCellArg)];
    } else {
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
      if (current) {
        for (let r = current.row - 1; r >= 1; r--) {
          const candidateName = `${current.prefix}${current.col}.${r}`;
          const val = valueMap[candidateName];
          if (val !== undefined && val !== null && val.trim() !== '') {
            rawVal = val;
            break;
          }
        }
      }
    }

    if (rawVal === undefined || rawVal === null || rawVal.trim() === '') {
      return '';
    }

    return incrementValue(rawVal);
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
  INC: makeIncFn(currentCellId, valueMap),
});
