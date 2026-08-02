import type { Table, Row, Cell } from '../types/document';
import { generateId } from '../types/document';
import { makeFunctions } from './functions';

const convertColToNumber = (col: string): number => {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + (col.charCodeAt(i) - 64);
  }
  return num;
};

const convertNumberToCol = (num: number): string => {
  let colName = '';
  while (num > 0) {
    const modulo = (num - 1) % 26;
    colName = String.fromCharCode(65 + modulo) + colName;
    num = Math.floor((num - modulo) / 26);
  }
  return colName;
};

export const getNextColumnName = (col: string): string => {
  return convertNumberToCol(convertColToNumber(col) + 1);
};

export const getNextRowId = (rowId: string): string => {
  const num = parseInt(rowId, 10);
  if (!isNaN(num)) {
    return (num + 1).toString();
  }
  return rowId + "_new";
};

/**
 * Computes the visual name (e.g. "A.1", "B.3.C.2") of a cell given its UUID,
 * by traversing the table tree.
 */
export const getCellNameById = (table: Table, targetCellId: string): string | null => {
  const search = (t: Table, prefix: string): string | null => {
    for (let rIdx = 0; rIdx < t.rows.length; rIdx++) {
      const row = t.rows[rIdx];
      for (let cIdx = 0; cIdx < row.cells.length; cIdx++) {
        const cell = row.cells[cIdx];
        const colName = t.columns[cIdx];
        const cellName = `${prefix}${colName}.${rIdx + 1}`;
        
        if (cell.id === targetCellId) {
          return cellName;
        }
        
        if (cell.table) {
          const found = search(cell.table, `${cellName}.`);
          if (found) return found;
        }
      }
    }
    return null;
  };
  return search(table, '');
};

/**
 * Finds the UUID of a cell given its visual name (e.g. "A.1").
 */
export const getCellIdByName = (table: Table, name: string): string | null => {
  const parts = name.split('.');
  
  let currentTable = table;
  let currentCellId: string | null = null;
  
  for (let i = 0; i < parts.length; i += 2) {
    if (i + 1 >= parts.length) return null; // Invalid format
    const colName = parts[i];
    const rowNum = parseInt(parts[i + 1], 10);
    
    if (isNaN(rowNum)) return null;
    
    const colIdx = currentTable.columns.indexOf(colName);
    const rIdx = rowNum - 1;
    
    if (colIdx === -1 || rIdx < 0 || rIdx >= currentTable.rows.length) {
      return null;
    }
    
    const cell = currentTable.rows[rIdx].cells[colIdx];
    if (!cell) return null;
    
    currentCellId = cell.id;
    
    // If not the last segment, we must traverse into the sub-table
    if (i + 2 < parts.length) {
      if (!cell.table) return null;
      currentTable = cell.table;
    }
  }
  
  return currentCellId;
};

export const handleTab = (table: Table, activeCellId: string): { newTable: Table, newActiveCellId: string } => {
  let newActiveCellId = activeCellId;
  let found = false;

  const traverse = (t: Table): Table => {
    for (let rIdx = 0; rIdx < t.rows.length; rIdx++) {
      const row = t.rows[rIdx];
      const cIdx = row.cells.findIndex(c => c.id === activeCellId);
      if (cIdx !== -1) {
        found = true;
        if (cIdx === row.cells.length - 1) {
          // create column
          const nextColName = getNextColumnName(t.columns[t.columns.length - 1]);
          const newColumns = [...t.columns, nextColName];
          const newRows = t.rows.map((r, i) => {
            const newCellId = generateId();
            if (i === rIdx) {
               newActiveCellId = newCellId;
            }
            return {
              ...r,
              cells: [...r.cells, { id: newCellId, text: "" }]
            };
          });
          return { ...t, columns: newColumns, rows: newRows };
        } else {
          // move right
          newActiveCellId = row.cells[cIdx + 1].id;
          return t;
        }
      }
    }

    let childModified = false;
    const newRows = t.rows.map(row => {
      let rowModified = false;
      const newCells = row.cells.map(cell => {
        if (cell.table && !found) {
          const newSubTable = traverse(cell.table);
          if (found && !rowModified) {
             rowModified = true;
             return { ...cell, table: newSubTable };
          }
        }
        return cell;
      });
      if (rowModified) childModified = true;
      return rowModified ? { ...row, cells: newCells } : row;
    });

    return childModified ? { ...t, rows: newRows } : t;
  };

  const newTable = traverse(table);
  return { newTable, newActiveCellId };
};

