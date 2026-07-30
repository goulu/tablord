import { describe, it, expect } from 'vitest';
import { initialDocument, type Table } from '../src/types/document';
import { handleEnter, getCellNameById, recalculateTable, buildValueMap, getCellType, setCellTypeClass, evaluateFormula } from '../src/utils/tableUtils';

const updateCellText = (table: Table, cellId: string, newText: string): Table => {
  const valueMap = buildValueMap(table);
  const updated = {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        if (cell.id === cellId) {
          if (newText.startsWith('=')) {
            const visualName = getCellNameById(table, cellId) || '';
            const evaluated = evaluateFormula(newText, visualName, valueMap);
            return { ...cell, text: newText, value: evaluated, className: setCellTypeClass(cell.className, 'formula') };
          }
          let newTypeStr = getCellType(cell.className) === 'formula' ? 'text' : getCellType(cell.className);
          if (newText.trim() !== '') {
            if (!isNaN(Number(newText))) {
              newTypeStr = 'number';
            } else if (newTypeStr === 'number') {
               newTypeStr = 'text';
            }
          } else {
             newTypeStr = 'text';
          }
          return { ...cell, text: newText, value: undefined, className: setCellTypeClass(cell.className, newTypeStr) };
        }
        if (cell.table) {
          return { ...cell, table: updateCellText(cell.table, cellId, newText) };
        }
        return cell;
      }),
    })),
  };
  return recalculateTable(updated);
};

describe('handleEnter auto increment bug', () => {
  it('should auto-increment when pressing Enter after typing a number in an empty cell', () => {
    let doc = { ...initialDocument };
    const a1Id = doc.rows[0].cells[0].id;
    
    // Simulate App.tsx updateCellText from DOM when typing '1'
    doc = updateCellText(doc, a1Id, '1');
    expect(doc.rows[0].cells[0].text).toBe('1');
    expect(doc.rows[0].cells[0].className).toContain('number');

    // Simulate handleEnter
    const { newTable } = handleEnter(doc, a1Id);
    doc = recalculateTable(newTable);
    
    expect(doc.rows.length).toBe(2);
    
    const newCell = doc.rows[1].cells[0];
    expect(newCell.text).toBe('=A.1+1');
    expect(newCell.className).toContain('formula');
  });
});
