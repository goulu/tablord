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
               newText = `=${cellAbove.id}+1`;
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
 * Pre-process a formula string: replace Excel-style cell references
 * (A.1, B.$2, $C.3, $C.$2) with REF("A.1") calls.
 * String literals are protected so COLUMN("B.4") is not affected.
 */
export const preprocessCellRefs = (formula: string): string => {
  const strings: string[] = [];
  // Protect quoted strings
  let processed = formula.replace(/"[^"]*"/g, (match) => {
    strings.push(match);
    return `__S${strings.length - 1}__`;
  });
  // Replace $?ColLetter.$?RowDigits with REF("Col.Row")
  processed = processed.replace(/\$?([A-Z]+)\.\$?(\d+)/g, (_, col, row) => `REF("${col}.${row}")`);
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
    const processed = preprocessCellRefs(formula);
    // eslint-disable-next-line no-new-func
    const result = Function('COLUMN', 'ROW', 'NAME', 'REF', '"use strict"; return (' + processed.slice(1) + ')')(COLUMN, ROW, NAME, REF);
    return String(result);
  } catch {
    return '#ERROR';
  }
};

export const recalculateTable = (table: Table): Table => {
  // First pass: build a value map using current cell values (pre-recalc)
  const valueMap = buildValueMap(table);

  const walk = (t: Table): Table => ({
    ...t,
    rows: t.rows.map(row => ({
      ...row,
      cells: row.cells.map(cell => {
        if (cell.text.startsWith('=')) {
          const newValue = evaluateFormula(cell.text, cell.id, valueMap);
          // Update the map so later formula cells can reference this result
          valueMap[cell.id] = newValue;
          return {
            ...cell,
            value: newValue,
            className: setCellTypeClass(cell.className || '', 'formula'),
            table: cell.table ? walk(cell.table) : undefined,
          };
        }
        return {
          ...cell,
          value: undefined,
          table: cell.table ? walk(cell.table) : undefined,
        };
      }),
    })),
  });

  return walk(table);
};