export const handleEnter = (table: Table, activeCellId: string): { newTable: Table, newActiveCellId: string } => {
  let newActiveCellId = activeCellId;
  let found = false;

  const traverse = (t: Table): Table => {
    for (let rIdx = 0; rIdx < t.rows.length; rIdx++) {
      const row = t.rows[rIdx];
      const cIdx = row.cells.findIndex(c => c.id === activeCellId);
      if (cIdx !== -1) {
        found = true;
        found = true;
        // create new row below the LAST row to maintain 1, 2, 3 ordering
        const lastRow = t.rows[t.rows.length - 1];
        const nextRowId = getNextRowId(lastRow.id);
        const newRowCells = t.columns.map((colName, cIdx2) => {
           const newCellId = generateId(); // Use UUID instead of coordinate string
           if (colName === t.columns[cIdx]) {
              newActiveCellId = newCellId;
           }
           
           const cellAbove = lastRow.cells[cIdx2];
           let newText = '';
           let newClassName = cellAbove?.className;

           if (cellAbove) {
             if (cellAbove.text.startsWith('=')) {
               // Formula cell: apply offsetFormulaRows to adjust relative references
               newText = offsetFormulaRows(cellAbove.text, 1);
               newClassName = setCellTypeClass(cellAbove.className || '', 'formula');
             } else if (
               cellAbove.className?.includes('number') &&
               cellAbove.text.trim() !== '' &&
               Number.isInteger(Number(cellAbove.text))
             ) {
               // Integer number: produce a formula that increments from the cell above
               // We will fully rewrite the "offset by 1" logic to rely on position later.
               const expectedCellAboveName = getCellNameById(table, cellAbove.id) || '';
               
               const localRef =
                  t.id !== 'document' && expectedCellAboveName.startsWith(t.id + '.')
                    ? '.' + expectedCellAboveName.slice(t.id.length + 1)
                    : expectedCellAboveName;
               newText = `=${localRef}+1`;
               newClassName = setCellTypeClass(cellAbove.className || '', 'formula');
             }
           }
           
           return { 
             id: newCellId, 
             text: newText,
             className: newClassName,
           };
        });
        const newRow: Row = { id: nextRowId, cells: newRowCells };
        
        const newRows = [...t.rows];
        newRows.splice(rIdx + 1, 0, newRow);
        
        return { ...t, rows: newRows };
      }
    }

    let childModified = false;
    const newRows = t.rows.map(row => {
      let rowModified = false;
      const newCells = row.cells.map(cell => {
        if (cell.table && !found) {
          const newSubTable = traverse(cell.table);
          if (found && !rowModified) {
             rowModified = true;
             return { ...cell, table: newSubTable };
          }
        }
        return cell;
      });
      if (rowModified) childModified = true;
      return rowModified ? { ...row, cells: newCells } : row;
    });

    return childModified ? { ...t, rows: newRows } : t;
  };

  const newTable = traverse(table);
  return { newTable, newActiveCellId };
};

export const handleCtrlTab = (table: Table, activeCellId: string): { newTable: Table, newActiveCellId: string } => {
  let newActiveCellId = activeCellId;
  let found = false;

  const traverse = (t: Table): Table => {
    let childModified = false;
    const newRows = t.rows.map(row => {
      let rowModified = false;
      const newCells = row.cells.map(cell => {
        if (cell.id === activeCellId) {
          found = true;
          rowModified = true;
          // Generating a unique ID for the subtable instead of cell.id
          const subTableId = generateId(); 
          const newCellId = generateId();
          newActiveCellId = newCellId;
          
          const newSubTable: Table = {
            id: subTableId,
            columns: ["A"],
            rows: [
              {
                id: generateId(),
                cells: [
                  {
                    id: newCellId,
                    text: "",
                  }
                ]
              }
            ]
          };
          return { ...cell, table: newSubTable };
        }
        if (cell.table && !found) {
          const newSubTable = traverse(cell.table);
          if (found && !rowModified) {
             rowModified = true;
             return { ...cell, table: newSubTable };
          }
        }
        return cell;
      });
      if (rowModified) childModified = true;
      return rowModified ? { ...row, cells: newCells } : row;
    });

    return childModified ? { ...t, rows: newRows } : t;
  };

  const newTable = traverse(table);
  return { newTable, newActiveCellId };
};

export const createEmptyDocument = (): Table => ({
  id: "document",
  columns: ["A"],
  rows: [
    {
      id: generateId(),
      cells: [
        {
          id: generateId(),
          text: "",
          className: "text",
        },
      ],
    },
  ],
});

export const deleteRow = (table: Table, cellId: string): Table => {
  const isCellInTable = (tbl: Table, targetId: string): boolean => {
    for (const r of tbl.rows) {
      for (const c of r.cells) {
        if (c.id === targetId) return true;
        if (c.table && isCellInTable(c.table, targetId)) return true;
      }
    }
    return false;
  };

  const traverse = (t: Table, isRoot: boolean): { table: Table; deletedSubtable?: boolean } => {
    const targetRowIdx = t.rows.findIndex(r => r.cells.some(c => c.id === cellId));
    if (targetRowIdx !== -1) {
      if (t.rows.length <= 1) {
        if (isRoot) {
          return { table: createEmptyDocument() };
        } else {
          return { table: t, deletedSubtable: true };
        }
      }
      const newRows = [...t.rows];
      newRows.splice(targetRowIdx, 1);
      return { table: { ...t, rows: newRows } };
    }

    let modified = false;
    const newRows = t.rows.map(row => {
      let rowModified = false;
      const newCells = row.cells.map(cell => {
        if (cell.table && isCellInTable(cell.table, cellId)) {
          const res = traverse(cell.table, false);
          rowModified = true;
          if (res.deletedSubtable) {
            return { ...cell, table: undefined };
          }
          return { ...cell, table: res.table };
        }
        return cell;
      });
      if (rowModified) modified = true;
      return rowModified ? { ...row, cells: newCells } : row;
    });

    return { table: modified ? { ...t, rows: newRows } : t };
  };

  return traverse(table, true).table;
};

export const deleteColumn = (table: Table, cellId: string): Table => {
  const isCellInTable = (tbl: Table, targetId: string): boolean => {
    for (const r of tbl.rows) {
      for (const c of r.cells) {
        if (c.id === targetId) return true;
        if (c.table && isCellInTable(c.table, targetId)) return true;
      }
    }
    return false;
  };

  const traverse = (t: Table, isRoot: boolean): { table: Table; deletedSubtable?: boolean } => {
    const targetRow = t.rows.find(r => r.cells.some(c => c.id === cellId));
    if (targetRow) {
      const targetColIdx = targetRow.cells.findIndex(c => c.id === cellId);
      if (t.columns.length <= 1) {
        if (isRoot) {
          return { table: createEmptyDocument() };
        } else {
          return { table: t, deletedSubtable: true };
        }
      }
      const newCols = [...t.columns];
      newCols.splice(targetColIdx, 1);
      const newRows = t.rows.map(r => {
        const newCells = [...r.cells];
        newCells.splice(targetColIdx, 1);
        return { ...r, cells: newCells };
      });
      return { table: { ...t, columns: newCols, rows: newRows } };
    }

    let modified = false;
    const newRows = t.rows.map(row => {
      let rowModified = false;
      const newCells = row.cells.map(cell => {
        if (cell.table && isCellInTable(cell.table, cellId)) {
          const res = traverse(cell.table, false);
          rowModified = true;
          if (res.deletedSubtable) {
            return { ...cell, table: undefined };
          }
          return { ...cell, table: res.table };
        }
        return cell;
      });
      if (rowModified) modified = true;
      return rowModified ? { ...row, cells: newCells } : row;
    });

    return { table: modified ? { ...t, rows: newRows } : t };
  };

  return traverse(table, true).table;
};

