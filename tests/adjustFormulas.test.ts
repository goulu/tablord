import { describe, it, expect } from 'vitest';
import { initialDocument, type Table } from '../src/types/document';
import { 
  deleteRow, deleteColumn, handleEnter, recalculateTable, 
  adjustFormulasAfterStructureChange 
} from '../src/utils/tableUtils';

const createTestDoc = (): Table => structuredClone(initialDocument);

describe('adjustFormulasAfterStructureChange (Excel Rules)', () => {
  it('shifts single cell references when a row above is deleted', () => {
    let doc = createTestDoc();
    doc.columns = ['A', 'B'];
    const a1Id = doc.rows[0].cells[0].id;
    doc.rows[0].cells[0] = { ...doc.rows[0].cells[0], text: '10', className: 'number' };
    doc.rows[0].cells.push({ id: 'b1', text: '20', className: 'number' });

    doc.rows.push({
      id: 'r2',
      cells: [
        { id: 'a2', text: '100', className: 'number' },
        { id: 'b2', text: '=A.1+5', className: 'formula' }
      ]
    });

    doc = recalculateTable(doc);
    expect(doc.rows[1].cells[1].value).toBe('15');

    // Delete Row 1 (containing a1Id) -> a1Id deleted -> #REF!
    const newDoc = deleteRow(doc, a1Id);
    const adjusted = adjustFormulasAfterStructureChange(doc, newDoc);

    expect(adjusted.rows[0].cells[1].text).toBe('=#REF!+5');
  });

  it('shifts single cell references when target cell shifts position', () => {
    let doc = createTestDoc();
    doc.columns = ['A', 'B'];
    const a1Id = doc.rows[0].cells[0].id;
    doc.rows[0].cells[0] = { ...doc.rows[0].cells[0], text: '10', className: 'number' };
    doc.rows[0].cells.push({ id: 'b1', text: '20', className: 'number' });

    doc.rows.push(
      {
        id: 'r2',
        cells: [
          { id: 'a2', text: '100', className: 'number' },
          { id: 'b2', text: '200', className: 'number' }
        ]
      },
      {
        id: 'r3',
        cells: [
          { id: 'a3', text: '300', className: 'number' },
          { id: 'b3', text: '=A.2+5', className: 'formula' }
        ]
      }
    );

    doc = recalculateTable(doc);

    // Delete Row 1 (a1Id). Row 2 (a2) shifts to Row 1 (A.1).
    const newDoc = deleteRow(doc, a1Id);
    const adjusted = adjustFormulasAfterStructureChange(doc, newDoc);

    const b2New = adjusted.rows[1].cells[1];
    expect(b2New.text).toBe('=A.1+5');
  });

  it('expands range automatically when inserting inside range', () => {
    // Range is SUM("A.1", "A.5") in 5 rows
    let doc = createTestDoc();
    doc.columns = ['A'];
    doc.rows[0].cells[0] = { ...doc.rows[0].cells[0], text: '10', className: 'number' };
    for (let r = 2; r <= 5; r++) {
      doc.rows.push({
        id: `r${r}`,
        cells: [{ id: `a${r}`, text: `${r * 10}`, className: 'number' }]
      });
    }
    doc.rows.push({
      id: 'r6',
      cells: [{ id: 'a6', text: '=SUM("A.1", "A.5")', className: 'formula' }]
    });

    doc = recalculateTable(doc);

    // Insert row at row 3 (inside 1..5)
    const { newTable } = handleEnter(doc, doc.rows[1].cells[0].id); // Enter on A.2 -> inserts at index 2 (row 3)
    const adjusted = adjustFormulasAfterStructureChange(doc, newTable);

    // Range should expand from 1..5 to 1..6! Formula cell moved to index 6 (row 7)
    const formulaCell = adjusted.rows[6].cells[0];
    expect(formulaCell.text).toBe('=SUM("A.1", "A.6")');
  });

  it('does not expand range when inserting at boundary start', () => {
    // Range is SUM("A.2", "A.5")
    let doc = createTestDoc();
    doc.columns = ['A'];
    doc.rows[0].cells[0] = { ...doc.rows[0].cells[0], text: '10', className: 'number' };
    for (let r = 2; r <= 5; r++) {
      doc.rows.push({
        id: `r${r}`,
        cells: [{ id: `a${r}`, text: `${r * 10}`, className: 'number' }]
      });
    }
    doc.rows.push({
      id: 'r6',
      cells: [{ id: 'a6', text: '=SUM("A.2", "A.5")', className: 'formula' }]
    });

    // Insert row at row 2 (boundary start)
    const { newTable } = handleEnter(doc, doc.rows[0].cells[0].id); // Enter on A.1 -> inserts at index 1 (row 2)
    const adjusted = adjustFormulasAfterStructureChange(doc, newTable);

    // Formula cell moved to index 6 (row 7)
    const formulaCell = adjusted.rows[6].cells[0];
    expect(formulaCell.text).toBe('=SUM("A.2", "A.5")');
  });

  it('contracts range automatically when deleting inside range', () => {
    // Range is SUM("A.1", "A.5")
    let doc = createTestDoc();
    doc.columns = ['A'];
    doc.rows[0].cells[0] = { ...doc.rows[0].cells[0], text: '10', className: 'number' };
    for (let r = 2; r <= 5; r++) {
      doc.rows.push({
        id: `r${r}`,
        cells: [{ id: `a${r}`, text: `${r * 10}`, className: 'number' }]
      });
    }
    doc.rows.push({
      id: 'r6',
      cells: [{ id: 'a6', text: '=SUM("A.1", "A.5")', className: 'formula' }]
    });

    // Delete row 3 (inside 1..5)
    const row3Id = doc.rows[2].cells[0].id;
    const newDoc = deleteRow(doc, row3Id);
    const adjusted = adjustFormulasAfterStructureChange(doc, newDoc);

    // Range should contract from 1..5 to 1..4! Formula cell moved to index 4 (row 5)
    const formulaCell = adjusted.rows[4].cells[0];
    expect(formulaCell.text).toBe('=SUM("A.1", "A.4")');
  });

  it('returns SUM(#REF!) when deleting a range boundary cell', () => {
    let doc = createTestDoc();
    doc.columns = ['A'];
    const a1Id = doc.rows[0].cells[0].id;
    doc.rows[0].cells[0] = { ...doc.rows[0].cells[0], text: '10', className: 'number' };
    doc.rows.push(
      { id: 'r2', cells: [{ id: 'a2', text: '20', className: 'number' }] },
      { id: 'r3', cells: [{ id: 'a3', text: '=SUM("A.1", "A.2")', className: 'formula' }] }
    );

    // Delete row 1 (containing a1Id boundary)
    const newDoc = deleteRow(doc, a1Id);
    const adjusted = adjustFormulasAfterStructureChange(doc, newDoc);

    const formulaCell = adjusted.rows[1].cells[0];
    expect(formulaCell.text).toBe('=SUM(#REF!)');
  });
});
