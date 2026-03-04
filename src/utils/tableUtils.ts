import type { Table, Row } from '../types/document';

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
            const prefix = t.id === 'document' ? '' : `${t.id}_`;
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
        const nextRowId = getNextRowId(t.rows[t.rows.length - 1].id);
        const newRowCells = t.columns.map(colName => {
           const prefix = t.id === 'document' ? '' : `${t.id}_`;
           const newCellId = `${prefix}${colName}.${nextRowId}`;
           if (colName === t.columns[cIdx]) {
              newActiveCellId = newCellId;
           }
           return { id: newCellId, text: "" };
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
          const newCellId = `${subTableId}_A.1`;
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