export const deleteTable = (table: Table, cellId: string): Table => {
  const isCellInTable = (tbl: Table, targetId: string): boolean => {
    for (const r of tbl.rows) {
      for (const c of r.cells) {
        if (c.id === targetId) return true;
        if (c.table && isCellInTable(c.table, targetId)) return true;
      }
    }
    return false;
  };

  let foundInSubtable = false;

  const traverse = (t: Table): Table => {
    let modified = false;
    const newRows = t.rows.map(row => {
      let rowModified = false;
      const newCells = row.cells.map(cell => {
        if (cell.table && isCellInTable(cell.table, cellId)) {
          const inNested = cell.table.rows.some(r => r.cells.some(c => c.table && isCellInTable(c.table, cellId)));
          if (inNested) {
            const newSub = traverse(cell.table);
            rowModified = true;
            return { ...cell, table: newSub };
          } else {
            foundInSubtable = true;
            rowModified = true;
            return { ...cell, table: undefined };
          }
        }
        return cell;
      });
      if (rowModified) modified = true;
      return rowModified ? { ...row, cells: newCells } : row;
    });
    return modified ? { ...t, rows: newRows } : t;
  };

  const result = traverse(table);
  if (foundInSubtable) {
    return result;
  }

  if (isCellInTable(table, cellId)) {
    return createEmptyDocument();
  }

  return table;
};

export const handleArrow = (table: Table, activeCellId: string, direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): string => {
  let newActiveCellId = activeCellId;
  let found = false;

  const traverse = (t: Table) => {
    for (let rIdx = 0; rIdx < t.rows.length; rIdx++) {
      const row = t.rows[rIdx];
      const cIdx = row.cells.findIndex(c => c.id === activeCellId);
      if (cIdx !== -1) {
        found = true;
        
        if (direction === 'ArrowUp' && rIdx > 0) {
          newActiveCellId = t.rows[rIdx - 1].cells[cIdx].id;
        } else if (direction === 'ArrowDown' && rIdx < t.rows.length - 1) {
          newActiveCellId = t.rows[rIdx + 1].cells[cIdx].id;
        } else if (direction === 'ArrowLeft' && cIdx > 0) {
          newActiveCellId = row.cells[cIdx - 1].id;
        } else if (direction === 'ArrowRight' && cIdx < row.cells.length - 1) {
          newActiveCellId = row.cells[cIdx + 1].id;
        }
        return;
      }
    }

    if (!found) {
      for (const row of t.rows) {
        for (const cell of row.cells) {
          if (cell.table && !found) {
            traverse(cell.table);
          }
        }
      }
    }
  };

  traverse(table);
  return newActiveCellId;
};

export type CellType = 'text' | 'number' | 'formula' | 'markdown';

export const getCellType = (className?: string): CellType => {
  if (!className) return 'text';
  const classes = className.split(/\s+/);
  if (classes.includes('markdown')) return 'markdown';
  if (classes.includes('formula')) return 'formula';
  if (classes.includes('number')) return 'number';
  return 'text';
};

export const setCellTypeClass = (className: string = '', newType: CellType): string => {
  const typeClasses = ['text', 'number', 'formula', 'markdown'];
  const classes = className.split(/\s+/).filter(Boolean);
  const typeIdx = classes.findIndex(c => typeClasses.includes(c));
  if (typeIdx >= 0) {
    if (newType !== 'text') {
      classes[typeIdx] = newType;
    } else {
      classes.splice(typeIdx, 1);
      classes.push('text');
    }
  } else {
    classes.push(newType);
  }
  return classes.join(' ');
};

export const toggleCellClass = (className: string = '', toggleClass: string): string => {
  const classes = className.split(' ').filter(c => c);
  if (classes.includes(toggleClass)) {
    return classes.filter(c => c !== toggleClass).join(' ');
  } else {
    classes.push(toggleClass);
    return classes.join(' ');
  }
};


/**
 * Returns the table-prefix part of a cell ID (everything except the final Col.Row segment).
 * E.g. "B.3.A.2" → "B.3",  "A.1" → ""
 */
export const getTablePrefix = (cellId: string): string => {
  const m = cellId.match(/^(.+)\.[A-Z]+\.\d+$/);
  return m ? m[1] : '';
};

/**
 * Pre-process a formula string: replace cell references with REF("cellId") calls.
 *
 * Supported notations ($ = absolute marker, ignored for lookup):
 *   .A.2          local shorthand → expands using currentCellId's table prefix
 *   A.2           simple root ref
 *   B.3.A.2       full chained ref (sub-table path)
 *   $A.$2, $B.3.$A.$2, etc.  absolute markers ($ stripped for lookup)
 *
 * Quoted string literals (e.g. COLUMN("B.4")) are protected and not modified.
 */
