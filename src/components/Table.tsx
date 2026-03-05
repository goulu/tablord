import React, { useEffect, useRef } from 'react';
import type { Table as TableType, Cell } from '../types/document';
import '../App.css';

interface TableProps {
  table: TableType;
  activeCellId: string | null;
  onCellClick: (cellId: string) => void;
  onCellInput: (cellId: string, text: string) => void;
  onCellBlur: (cellId: string) => void;
  depth?: number;
}

export const Table: React.FC<TableProps> = ({ table, activeCellId, onCellClick, onCellInput, onCellBlur, depth = 0 }) => {
  const activeTdRef = useRef<HTMLTableCellElement | null>(null);
  
  const isInnermostSelectedTable = table.rows.some(row => 
    row.cells.some(cell => cell.id === activeCellId)
  );

  // Find the active cell to know if it's a formula
  const activeCell: Cell | undefined = table.rows
    .flatMap(r => r.cells)
    .find(c => c.id === activeCellId);

  // Focus the active td and place cursor at end when a new cell becomes active
  useEffect(() => {
    if (activeTdRef.current && document.activeElement !== activeTdRef.current) {
      activeTdRef.current.focus();
      if (typeof window.getSelection !== 'undefined' && typeof document.createRange !== 'undefined') {
        const range = document.createRange();
        range.selectNodeContents(activeTdRef.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [activeCellId]);

  // When the active cell changes away and the td still contains text, sync
  // the display text (formula when active, value when inactive) via DOM ref
  useEffect(() => {
    if (activeTdRef.current && activeCell) {
      const displayText = activeCell.text; // formula or text
      if (activeTdRef.current.textContent !== displayText) {
        activeTdRef.current.textContent = displayText;
      }
    }
  }, [activeCell]);

  return (
    <div className="document">
      <table className={isInnermostSelectedTable ? "selected" : ""}>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id}>
              {row.cells.map((cell) => {
                const isActive = cell.id === activeCellId;
                // Show formula when active, otherwise show evaluated value (if any)
                const displayText = isActive ? cell.text : (cell.value ?? cell.text);
                return (
                  <td
                    key={cell.id}
                    ref={isActive ? activeTdRef : null}
                    className={`${isActive ? "selected " : ""}${cell.className || "text"}`}
                    contentEditable={isActive && !cell.table}
                    suppressContentEditableWarning
                    data-cell-id={cell.id}
                    onInput={(e) => {
                      if (!cell.table) {
                        onCellInput(cell.id, e.currentTarget.textContent || '');
                      }
                    }}
                    onBlur={() => {
                      onCellBlur(cell.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) {
                          const range = sel.getRangeAt(0);
                          const pos = range.startOffset;
                          const textLen = e.currentTarget.textContent?.length || 0;
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
                    {displayText}
                    {cell.table && (
                      <Table
                        table={cell.table}
                        activeCellId={activeCellId}
                        onCellClick={onCellClick}
                        onCellInput={onCellInput}
                        onCellBlur={onCellBlur}
                        depth={depth + 1}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
