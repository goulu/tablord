import { describe, it, expect } from 'vitest';
import { initialDocument, type Table } from '../types/document';
import { recalculateTable } from './tableUtils';

const updateCellText = (table: Table, cellId: string, newText: string): Table => {
  const updated = {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        if (cell.id === cellId) {
          return { ...cell, text: newText, className: newText.startsWith('=') ? 'formula' : 'number' };
        }
        return cell;
      }),
    })),
  };
  return recalculateTable(updated);
};

describe('SUM function', () => {
  it('should sum explicit ranges', () => {
    let doc = { ...initialDocument };
    doc = updateCellText(doc, doc.rows[0].cells[0].id, '10');
    
    // Add 2 more rows
    doc.rows.push(
      { id: '2', cells: [{ id: 'a2', text: '20', className: 'number' }] },
      { id: '3', cells: [{ id: 'a3', text: '30', className: 'number' }] },
      { id: '4', cells: [{ id: 'a4', text: '=SUM("A.1", "A.3")', className: 'formula' }] }
    );
    
    doc = recalculateTable(doc);
    expect(doc.rows[3].cells[0].value).toBe('60'); // 10+20+30
  });

  it('should sum implicitly all numbers above', () => {
    let doc = { ...initialDocument };
    doc = updateCellText(doc, doc.rows[0].cells[0].id, '5');
    
    // Add 2 more rows
    doc.rows.push(
      { id: '2', cells: [{ id: 'a2', text: '15', className: 'number' }] },
      { id: '3', cells: [{ id: 'a3', text: 'TEXT', className: 'text' }] }, // should be ignored
      { id: '4', cells: [{ id: 'a4', text: '=SUM()', className: 'formula' }] }
    );
    
    doc = recalculateTable(doc);
    expect(doc.rows[3].cells[0].value).toBe('20'); // 5+15
  });
});