export const preprocessCellRefs = (formula: string, currentCellId = ''): string => {
  const strings: string[] = [];
  // Protect quoted strings
  let processed = formula.replace(/"[^"]*"/g, (match) => {
    strings.push(match);
    return `__S${strings.length - 1}__`;
  });

  const tablePrefix = getTablePrefix(currentCellId);

  // 0. Special case: SUM(start, end) without quotes. We want to treat the arguments as strings
  // so they aren't converted to REF() calls, which would evaluate them before SUM receives them.
  // We match SUM(arg1, arg2) where args are not already quoted.
  processed = processed.replace(/SUM\(\s*([^",\)]+)\s*,\s*([^",\)]+)\s*\)/ig, (_, arg1, arg2) => {
    const cleanArg1 = arg1.trim();
    const cleanArg2 = arg2.trim();
    const wrap = (s: string) => {
      // If it's already a protected string like __S0__
      if (/^__S\d+__$/.test(s)) return s;
      // If it's not a number, wrap it in quotes and protect it
      if (s && !/^[-+]?\d*\.?\d+$/.test(s)) {
        strings.push(`"${s}"`);
        return `__S${strings.length - 1}__`;
      }
      return s;
    };
    return `SUM(${wrap(cleanArg1)}, ${wrap(cleanArg2)})`;
  });

  // 1. Local shorthand: a dot NOT preceded by a digit, followed by ColLetter.RowNum
  //    Example:  .A.2  →  REF("B.3.A.2")  (when in table B.3)
  //    Negative lookbehind (?<!\d) ensures ".A.2" inside "B.3.A.2" is NOT matched here.
  //    (Replaced (?<!\d) with (^|[^\d]) to support Safari/Vivaldi which don't support lookbehinds)
  processed = processed.replace(/(^|[^\d])\.(\$?[A-Z]+\.\$?\d+)/g, (_, prev, localPart) => {
    const lookupId = (tablePrefix ? tablePrefix + '.' : '') + localPart.replace(/\$/g, '');
    return `${prev}REF("${lookupId}")`;
  });

  // 2. Full chained (or simple) refs: A.1, B.3.A.2, $C.$3, $B.3.$A.$2 …
  //    Greedy multi-segment match: ColLetter.RowNum (. ColLetter.RowNum)*
  //    We add negative lookbehind (?<!REF\("|[A-Z0-9\.]) to avoid double-replacing refs already processed in step 1,
  //    or matching inside larger identifiers.
  //    (Replaced (?<!...) with (^|[^A-Z0-9\."]) to support Safari/Vivaldi)
  processed = processed.replace(/(^|[^A-Z0-9\."])(\$?[A-Z]+\.\$?\d+(?:\.\$?[A-Z]+\.\$?\d+)*)/g, (_, prev, match) => {
    const cellId = match.replace(/\$/g, '');
    return `${prev}REF("${cellId}")`;
  });

  // Restore strings
  return processed.replace(/__S(\d+)__/g, (_, i) => strings[parseInt(i, 10)]);
};

/**
 * Increments the row number of relative cell references in a formula by a given offset.
 * E.g. A.1 -> A.2, .A.1 -> .A.2. Absolute references like $A.$1 or A.$1 are unaffected.
 */
export const offsetFormulaRows = (formula: string, rowOffset: number): string => {
  const strings: string[] = [];
  // Protect quoted strings
  let processed = formula.replace(/"[^"]*"/g, (match) => {
    strings.push(match);
    return `__S${strings.length - 1}__`;
  });

  // Regex to find cell references. A cell ref ends with .[digits] or .$[digits]
  // We want to match: (prefix)\.(rowNum)
  // The prefix can be complex: A, .A, B.3.A, $B.3.$A, etc.
  // We'll just look for: (\.[A-Z]+)\.(\d+) or (^|[^\w\.])([A-Z]+)\.(\d+)
  // Actually, a safer way is to match the Col.Row pattern specifically:
  // (.*?)([A-Z]+)\.(\$?)(\d+)
  
  // Note: the `matchAll` process from preprocessCellRefs is:
  // \$?[A-Z]+\.\$?\d+(?:\.\$?[A-Z]+\.\$?\d+)*
  // It's easier to find the final \.(\$?)(\d+) of any sequence of uppercase letters and dots.
  
  // To avoid altering numbers that just happen to follow a dot (like 3.14),
  // we look for an uppercase letter, then a dot, then optionally a $, then digits.
  processed = processed.replace(/([A-Z]+)\.(\$?)(\d+)/g, (match, colPart, dollarSign, rowStr) => {
    if (dollarSign === '$') {
      return match; // Absolute row, do not change
    }
    const rowNum = parseInt(rowStr, 10);
    return `${colPart}.${rowNum + rowOffset}`;
  });

  // Restore strings
  return processed.replace(/__S(\d+)__/g, (_, i) => strings[parseInt(i, 10)]);
};

/** Build a flat map of visual cell name → current display value for the whole table tree */
export const buildValueMap = (table: Table): Record<string, string> => {
  const map: Record<string, string> = {};
  const walk = (t: Table, prefix: string) => {
    t.rows.forEach((row, rIdx) => {
      row.cells.forEach((cell, cIdx) => {
        const colName = t.columns[cIdx];
        const cellName = `${prefix}${colName}.${rIdx + 1}`;
        map[cellName] = cell.value ?? cell.text;
        if (cell.table) walk(cell.table, `${cellName}.`);
      });
    });
  };
  walk(table, '');
  return map;
};

export const evaluateFormula = (
  formula: string,
  cellName = '',
  valueMap: Record<string, string> = {}
): string => {
  try {
    const { COLUMN, ROW, NAME, REF, SUM, INC } = makeFunctions(cellName, (name) => valueMap[name] ?? '', valueMap);
    const processed = preprocessCellRefs(formula, cellName); // pass visual cellName for local ref resolution
    // eslint-disable-next-line no-new-func
    const result = Function('COLUMN', 'ROW', 'NAME', 'REF', 'SUM', 'INC', '"use strict"; return (' + processed.slice(1) + ')')(COLUMN, ROW, NAME, REF, SUM, INC);
    return String(result);
  } catch {
    return '#ERROR';
  }
};

