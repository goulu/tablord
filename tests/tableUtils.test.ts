import { describe, it, expect } from 'vitest';
import { initialDocument } from '../src/types/document';
import { 
  handleTab, handleEnter, getCellType, setCellTypeClass, getCellNameById, 
  deleteRow, deleteColumn, deleteTable, getCellStyle, setCellStyleClass, 
  getRowCellIds, getColumnCellIds, getTableCellIds,
  getCellAlignment, setCellAlignmentClass, updateCellAlignmentInTree, getCellsByIds
} from '../src/utils/tableUtils';

describe('Table navigation and cell typing logic', () => {

  it('getCellType should extract the type correctly', () => {
    expect(getCellType('number bold')).toBe('number');
    expect(getCellType('text')).toBe('text');
    expect(getCellType('')).toBe('text');
    expect(getCellType('formula')).toBe('formula');
  });

  it('setCellTypeClass should add or replace the class correctly', () => {
    expect(setCellTypeClass('', 'number')).toBe('number');
    expect(setCellTypeClass('bold', 'number')).toBe('bold number');
    expect(setCellTypeClass('number bold', 'text')).toBe('bold text');
  });

  it('getCellStyle and setCellStyleClass should handle heading styles correctly', () => {
    expect(getCellStyle('text h1')).toBe('h1');
    expect(getCellStyle('number h2 bold')).toBe('h2');
    expect(getCellStyle('text h4')).toBe('h4');
    expect(getCellStyle('text h6')).toBe('h6');
    expect(getCellStyle('text')).toBe('none');

    expect(setCellStyleClass('text', 'h1')).toBe('text h1');
    expect(setCellStyleClass('text h1', 'h2')).toBe('text h2');
    expect(setCellStyleClass('text h2', 'h5')).toBe('text h5');
    expect(setCellStyleClass('bold text h3', 'none')).toBe('bold text');
  });

  it('should auto-increment numbers when creating new rows via Enter', () => {
    let doc = { ...initialDocument };
    const a1Id = doc.rows[0].cells[0].id;
    // Simulate setting A.1 to "1" with type "number"
    doc.rows[0].cells[0] = { ...doc.rows[0].cells[0], text: "1", className: "number" };

    // Set active cell to A.1 to trigger Enter
    const { newTable, newActiveCellId } = handleEnter(doc, a1Id);
    
    // newTable should have 2 rows
    expect(newTable.rows.length).toBe(2);
    expect(getCellNameById(newTable, newActiveCellId)).toBe("A.2");

    const newCell = newTable.rows[1].cells[0];
    // Now produces a formula referencing the cell above instead of a plain incremented value
    expect(newCell.text).toBe('=A.1+1');
    expect(newCell.className).toContain('formula');
  });

  it('should preserve type when hitting Tab, creating a new column, and hitting Enter', () => {
    let doc = { ...initialDocument };
    const a1Id = doc.rows[0].cells[0].id;
    // A.1 = "1"
    doc.rows[0].cells[0] = { ...doc.rows[0].cells[0], text: "1", className: "number" };

    // user hits Tab inside A.1
    const resTab = handleTab(doc, a1Id);
    doc = resTab.newTable;
    
    // now we have columns A, B. active cell is B.1. A.1 should still be "1" and "number"
    expect(doc.columns).toEqual(["A", "B"]);
    expect(doc.rows[0].cells[0].className).toBe("number");
    expect(doc.rows[0].cells[0].text).toBe("1");
    expect(getCellNameById(doc, doc.rows[0].cells[1].id)).toBe("B.1");

    // B.1 = "test"
    doc.rows[0].cells[1] = { ...doc.rows[0].cells[1], text: "test", className: "text" };

    // user hits Enter inside B.1
    const resEnter = handleEnter(doc, doc.rows[0].cells[1].id);
    doc = resEnter.newTable;

    // Check row 2 (index 1)
    expect(doc.rows.length).toBe(2);
    expect(doc.rows[1].cells.length).toBe(2);
    
    const a2 = doc.rows[1].cells[0];
    const b2 = doc.rows[1].cells[1];
    
    // A.2 should have a formula referencing A.1
    expect(getCellNameById(doc, a2.id)).toBe('A.2');
    expect(a2.text).toBe('=A.1+1');
    expect(a2.className).toContain('formula');

    // B.2 should be "" and "text"
    expect(getCellNameById(doc, b2.id)).toBe("B.2");
    expect(b2.text).toBe("");
    expect(b2.className).toContain("text");
  });

  it('deleting table on root table empties document to a single cell', () => {
    const doc = { ...initialDocument };
    const cellId = doc.rows[0].cells[0].id;
    const result = deleteTable(doc, cellId);
    expect(result.columns).toEqual(['A']);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].cells.length).toBe(1);
    expect(result.rows[0].cells[0].text).toBe('');
  });

  it('deleting single remaining column or row on root table empties document to a single cell', () => {
    const doc = { ...initialDocument };
    const cellId = doc.rows[0].cells[0].id;
    
    const delCol = deleteColumn(doc, cellId);
    expect(delCol.columns).toEqual(['A']);
    expect(delCol.rows.length).toBe(1);

    const delRow = deleteRow(doc, cellId);
    expect(delRow.columns).toEqual(['A']);
    expect(delRow.rows.length).toBe(1);
  });

  it('collects cell IDs for row, column, and table selection', () => {
    const table = {
      id: 'root',
      columns: ['A', 'B'],
      rows: [
        {
          id: 'r1',
          cells: [
            { id: 'c1', text: '1', className: 'text' },
            { id: 'c2', text: '2', className: 'text' }
          ]
        },
        {
          id: 'r2',
          cells: [
            { id: 'c3', text: '3', className: 'text' },
            { id: 'c4', text: '4', className: 'text' }
          ]
        }
      ]
    };

    expect(getRowCellIds(table, 'c1')).toEqual(['c1', 'c2']);
    expect(getColumnCellIds(table, 'c1')).toEqual(['c1', 'c3']);
    expect(getTableCellIds(table, 'c1')).toEqual(['c1', 'c2', 'c3', 'c4']);
  });

  it('handles cell alignment classes correctly', () => {
    expect(getCellAlignment('text align-center')).toBe('center');
    expect(getCellAlignment('number align-right')).toBe('right');
    expect(getCellAlignment('markdown align-left')).toBe('left');
    expect(getCellAlignment('text')).toBe('default');

    expect(setCellAlignmentClass('text', 'center')).toBe('text align-center');
    expect(setCellAlignmentClass('text align-left', 'right')).toBe('text align-right');
    expect(setCellAlignmentClass('text align-right', 'default')).toBe('text');

    const table = {
      id: 'root',
      columns: ['A', 'B'],
      rows: [
        {
          id: 'r1',
          cells: [
            { id: 'c1', text: '1', className: 'text' },
            { id: 'c2', text: '2', className: 'text' }
          ]
        }
      ]
    };

    const updated = updateCellAlignmentInTree(table, new Set(['c1', 'c2']), 'center');
    expect(updated.rows[0].cells[0].className).toBe('text align-center');
    expect(updated.rows[0].cells[1].className).toBe('text align-center');

    const fetchedCells = getCellsByIds(updated, new Set(['c1', 'c2']));
    expect(fetchedCells.length).toBe(2);
    expect(fetchedCells.every(c => getCellAlignment(c.className) === 'center')).toBe(true);
  });

});
