import React, { useEffect, useLayoutEffect, useRef, memo } from 'react';
import type { Table as TableType, Cell } from '../types/document';
import '../App.css';

interface TableProps {
  table: TableType;
  activeCellId: string | null;
  onCellClick: (cellId: string) => void;
  onCellInput: (cellId: string, text: string) => void;
  isEditingFormula?: boolean;
  onCellRefClick?: (cellId: string) => void;
  onCellContextMenu?: (e: React.MouseEvent, cellId: string) => void;
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
  isEditingFormula: boolean;
  onCellClick: (id: string) => void;
  onCellInput: (id: string, text: string) => void;
  onCellRefClick?: (cellId: string) => void;
  onCellContextMenu?: (e: React.MouseEvent, cellId: string) => void;
  children?: React.ReactNode; // nested Table for cells with sub-tables
}

const EditableCell = memo(({ cell, isActive, isEditingFormula, onCellClick, onCellInput, onCellRefClick, onCellContextMenu, children }: EditableCellProps) => {
  const tdRef = useRef<HTMLTableCellElement>(null);
  const originalTextRef = useRef<string>(''); // captured on activation

  // When this cell becomes the active one: set DOM text and move cursor to end.
  useLayoutEffect(() => {
    const td = tdRef.current;
    if (!td) return;
    if (isActive && !cell.table) {
      originalTextRef.current = cell.value ?? cell.text;
      const formulaOrText = cell.text;
      if (td.textContent !== formulaOrText) {
        td.textContent = formulaOrText;
      }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, cell.id]);

  useEffect(() => {
    const td = tdRef.current;
    if (td && !isActive && !cell.table) {
      const displayText = cell.value ?? cell.text;
      if (td.textContent !== displayText) {
        td.textContent = displayText;
      }
    }
  }, [isActive, cell.value, cell.text, cell.table]);

  const displayText = isActive ? cell.text : (cell.value ?? cell.text);

  return (
    <td
      ref={tdRef}
      className={`${isActive ? 'selected ' : ''}${cell.className || 'text'}${!isActive && isEditingFormula ? ' formula-ref-target' : ''}`}
      contentEditable={isActive && !cell.table}
      suppressContentEditableWarning
      data-cell-id={cell.id}
      data-formula={cell.text.startsWith('=') ? cell.text : undefined}
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
      onMouseDown={(e) => {
        // While editing a formula, prevent other cells from stealing focus
        if (isEditingFormula && !isActive) {
          e.preventDefault();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          const td = tdRef.current;
          if (td) {
            td.textContent = originalTextRef.current;
            if (typeof window.getSelection !== 'undefined' && typeof document.createRange !== 'undefined') {
              const range = document.createRange();
              range.selectNodeContents(td);
              range.collapse(false);
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
            }
          }
          onCellInput(cell.id, cell.text);
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
        // While editing a formula, clicking a non-active cell inserts/cycles a reference
        if (isEditingFormula && !isActive) {
          onCellRefClick?.(cell.id);
          return; // don't switch active cell
        }
        onCellClick(cell.id);
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        onCellContextMenu?.(e, cell.id);
      }}
    >
      {cell.table && children}
    </td>
  );
});
EditableCell.displayName = 'EditableCell';

// ──────────────────────────────────────────────
// Table: recursive component
// ──────────────────────────────────────────────
export const Table: React.FC<TableProps> = ({
  table, activeCellId, onCellClick, onCellInput,
  isEditingFormula = false, onCellRefClick, onCellContextMenu,
  depth = 0
}) => {
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
                    isEditingFormula={isEditingFormula}
                    onCellClick={onCellClick}
                    onCellInput={onCellInput}
                    onCellRefClick={onCellRefClick}
                    onCellContextMenu={onCellContextMenu}
                  >
                    {cell.table && (
                      <Table
                        table={cell.table}
                        activeCellId={activeCellId}
                        onCellClick={onCellClick}
                        onCellInput={onCellInput}
                        isEditingFormula={isEditingFormula}
                        onCellRefClick={onCellRefClick}
                        onCellContextMenu={onCellContextMenu}
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