// Helper to resolve all dependencies for SUM() and SUM(start, end)
const getSumDependencies = (processed: string, currentName: string, allNames: string[]): string[] => {
  const deps: string[] = [];
  const parseCellId = (id: string) => {
    const match = id.match(/^(.*\.)?([A-Z]+)\.(\d+)$/);
    if (!match) return null;
    return {
      prefix: match[1] || '',
      col: match[2],
      row: parseInt(match[3], 10)
    };
  };

  const current = parseCellId(currentName);
  if (!current) return deps;

  // match SUM("start", "end") and SUM()
  const sumRegex = /SUM\((?:\s*"([^"]+)"\s*,\s*"([^"]+)"\s*)?\)/g;
  
  for (const m of processed.matchAll(sumRegex)) {
    const startCell = m[1];
    const endCell = m[2];

    let targetPrefix = current.prefix;
    let targetCol = current.col;
    let startRow = 1;
    let endRow = current.row - 1;

    if (startCell && endCell) {
      const start = parseCellId(startCell);
      const end = parseCellId(endCell);
      if (start && end && start.prefix === end.prefix && start.col === end.col) {
        targetPrefix = start.prefix;
        targetCol = start.col;
        startRow = Math.min(start.row, end.row);
        endRow = Math.max(start.row, end.row);
      }
    }

    for (let r = startRow; r <= endRow; r++) {
      const cellName = `${targetPrefix}${targetCol}.${r}`;
      if (cellName !== currentName && allNames.includes(cellName)) {
        deps.push(cellName);
      }
    }
  }
  return deps;
};

// Helper to resolve all dependencies for INC() and INC(target)
const getIncDependencies = (processed: string, currentName: string, allNames: string[]): string[] => {
  const deps: string[] = [];
  const parseCellId = (id: string) => {
    const match = id.match(/^(.*\.)?([A-Z]+)\.(\d+)$/);
    if (!match) return null;
    return {
      prefix: match[1] || '',
      col: match[2],
      row: parseInt(match[3], 10)
    };
  };

  const current = parseCellId(currentName);
  if (!current) return deps;

  const incRegex = /INC\((?:\s*"([^"]+)"\s*)?\)/g;
  for (const m of processed.matchAll(incRegex)) {
    const targetCell = m[1];
    if (targetCell) {
      if (allNames.includes(targetCell)) {
        deps.push(targetCell);
      }
    } else {
      for (let r = current.row - 1; r >= 1; r--) {
        const candidate = `${current.prefix}${current.col}.${r}`;
        if (allNames.includes(candidate)) {
          deps.push(candidate);
        }
      }
    }
  }
  return deps;
};

/**
 * Recalculate all formula cells in dependency order (topological sort).
 * Formula cells that form a cycle are marked with #CIRCULAR.
 */
export const recalculateTable = (table: Table): Table => {
  // ── Step 1: collect all cells into a flat map keyed by VISUAL NAME (`A.1`)
  const valueMap: Record<string, string> = {};
  const formulaCells: { id: string; name: string; formula: string }[] = [];

  const collectCells = (t: Table, prefix: string) => {
    t.rows.forEach((row, rIdx) => {
      row.cells.forEach((cell, cIdx) => {
        const colName = t.columns[cIdx];
        const cellName = `${prefix}${colName}.${rIdx + 1}`;
        
        const isFormulaCell = getCellType(cell.className) === 'formula';
        if (isFormulaCell && cell.text.startsWith('=')) {
          formulaCells.push({ id: cell.id, name: cellName, formula: cell.text });
          valueMap[cellName] = cell.value ?? '';   // seed with previous value
        } else {
          valueMap[cellName] = cell.text;
        }
        if (cell.table) collectCells(cell.table, `${cellName}.`);
      });
    });
  };
  collectCells(table, '');

  // ── Step 2: build dependency graph based on VISUAL NAMES
  const formulaNames = new Set(formulaCells.map(f => f.name));
  // deps[name] = set of formula-cell Names that this name depends on
  const deps = new Map<string, Set<string>>();
  // dependents[depName] = set of formula-cell Names that depend on depName
  const dependents = new Map<string, Set<string>>();
  
  const allNames = Object.keys(valueMap);

  for (const { name, formula } of formulaCells) {
    const processed = preprocessCellRefs(formula, name);
    const refs = new Set<string>();
    
    for (const m of processed.matchAll(/REF\("([^"]+)"\)/g)) {
      if (formulaNames.has(m[1])) refs.add(m[1]);
    }

    const sumDeps = getSumDependencies(processed, name, allNames);
    for (const dep of sumDeps) {
       if (formulaNames.has(dep)) refs.add(dep);
    }

    const incDeps = getIncDependencies(processed, name, allNames);
    for (const dep of incDeps) {
       if (formulaNames.has(dep)) refs.add(dep);
    }
    deps.set(name, refs);
    for (const dep of refs) {
      if (!dependents.has(dep)) dependents.set(dep, new Set());
      dependents.get(dep)!.add(name);
    }
  }

  // ── Step 3: Kahn's topological sort ────────────────────────────────────────
  const inDeg = new Map<string, number>();
  for (const { name } of formulaCells) inDeg.set(name, deps.get(name)?.size ?? 0);

  const queue = [...formulaNames].filter(name => (inDeg.get(name) ?? 0) === 0);
  const evalOrder: string[] = [];

  while (queue.length > 0) {
    const name = queue.shift()!;
    evalOrder.push(name);
    for (const dep of dependents.get(name) ?? []) {
      const nd = (inDeg.get(dep) ?? 1) - 1;
      inDeg.set(dep, nd);
      if (nd === 0) queue.push(dep);
    }
  }

  // Any formula cell not in evalOrder participates in a cycle
  const cyclicNames = new Set([...formulaNames].filter(name => !evalOrder.includes(name)));

  // ── Step 4: evaluate in topological order, updating valueMap ───────────────
  for (const name of evalOrder) {
    const cellData = formulaCells.find(f => f.name === name)!;
    const result = evaluateFormula(cellData.formula, name, valueMap);
    valueMap[name] = result;
  }
  for (const name of cyclicNames) {
    valueMap[name] = '#CIRCULAR';
  }

  // ── Step 5: rebuild the table tree with updated values ─────────────────────
  // Need to map back using the UUID because the table mapper walks the structure,
  // but valueMap is keyed by visual names.
  // We can build a fast mapping of UUID -> visual name.
  const idToName = new Map<string, string>();
  for (const f of formulaCells) idToName.set(f.id, f.name);

  const applyValues = (t: Table): Table => ({
    ...t,
    rows: t.rows.map(row => ({
      ...row,
      cells: row.cells.map(cell => {
        const isFormulaCell = getCellType(cell.className) === 'formula';
        if (isFormulaCell && cell.text.startsWith('=')) {
          // It's a formula, look up the name to get the evaluated value
          const visualName = idToName.get(cell.id);
          const computedValue = visualName ? valueMap[visualName] : '#ERROR';
          return {
            ...cell,
            value: computedValue ?? '#ERROR',
            className: setCellTypeClass(cell.className || '', 'formula'),
            table: cell.table ? applyValues(cell.table) : undefined,
          };
        }
        return {
          ...cell,
          value: undefined,
          table: cell.table ? applyValues(cell.table) : undefined,
        };
      }),
    })),
  });

  return applyValues(table);
};

