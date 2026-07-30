import { describe, it, expect, vi } from 'vitest';
import { HistoryManager } from '../src/history/HistoryManager';
import { DocumentCommand } from '../src/history/DocumentCommand';
import { UpdateCellCommand } from '../src/history/UpdateCellCommand';
import { initialDocument, type Table } from '../src/types/document';

const createTestDoc = (): Table => structuredClone(initialDocument);

const setCellText = (table: Table, cellId: string, text: string): Table => ({
  ...table,
  rows: table.rows.map(r => ({
    ...r,
    cells: r.cells.map(c => c.id === cellId ? { ...c, text } : c)
  }))
});

describe('HistoryManager (N Cell Edits Undo/Redo)', () => {
  it('handles N consecutive edits with exactly N undos and N redos affecting only target cells', () => {
    const history = new HistoryManager();
    
    // Create initial table with 5 cells in Row 1: A.1, B.1, C.1, D.1, E.1
    let doc: Table = {
      ...createTestDoc(),
      columns: ['A', 'B', 'C', 'D', 'E'],
      rows: [
        {
          id: 'r1',
          cells: [
            { id: 'a1', text: 'a_init', className: 'text' },
            { id: 'b1', text: 'b_init', className: 'text' },
            { id: 'c1', text: 'c_init', className: 'text' },
            { id: 'd1', text: 'd_init', className: 'text' },
            { id: 'e1', text: 'e_init', className: 'text' },
          ]
        }
      ]
    };

    let activeCellId: string | null = null;

    const applyCellUpdate = (cellId: string, text: string, targetActiveId: string | null) => {
      doc = setCellText(doc, cellId, text);
      activeCellId = targetActiveId;
    };

    // User edits 5 cells in order: A.1 -> B.1 -> C.1 -> D.1 -> E.1
    const cellEdits = [
      { id: 'a1', old: 'a_init', new: 'a_final' },
      { id: 'b1', old: 'b_init', new: 'b_final' },
      { id: 'c1', old: 'c_init', new: 'c_final' },
      { id: 'd1', old: 'd_init', new: 'd_final' },
      { id: 'e1', old: 'e_init', new: 'e_final' },
    ];

    cellEdits.forEach(edit => {
      // User types new text
      doc = setCellText(doc, edit.id, edit.new);
      // Session finishes & commits command
      const cmd = new UpdateCellCommand('Edit Cell', edit.id, edit.old, edit.new, edit.id, edit.id, applyCellUpdate);
      history.execute(cmd, true);
    });

    // Check final state
    expect(doc.rows[0].cells.map(c => c.text)).toEqual(['a_final', 'b_final', 'c_final', 'd_final', 'e_final']);

    // Perform N=5 consecutive UNDOS
    // Undo 1 (E.1)
    history.undo();
    expect(doc.rows[0].cells.map(c => c.text)).toEqual(['a_final', 'b_final', 'c_final', 'd_final', 'e_init']);

    // Undo 2 (D.1)
    history.undo();
    expect(doc.rows[0].cells.map(c => c.text)).toEqual(['a_final', 'b_final', 'c_final', 'd_init', 'e_init']);

    // Undo 3 (C.1)
    history.undo();
    expect(doc.rows[0].cells.map(c => c.text)).toEqual(['a_final', 'b_final', 'c_init', 'd_init', 'e_init']);

    // Undo 4 (B.1)
    history.undo();
    expect(doc.rows[0].cells.map(c => c.text)).toEqual(['a_final', 'b_init', 'c_init', 'd_init', 'e_init']);

    // Undo 5 (A.1)
    history.undo();
    expect(doc.rows[0].cells.map(c => c.text)).toEqual(['a_init', 'b_init', 'c_init', 'd_init', 'e_init']); // EXACT INITIAL STATE!

    // Verify 5 redos are available
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);

    // Perform N=5 consecutive REDOS
    // Redo 1 (A.1)
    history.redo();
    expect(doc.rows[0].cells.map(c => c.text)).toEqual(['a_final', 'b_init', 'c_init', 'd_init', 'e_init']);

    // Redo 2 (B.1)
    history.redo();
    expect(doc.rows[0].cells.map(c => c.text)).toEqual(['a_final', 'b_final', 'c_init', 'd_init', 'e_init']);

    // Redo 3 (C.1)
    history.redo();
    expect(doc.rows[0].cells.map(c => c.text)).toEqual(['a_final', 'b_final', 'c_final', 'd_init', 'e_init']);

    // Redo 4 (D.1)
    history.redo();
    expect(doc.rows[0].cells.map(c => c.text)).toEqual(['a_final', 'b_final', 'c_final', 'd_final', 'e_init']);

    // Redo 5 (E.1)
    history.redo();
    expect(doc.rows[0].cells.map(c => c.text)).toEqual(['a_final', 'b_final', 'c_final', 'd_final', 'e_final']); // EXACT FINAL STATE!

    expect(history.canRedo()).toBe(false);
  });
});
