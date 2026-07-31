import React, { useEffect, useLayoutEffect, useRef, memo } from 'react';
import type { Table as TableType, Cell } from '../types/document';
import '../App.css';

interface TableProps {
  table: TableType;
  activeCellId: string | null;
  onCellClick: (cellId: string) => void;
  onCellInput: (cellId: string, text: string) => void;
  onDeselect?: () => void;
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
  onDeselect?: () => void;
  onCellRefClick?: (cellId: string) => void;
  onCellContextMenu?: (e: React.MouseEvent, cellId: string) => void;
  colSpan?: number;
  children?: React.ReactNode; // nested Table for cells with sub-tables
}

const EditableCell = memo(({ cell, isActive, isEditingFormula, onCellClick, onCellInput, onDeselect, onCellRefClick, onCellContextMenu, colSpan, children }: EditableCellProps) => {
  const tdRef = useRef<HTMLTableCellElement>(null);
  const originalTextRef = useRef<string>(''); // captured on activation

  // When this cell becomes active or cell.text changes: set DOM text and move cursor to end.
  useLayoutEffect(() => {
    const td = tdRef.current;
    if (!td) return;
    if (isActive && !cell.table) {
      originalTextRef.current = cell.text;
      const formulaOrText = cell.text;
      if (td.textContent !== formulaOrText) {
        td.textContent = formulaOrText;
        if (typeof window.getSelection !== 'undefined' && typeof document.createRange !== 'undefined') {
          const range = document.createRange();
          range.selectNodeContents(td);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
      td.focus();
    }
  }, [isActive, cell.id, cell.text]);

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
      tabIndex={0}
      colSpan={colSpan}
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
            onCellInput(cell.id, originalTextRef.current);
          }
          onDeselect?.();
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          onDeselect?.();
          return;
        }
      }}
      onClick={(e) => {
        if (isEditingFormula && !isActive) {
          e.preventDefault();
          e.stopPropagation();
          onCellRefClick?.(cell.id);
          return;
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
  table, activeCellId, onCellClick, onCellInput, onDeselect,
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
          {table.rows.map((row) => {
            const isSingleCellRow = row.cells.length === 1 && table.columns.length > 1;
            const colSpan = isSingleCellRow ? table.columns.length : undefined;
            return (
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
                      onDeselect={onDeselect}
                      onCellRefClick={onCellRefClick}
                      onCellContextMenu={onCellContextMenu}
                      colSpan={colSpan}
                    >
                      {cell.table && (
                        <Table
                          table={cell.table}
                          activeCellId={activeCellId}
                          onCellClick={onCellClick}
                          onCellInput={onCellInput}
                          onDeselect={onDeselect}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