export const insertSubTableAtCell = (table: Table, targetCellId: string, subTable: Table): Table => {
  let found = false;
  const traverse = (t: Table): Table => {
    let childModified = false;
    const newRows = t.rows.map(row => {
      let rowModified = false;
      const newCells = row.cells.map(cell => {
        if (cell.id === targetCellId) {
          found = true;
          rowModified = true;
          return { ...cell, table: subTable };
        }
        if (cell.table && !found) {
          const newSubTable = traverse(cell.table);
          if (found && !rowModified) {
            rowModified = true;
            return { ...cell, table: newSubTable };
          }
        }
        return cell;
      });
      if (rowModified) childModified = true;
      return rowModified ? { ...row, cells: newCells } : row;
    });

    return childModified ? { ...t, rows: newRows } : t;
  };

  return traverse(table);
};

export const adjustFormulasAfterStructureChange = (
  oldTable: Table,
  newTable: Table,
  changeInfo?: { type: 'insertRow' | 'deleteRow' | 'insertCol' | 'deleteCol'; index: number }
): Table => {
  // Step 1: Map old cell UUIDs -> visual names (e.g. "cell-123" -> "A.1" or "B.3.A.1")
  const oldIdToName = new Map<string, string>();
  const oldNameToId = new Map<string, string>();

  const walkOld = (t: Table, prefix: string) => {
    t.rows.forEach((row, rIdx) => {
      row.cells.forEach((cell, cIdx) => {
        const colName = t.columns[cIdx];
        const visualName = `${prefix}${colName}.${rIdx + 1}`;
        oldIdToName.set(cell.id, visualName);
        oldNameToId.set(visualName, cell.id);
        if (cell.table) walkOld(cell.table, `${visualName}.`);
      });
    });
  };
  walkOld(oldTable, '');

  // Step 2: Map new cell UUIDs -> new visual names (e.g. "cell-123" -> "A.2")
  const newIdToName = new Map<string, string>();
  const newNameToId = new Map<string, string>();

  const walkNew = (t: Table, prefix: string) => {
    t.rows.forEach((row, rIdx) => {
      row.cells.forEach((cell, cIdx) => {
        const colName = t.columns[cIdx];
        const visualName = `${prefix}${colName}.${rIdx + 1}`;
        newIdToName.set(cell.id, visualName);
        newNameToId.set(visualName, cell.id);
        if (cell.table) walkNew(cell.table, `${visualName}.`);
      });
    });
  };
  walkNew(newTable, '');

  // Auto-detect operation type and 0-based index if changeInfo not provided
  let changeType = changeInfo?.type;
  let changeIndex = changeInfo?.index ?? -1;

  if (!changeType) {
    if (newTable.rows.length === oldTable.rows.length + 1) {
      changeType = 'insertRow';
      changeIndex = newTable.rows.findIndex(r => r.cells[0] && !oldIdToName.has(r.cells[0].id));
    } else if (newTable.rows.length === oldTable.rows.length - 1) {
      changeType = 'deleteRow';
      changeIndex = oldTable.rows.findIndex(r => r.cells[0] && !newIdToName.has(r.cells[0].id));
    } else if (newTable.columns.length === oldTable.columns.length + 1) {
      changeType = 'insertCol';
      changeIndex = newTable.columns.length - 1;
    } else if (newTable.columns.length === oldTable.columns.length - 1) {
      changeType = 'deleteCol';
      if (oldTable.rows[0]) {
        changeIndex = oldTable.rows[0].cells.findIndex(c => !newIdToName.has(c.id));
      }
    }
  }

  // Helper to rewrite a single reference token (e.g. "A.1", "$A.$1", ".A.1", "B.3.A.1")
  const replaceRefToken = (refStr: string, formulaCellId: string): string => {
    const isLocal = refStr.startsWith('.');
    const rawRef = isLocal ? refStr.slice(1) : refStr;
    const cleanVisualName = rawRef.replace(/\$/g, '');

    const formulaOldName = oldIdToName.get(formulaCellId) || '';
    const formulaNewName = newIdToName.get(formulaCellId) || '';

    let targetOldVisual = cleanVisualName;
    if (isLocal) {
      const match = formulaOldName.match(/^(.*\.)?[A-Z]+\.\d+$/);
      const tablePrefix = match ? match[1] || '' : '';
      targetOldVisual = tablePrefix ? `${tablePrefix}${cleanVisualName}` : cleanVisualName;
    }

    const targetCellId = oldNameToId.get(targetOldVisual);
    if (!targetCellId) {
      return refStr; // Ref didn't resolve to a cell before
    }

    const targetNewVisual = newIdToName.get(targetCellId);
    if (!targetNewVisual) {
      return '#REF!'; // Target cell was deleted
    }

    let newCleanRef = targetNewVisual;
    if (isLocal) {
      const match = formulaNewName.match(/^(.*\.)?[A-Z]+\.\d+$/);
      const newTablePrefix = match ? match[1] || '' : '';
      if (newCleanRef.startsWith(newTablePrefix)) {
        newCleanRef = '.' + newCleanRef.slice(newTablePrefix.length);
      }
    }

    // Re-apply $ signs from original reference
    const origSegments = refStr.split('.');
    const newSegments = newCleanRef.split('.');
    if (origSegments.length === newSegments.length) {
      const resSegments = newSegments.map((newSeg, idx) => {
        const origSeg = origSegments[idx];
        const hasColDollar = origSeg.startsWith('$') || origSeg.includes('.$');
        const origRowMatch = origSeg.match(/([A-Z]+)(\$?)(\d+)/);
        const newRowMatch = newSeg.match(/([A-Z]+)(\d+)/);
        if (origRowMatch && newRowMatch) {
          const colDollar = hasColDollar ? '$' : '';
          const rowDollar = origRowMatch[2] === '$' ? '$' : '';
          return `${colDollar}${newRowMatch[1]}.${rowDollar}${newRowMatch[2]}`;
        }
        return hasColDollar ? `$${newSeg}` : newSeg;
      });
      return resSegments.join('.');
    }

    return newCleanRef;
  };

  // Helper to adjust range references inside SUM("A.1", "A.5") per Excel range rules
  const rewriteRangeReference = (startRef: string, endRef: string, formulaCellId: string): string => {
    const sClean = startRef.replace(/["\$]/g, '');
    const eClean = endRef.replace(/["\$]/g, '');

    const parseCell = (addr: string) => {
      const match = addr.match(/^(.*\.)?([A-Z]+)\.(\d+)$/);
      if (!match) return null;
      return { prefix: match[1] || '', col: match[2], row: parseInt(match[3], 10) };
    };

    const s = parseCell(sClean);
    const e = parseCell(eClean);

    if (s && e && s.prefix === e.prefix && s.col === e.col) {
      const col = s.col;
      const prefix = s.prefix;
      const minRow = Math.min(s.row, e.row);
      const maxRow = Math.max(s.row, e.row);

      if (changeType === 'insertRow' && changeIndex !== -1) {
        const insertedRow = changeIndex + 1; // 1-indexed

        if (minRow < insertedRow && insertedRow <= maxRow) {
          // Inserting Inside Range: range expands automatically
          const newStart = replaceRefToken(startRef, formulaCellId);
          const newEnd = `${prefix}${col}.${maxRow + 1}`;
          if (newStart.includes('#REF!')) return 'SUM(#REF!)';
          return `SUM("${newStart}", "${newEnd}")`;
        } else if (insertedRow === minRow) {
          // Inserting at Boundary Start: range does NOT expand to include new row
          return `SUM("${sClean}", "${eClean}")`;
        }
      } else if (changeType === 'deleteRow' && changeIndex !== -1) {
        const deletedRow = changeIndex + 1; // 1-indexed

        if (deletedRow === minRow || deletedRow === maxRow) {
          // Deleting Range Boundary directly -> #REF!
          return 'SUM(#REF!)';
        } else if (minRow < deletedRow && deletedRow < maxRow) {
          // Deleting Inside Range: range contracts automatically
          const newEnd = `${prefix}${col}.${maxRow - 1}`;
          return `SUM("${sClean}", "${newEnd}")`;
        }
      }
    }

    // Default range handling if not special boundary case: update start and end individually
    const newStart = replaceRefToken(startRef, formulaCellId);
    const newEnd = replaceRefToken(endRef, formulaCellId);

    if (newStart.includes('#REF!') || newEnd.includes('#REF!')) {
      return 'SUM(#REF!)';
    }
    return `SUM("${newStart}", "${newEnd}")`;
  };

  // Helper to rewrite formula string for a cell
  const rewriteFormula = (formula: string, formulaCellId: string): string => {
    if (!formula.startsWith('=')) return formula;

    const strings: string[] = [];
    let textToProcess = formula.replace(/"([^"]*)"/g, (match) => {
      strings.push(match);
      return `__S${strings.length - 1}__`;
    });

    // Process SUM("start", "end") ranges
    textToProcess = textToProcess.replace(/SUM\(\s*__S(\d+)__\s*,\s*__S(\d+)__\s*\)/ig, (match, idx1, idx2) => {
      const sStr = strings[parseInt(idx1, 10)]?.replace(/^"|"$/g, '');
      const eStr = strings[parseInt(idx2, 10)]?.replace(/^"|"$/g, '');
      if (sStr && eStr && /^\$?[A-Z]+\.\$?\d+(?:\.\$?[A-Z]+\.\$?\d+)*$/.test(sStr) && /^\$?[A-Z]+\.\$?\d+(?:\.\$?[A-Z]+\.\$?\d+)*$/.test(eStr)) {
        return rewriteRangeReference(sStr, eStr, formulaCellId);
      }
      return match;
    });

    // 1. Local shorthand: .A.1 or .$A.$1
    textToProcess = textToProcess.replace(/(^|[^\d])\.(\$?[A-Z]+\.\$?\d+)/g, (_, prev, localPart) => {
      const updated = replaceRefToken('.' + localPart, formulaCellId);
      return `${prev}${updated}`;
    });

    // 2. Standard refs: A.1, B.3.A.1, $A.$1
    textToProcess = textToProcess.replace(/(^|[^A-Z0-9\."])(\$?[A-Z]+\.\$?\d+(?:\.\$?[A-Z]+\.\$?\d+)*)/g, (_, prev, match) => {
      const updated = replaceRefToken(match, formulaCellId);
      return `${prev}${updated}`;
    });

    // Restore protected string literals
    return textToProcess.replace(/__S(\d+)__/g, (_, idx) => strings[parseInt(idx, 10)]);
  };

  // Step 4: Traverse newTable and update all formula cell texts
  const updateTree = (t: Table): Table => ({
    ...t,
    rows: t.rows.map(row => ({
      ...row,
      cells: row.cells.map(cell => {
        let newText = cell.text;
        if (cell.text.startsWith('=')) {
          newText = rewriteFormula(cell.text, cell.id);
        }
        return {
          ...cell,
          text: newText,
          table: cell.table ? updateTree(cell.table) : undefined,
        };
      }),
    })),
  });

  return updateTree(newTable);
};

export type HeadingStyle = 'none' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export const getCellStyle = (className?: string): HeadingStyle => {
  if (!className) return 'none';
  const classes = className.split(/\s+/);
  for (const h of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as HeadingStyle[]) {
    if (classes.includes(h)) return h;
  }
  return 'none';
};

export const setCellStyleClass = (currentClassName: string = '', newStyle: HeadingStyle): string => {
  const HEADING_CLASSES = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  const classes = currentClassName.split(/\s+/).filter(c => c && !HEADING_CLASSES.has(c));
  if (newStyle !== 'none') {
    classes.push(newStyle);
  }
  return classes.join(' ');
};

export const updateCellStyleInTree = (
  table: Table,
  cellId: string,
  newStyle: HeadingStyle
): Table => {
  return {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        if (cell.id === cellId) {
          return {
            ...cell,
            className: setCellStyleClass(cell.className || '', newStyle),
          };
        }
        if (cell.table) {
          return {
            ...cell,
            table: updateCellStyleInTree(cell.table, cellId, newStyle),
          };
        }
        return cell;
      }),
    })),
  };
};

