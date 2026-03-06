import type { Table, Row } from '../types/document';
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
            const prefix = t.id === 'document' ? '' : `${t.id}.`;
            const newCellId = `${prefix}${nextColName}.${r.id}`;
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
        // create new row below the LAST row to maintain 1, 2, 3 ordering
        const lastRow = t.rows[t.rows.length - 1];
        const nextRowId = getNextRowId(lastRow.id);
        const newRowCells = t.columns.map((colName, cIdx2) => {
           const prefix = t.id === 'document' ? '' : `${t.id}.`;
           const newCellId = `${prefix}${colName}.${nextRowId}`;
           if (colName === t.columns[cIdx]) {
              newActiveCellId = newCellId;
           }
           
           const cellAbove = lastRow.cells[cIdx2];
           let newText = '';
           let newClassName = cellAbove?.className;

           if (cellAbove) {
             if (cellAbove.text.startsWith('=')) {
               // Formula cell: copy the formula as-is
               newText = cellAbove.text;
               newClassName = setCellTypeClass(cellAbove.className || '', 'formula');
             } else if (
               cellAbove.className?.includes('number') &&
               cellAbove.text.trim() !== '' &&
               Number.isInteger(Number(cellAbove.text))
             ) {
               // Integer number: produce a formula that increments from the cell above
               // The cell above is in lastRow; its id already encodes col.row
               const localRef =
                  t.id !== 'document' && cellAbove.id.startsWith(t.id + '.')
                    ? '.' + cellAbove.id.slice(t.id.length + 1)
                    : cellAbove.id;
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
          const subTableId = cell.id;
          const newCellId = `${subTableId}.A.1`;
          newActiveCellId = newCellId;
          
          const newSubTable: Table = {
            id: subTableId,
            columns: ["A"],
            rows: [
              {
                id: "1",
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

export const deleteRow = (table: Table, cellId: string): Table => {
  const traverse = (t: Table): Table => {
    // If the cell is in this table, remove its row
    const targetRowIdx = t.rows.findIndex(r => r.cells.some(c => c.id === cellId));
    if (targetRowIdx !== -1) {
      if (t.rows.length <= 1) return t; // Don't delete last row
      const newRows = [...t.rows];
      newRows.splice(targetRowIdx, 1);
      return { ...t, rows: newRows };
    }
    // Else recurse
    let modified = false;
    const newRows = t.rows.map(row => {
      let rowModified = false;
      const newCells = row.cells.map(cell => {
        if (cell.table) {
          const newSubTable = traverse(cell.table);
          if (newSubTable !== cell.table) {
            rowModified = true;
            return { ...cell, table: newSubTable };
          }
        }
        return cell;
      });
      if (rowModified) modified = true;
      return rowModified ? { ...row, cells: newCells } : row;
    });
    return modified ? { ...t, rows: newRows } : t;
  };
  return traverse(table);
};

export const deleteColumn = (table: Table, cellId: string): Table => {
  const traverse = (t: Table): Table => {
    const targetRow = t.rows.find(r => r.cells.some(c => c.id === cellId));
    if (targetRow) {
      const targetColIdx = targetRow.cells.findIndex(c => c.id === cellId);
      if (t.columns.length <= 1) return t; // Don't delete last column
      const newCols = [...t.columns];
      newCols.splice(targetColIdx, 1);
      const newRows = t.rows.map(r => {
        const newCells = [...r.cells];
        newCells.splice(targetColIdx, 1);
        return { ...r, cells: newCells };
      });
      return { ...t, columns: newCols, rows: newRows };
    }
    let modified = false;
    const newRows = t.rows.map(row => {
      let rowModified = false;
      const newCells = row.cells.map(cell => {
        if (cell.table) {
          const newSubTable = traverse(cell.table);
          if (newSubTable !== cell.table) {
            rowModified = true;
            return { ...cell, table: newSubTable };
          }
        }
        return cell;
      });
      if (rowModified) modified = true;
      return rowModified ? { ...row, cells: newCells } : row;
    });
    return modified ? { ...t, rows: newRows } : t;
  };
  return traverse(table);
};

export const deleteTable = (table: Table, cellId: string): Table => {
  const traverse = (t: Table): Table => {
    let modified = false;
    const newRows = t.rows.map(row => {
      let rowModified = false;
      const newCells = row.cells.map(cell => {
        // If THIS cell's table contains the currently right-clicked cell
        if (cell.table) {
          const tableContainsCell = (() => {
            let found = false;
            const search = (tbl: Table) => {
              for (const r of tbl.rows) {
                for (const c of r.cells) {
                  if (c.id === cellId) found = true;
                  if (c.table && !found) search(c.table);
                }
              }
            };
            search(cell.table);
            return found;
          })();

          if (tableContainsCell && cell.table.id === getTablePrefix(cellId)) {
             // If we found the exact cell inside this cell.table, and the cell is at the top level of THIS table.
             // Actually, the simplest rule: The user right-clicked a cell. We want to delete the sub-table that contains this cell.
             // Wait, the specification is "supprimer la ligne, la colonne ou la table". If the cell is in a sub-table, delete the sub-table. If it's the root table, maybe we can't delete it.
             rowModified = true;
             return { ...cell, table: undefined }; 
          } else {
             const newSubTable = traverse(cell.table);
             if (newSubTable !== cell.table) {
               rowModified = true;
               return { ...cell, table: newSubTable };
             }
          }
        }
        return cell;
      });
      if (rowModified) modified = true;
      return rowModified ? { ...row, cells: newCells } : row;
    });
    return modified ? { ...t, rows: newRows } : t;
  };
  return traverse(table);
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

export const getCellType = (className?: string): 'text' | 'number' | 'formula' => {
  if (!className) return 'text';
  if (className.includes('formula')) return 'formula';
  if (className.includes('number')) return 'number';
  return 'text';
};

export const setCellTypeClass = (className: string = '', newType: 'text' | 'number' | 'formula'): string => {
  const classes = className.split(' ').filter(c => c && c !== 'text' && c !== 'number' && c !== 'formula');
  if (newType !== 'text') {
    classes.push(newType);
  } else {
    // We can explicitly add 'text' for styling guarantees
    classes.push('text');
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

  // 1. Local shorthand: a dot NOT preceded by a digit, followed by ColLetter.RowNum
  //    Example:  .A.2  →  REF("B.3.A.2")  (when in table B.3)
  //    Negative lookbehind (?<!\d) ensures ".A.2" inside "B.3.A.2" is NOT matched here.
  processed = processed.replace(/(?<!\d)\.(\$?[A-Z]+\.\$?\d+)/g, (_, localPart) => {
    const lookupId = (tablePrefix ? tablePrefix + '.' : '') + localPart.replace(/\$/g, '');
    return `REF("${lookupId}")`;
  });

  // 2. Full chained (or simple) refs: A.1, B.3.A.2, $C.$3, $B.3.$A.$2 …
  //    Greedy multi-segment match: ColLetter.RowNum (. ColLetter.RowNum)*
  //    We add negative lookbehind (?<!REF\("|[A-Z0-9\.]) to avoid double-replacing refs already processed in step 1,
  //    or matching inside larger identifiers.
  processed = processed.replace(/(?<!REF\("|[A-Z0-9\.])\$?[A-Z]+\.\$?\d+(?:\.\$?[A-Z]+\.\$?\d+)*/g, (match) => {
    const cellId = match.replace(/\$/g, '');
    return `REF("${cellId}")`;
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

/** Build a flat map of cellId → current display value for the whole table tree */
export const buildValueMap = (table: Table): Record<string, string> => {
  const map: Record<string, string> = {};
  const walk = (t: Table) => {
    t.rows.forEach(row => row.cells.forEach(cell => {
      map[cell.id] = cell.value ?? cell.text;
      if (cell.table) walk(cell.table);
    }));
  };
  walk(table);
  return map;
};

export const evaluateFormula = (
  formula: string,
  cellId = '',
  valueMap: Record<string, string> = {}
): string => {
  try {
    const { COLUMN, ROW, NAME, REF } = makeFunctions(cellId, (id) => valueMap[id] ?? '');
    const processed = preprocessCellRefs(formula, cellId); // pass cellId for local ref resolution
    // eslint-disable-next-line no-new-func
    const result = Function('COLUMN', 'ROW', 'NAME', 'REF', '"use strict"; return (' + processed.slice(1) + ')')(COLUMN, ROW, NAME, REF);
    return String(result);
  } catch {
    return '#ERROR';
  }
};

/**
 * Recalculate all formula cells in dependency order (topological sort).
 * Formula cells that form a cycle are marked with #CIRCULAR.
 */
export const recalculateTable = (table: Table): Table => {
  // ── Step 1: collect all cells into a flat map ──────────────────────────────
  const valueMap: Record<string, string> = {};
  const formulaCells: { id: string; formula: string }[] = [];

  const collectCells = (t: Table) => {
    t.rows.forEach(row => row.cells.forEach(cell => {
      if (cell.text.startsWith('=')) {
        formulaCells.push({ id: cell.id, formula: cell.text });
        valueMap[cell.id] = cell.value ?? '';   // seed with previous value
      } else {
        valueMap[cell.id] = cell.text;
      }
      if (cell.table) collectCells(cell.table);
    }));
  };
  collectCells(table);

  // ── Step 2: build dependency graph ─────────────────────────────────────────
  const formulaIds = new Set(formulaCells.map(f => f.id));
  // deps[id] = set of formula-cell IDs that id depends on
  const deps = new Map<string, Set<string>>();
  // dependents[dep] = set of formula-cell IDs that depend on dep
  const dependents = new Map<string, Set<string>>();

  for (const { id, formula } of formulaCells) {
    const processed = preprocessCellRefs(formula, id);
    const refs = new Set<string>();
    for (const m of processed.matchAll(/REF\("([^"]+)"\)/g)) {
      if (formulaIds.has(m[1])) refs.add(m[1]);
    }
    deps.set(id, refs);
    for (const dep of refs) {
      if (!dependents.has(dep)) dependents.set(dep, new Set());
      dependents.get(dep)!.add(id);
    }
  }

  // ── Step 3: Kahn's topological sort ────────────────────────────────────────
  const inDeg = new Map<string, number>();
  for (const { id } of formulaCells) inDeg.set(id, deps.get(id)?.size ?? 0);

  const queue = [...formulaIds].filter(id => (inDeg.get(id) ?? 0) === 0);
  const evalOrder: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    evalOrder.push(id);
    for (const dep of dependents.get(id) ?? []) {
      const nd = (inDeg.get(dep) ?? 1) - 1;
      inDeg.set(dep, nd);
      if (nd === 0) queue.push(dep);
    }
  }

  // Any formula cell not in evalOrder participates in a cycle
  const cyclicIds = new Set([...formulaIds].filter(id => !evalOrder.includes(id)));

  // ── Step 4: evaluate in topological order, updating valueMap ───────────────
  for (const id of evalOrder) {
    const formula = formulaCells.find(f => f.id === id)!.formula;
    const result = evaluateFormula(formula, id, valueMap);
    valueMap[id] = result;
  }
  for (const id of cyclicIds) {
    valueMap[id] = '#CIRCULAR';
  }

  // ── Step 5: rebuild the table tree with updated values ─────────────────────
  const applyValues = (t: Table): Table => ({
    ...t,
    rows: t.rows.map(row => ({
      ...row,
      cells: row.cells.map(cell => {
        if (cell.text.startsWith('=')) {
          return {
            ...cell,
            value: valueMap[cell.id] ?? '#ERROR',
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
