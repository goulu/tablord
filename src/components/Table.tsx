import React, { useLayoutEffect, useRef, memo } from 'react';
import type { Table as TableType, Cell } from '../types/document';
import { renderCellHtml } from '../utils/htmlRenderer';
import '../App.css';

interface TableProps {
  table: TableType;
  activeCellId: string | null;
  selectedCellIds?: Set<string>;
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
  selectedCellIds?: Set<string>;
  isEditingFormula: boolean;
  onCellClick: (id: string) => void;
  onCellInput: (id: string, text: string) => void;
  onDeselect?: () => void;
  onCellRefClick?: (cellId: string) => void;
  onCellContextMenu?: (e: React.MouseEvent, cellId: string) => void;
  colSpan?: number;
  children?: React.ReactNode; // nested Table for cells with sub-tables
}

const EditableCell = memo(({ cell, isActive, selectedCellIds, isEditingFormula, onCellClick, onCellInput, onDeselect, onCellRefClick, onCellContextMenu, colSpan, children }: EditableCellProps) => {
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

  const isSelected = isActive || Boolean(selectedCellIds?.has(cell.id));

  return (
    <td
      ref={tdRef}
      colSpan={colSpan}
      className={`${isSelected ? 'selected ' : ''}${cell.className || 'text'}${!isActive && isEditingFormula ? ' formula-ref-target' : ''}`}
      contentEditable={isActive && !cell.table}
      suppressContentEditableWarning
      data-cell-id={cell.id}
      dangerouslySetInnerHTML={
        !cell.table && !isActive
          ? { __html: renderCellHtml(cell) }
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
        e.stopPropagation();
        if (isEditingFormula && !isActive) {
          e.preventDefault();
          onCellRefClick?.(cell.id);
          return;
        }
        onCellClick(cell.id);
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        if (isActive) {
          // Cell is currently being edited -> do NOT intercept context menu!
          // Preserves native browser Cut/Copy/Paste context menu!
          return;
        }
        e.preventDefault();
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
  table, activeCellId, selectedCellIds, onCellClick, onCellInput, onDeselect,
  isEditingFormula = false, onCellRefClick, onCellContextMenu,
  depth = 0
}) => {
  const isInnermostSelectedTable = table.rows.some(row =>
    row.cells.some(cell => cell.id === activeCellId || selectedCellIds?.has(cell.id))
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
                      selectedCellIds={selectedCellIds}
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
                          selectedCellIds={selectedCellIds}
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