/**
 * Recursively collect all cell IDs inside a cell (including nested sub-tables).
 */
export const getAllCellIdsInCell = (cell: Cell): string[] => {
  const ids: string[] = [cell.id];
  if (cell.table) {
    ids.push(...getAllCellIdsInTable(cell.table));
  }
  return ids;
};

/**
 * Recursively collect all cell IDs inside a table.
 */
export const getAllCellIdsInTable = (table: Table): string[] => {
  const ids: string[] = [];
  table.rows.forEach(row => {
    row.cells.forEach(cell => {
      ids.push(...getAllCellIdsInCell(cell));
    });
  });
  return ids;
};

/**
 * Find the row containing cellId and return all cell IDs in that row.
 */
export const getRowCellIds = (table: Table, cellId: string): string[] => {
  const findInTable = (t: Table): string[] | null => {
    for (const row of t.rows) {
      const hasCell = row.cells.some(c => c.id === cellId);
      if (hasCell) {
        const ids: string[] = [];
        row.cells.forEach(c => ids.push(...getAllCellIdsInCell(c)));
        return ids;
      }
      for (const c of row.cells) {
        if (c.table) {
          const res = findInTable(c.table);
          if (res) return res;
        }
      }
    }
    return null;
  };

  return findInTable(table) ?? [];
};

