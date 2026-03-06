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

describe('SUM function bug', () => {
  it('should sum C.1 and C.3', () => {
    let doc = { ...initialDocument, columns: ['A', 'B', 'C'] };
    doc.rows[0].cells.push({ id: 'b1', text: '' }, { id: 'c1', text: '10', className: 'number' });
    
    doc.rows.push(
      { id: '2', cells: [{ id: 'a2', text: '' }, { id: 'b2', text: '' }, { id: 'c2', text: '20', className: 'number' }] },
      { id: '3', cells: [{ id: 'a3', text: '' }, { id: 'b3', text: '' }, { id: 'c3', text: '30', className: 'number' }] },
      { id: '4', cells: [{ id: 'a4', text: '' }, { id: 'b4', text: '' }, { id: 'c4', text: '=SUM(C.1, C.3)', className: 'formula' }] },
      { id: '5', cells: [{ id: 'a5', text: '' }, { id: 'b5', text: '' }, { id: 'c5', text: '=SUM()', className: 'formula' }] }
    );
    
    doc = recalculateTable(doc);
    expect(doc.rows[3].cells[2].value).toBe('60'); // 10+20+30
    expect(doc.rows[4].cells[2].value).toBe('120'); // 10+20+30+60
  });
});
