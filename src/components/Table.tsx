import React, { useEffect, useLayoutEffect, useRef, memo } from 'react';
import type { Table as TableType, Cell } from '../types/document';
import '../App.css';

interface TableProps {
  table: TableType;
  activeCellId: string | null;
  onCellClick: (cellId: string) => void;
  onCellInput: (cellId: string, text: string) => void;
  depth?: number;
}

// ──────────────────────────────────────────────
// EditableCell: manages a <td> whose content is
// controlled by the browser (not React children)
// to avoid cursor-reset on every keystroke.
// ──────────────────────────────────────────────
interface EditableCellProps {
  cell: Cell;
  isActive: boolean;
  onCellClick: (id: string) => void;
  onCellInput: (id: string, text: string) => void;
  children?: React.ReactNode; // nested Table for cells with sub-tables
}

const EditableCell = memo(({ cell, isActive, onCellClick, onCellInput, children }: EditableCellProps) => {
  const tdRef = useRef<HTMLTableCellElement>(null);
  const originalTextRef = useRef<string>(''); // captured on activation

  // When this cell becomes the active one: set DOM text and move cursor to end.
  // We use useLayoutEffect so it fires before the browser paints, avoiding flash.
  useLayoutEffect(() => {
    const td = tdRef.current;
    if (!td) return;
    if (isActive && !cell.table) {
      // Remember where we started so Escape can restore it
      originalTextRef.current = cell.value ?? cell.text;
      // Set the formula (or plain text) so the user can edit it
      const formulaOrText = cell.text;
      if (td.textContent !== formulaOrText) {
        td.textContent = formulaOrText;
      }
      // Place cursor at end
      if (typeof window.getSelection !== 'undefined' && typeof document.createRange !== 'undefined') {
        const range = document.createRange();
        range.selectNodeContents(td);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      td.focus();
    }
  // Only re-run when the active cell changes identity — not when text changes —
  // so React never overwrites the user's in-progress edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, cell.id]);

  // When a formula cell's evaluated value changes (e.g. after losing focus and
  // re-entering), update the DOM if we are NOT currently editing.
  useEffect(() => {
    const td = tdRef.current;
    if (td && !isActive) {
      const displayText = cell.value ?? cell.text;
      if (td.textContent !== displayText) {
        td.textContent = displayText;
      }
    }
  }, [isActive, cell.value, cell.text]);

  const displayText = isActive ? cell.text : (cell.value ?? cell.text);

  return (
    <td
      ref={tdRef}
      className={`${isActive ? 'selected ' : ''}${cell.className || 'text'}`}
      contentEditable={isActive && !cell.table}
      suppressContentEditableWarning
      data-cell-id={cell.id}
      data-formula={cell.text.startsWith('=') ? cell.text : undefined}
      // For cells without sub-tables, the DOM text is managed via refs above.
      // For cells WITH sub-tables, we render the children normally (no editable text).
      dangerouslySetInnerHTML={
        !cell.table && !isActive
          ? { __html: displayText }
          : undefined
      }
      onInput={(e) => {
        if (!cell.table) {
          onCellInput(cell.id, e.currentTarget.textContent || '');
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          // Restore original text and cancel edit
          const td = tdRef.current;
          if (td) td.textContent = originalTextRef.current;
          onCellInput(cell.id, cell.text); // keep state unchanged (original text was already in state)
          td?.blur();
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const pos = range.startOffset;
            const textLen = tdRef.current?.textContent?.length || 0;
            if (e.key === 'ArrowLeft' && pos > 0) {
              e.stopPropagation();
            } else if (e.key === 'ArrowRight' && pos < textLen) {
              e.stopPropagation();
            }
          }
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onCellClick(cell.id);
      }}
    >
      {/* Sub-table is only rendered as React children (not via dangerouslySetInnerHTML) */}
      {cell.table && children}
    </td>
  );
});
EditableCell.displayName = 'EditableCell';

// ──────────────────────────────────────────────
// Table: recursive component
// ──────────────────────────────────────────────
export const Table: React.FC<TableProps> = ({ table, activeCellId, onCellClick, onCellInput, depth = 0 }) => {
  const isInnermostSelectedTable = table.rows.some(row =>
    row.cells.some(cell => cell.id === activeCellId)
  );

  return (
    <div className="document">
      <table className={isInnermostSelectedTable ? 'selected' : ''}>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id}>
              {row.cells.map((cell) => {
                const isActive = cell.id === activeCellId;
                return (
                  <EditableCell
                    key={cell.id}
                    cell={cell}
                    isActive={isActive}
                    onCellClick={onCellClick}
                    onCellInput={onCellInput}
                  >
                    {cell.table && (
                      <Table
                        table={cell.table}
                        activeCellId={activeCellId}
                        onCellClick={onCellClick}
                        onCellInput={onCellInput}
                        depth={depth + 1}
                      />
                    )}
                  </EditableCell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