/**
 * Find the containing table and column index of cellId, and return all cell IDs in that column.
 */
export const getColumnCellIds = (table: Table, cellId: string): string[] => {
  const findInTable = (t: Table): string[] | null => {
    for (const row of t.rows) {
      const colIdx = row.cells.findIndex(c => c.id === cellId);
      if (colIdx !== -1) {
        const ids: string[] = [];
        t.rows.forEach(r => {
          if (r.cells[colIdx]) {
            ids.push(...getAllCellIdsInCell(r.cells[colIdx]));
          }
        });
        return ids;
      }
      for (const c of row.cells) {
        if (c.table) {
          const res = findInTable(c.table);
          if (res) return res;
        }
      }
    }
    return null;
  };

  return findInTable(table) ?? [];
};

/**
 * Find the containing table (or sub-table) of cellId and return all cell IDs in that table.
 */
export const getTableCellIds = (table: Table, cellId: string): string[] => {
  const findInTable = (t: Table): string[] | null => {
    const directChild = t.rows.some(r => r.cells.some(c => c.id === cellId));
    if (directChild) {
      return getAllCellIdsInTable(t);
    }
    for (const r of t.rows) {
      for (const c of r.cells) {
        if (c.table) {
          const res = findInTable(c.table);
          if (res) return res;
        }
      }
    }
    return null;
  };

  return findInTable(table) ?? [];
};

/**
 * Cell alignment utilities
 */
export type CellAlignment = 'left' | 'center' | 'right' | 'default';

export const getCellAlignment = (className?: string): CellAlignment => {
  if (!className) return 'default';
  const classes = className.split(' ');
  if (classes.includes('align-center')) return 'center';
  if (classes.includes('align-right')) return 'right';
  if (classes.includes('align-left')) return 'left';
  return 'default';
};

export const setCellAlignmentClass = (
  className: string,
  alignment: CellAlignment
): string => {
  const classes = (className || '')
    .split(' ')
    .filter((c) => Boolean(c) && !c.startsWith('align-'));
  if (alignment !== 'default') {
    classes.push(`align-${alignment}`);
  }
  return classes.join(' ');
};

export const updateCellAlignmentInTree = (
  table: Table,
  cellIds: Set<string>,
  alignment: CellAlignment
): Table => {
  return {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        let updatedCell = cell;
        if (cellIds.has(cell.id)) {
          updatedCell = {
            ...updatedCell,
            className: setCellAlignmentClass(updatedCell.className || '', alignment),
          };
        }
        if (cell.table) {
          updatedCell = {
            ...updatedCell,
            table: updateCellAlignmentInTree(cell.table, cellIds, alignment),
          };
        }
        return updatedCell;
      }),
    })),
  };
};


