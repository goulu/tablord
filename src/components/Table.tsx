import React, { useEffect, useRef } from 'react';
import type { Table as TableType } from '../types/document';
import '../App.css';

interface TableProps {
  table: TableType;
  activeCellId: string | null;
  onCellClick: (cellId: string) => void;
  onCellInput: (cellId: string, text: string) => void;
  depth?: number;
}

export const Table: React.FC<TableProps> = ({ table, activeCellId, onCellClick, onCellInput, depth = 0 }) => {
  const activeTdRef = useRef<HTMLTableCellElement | null>(null);
  
  const isInnermostSelectedTable = table.rows.some(row => 
    row.cells.some(cell => cell.id === activeCellId)
  );

  // Focus the active td and place cursor at end when a new cell becomes active
  useEffect(() => {
    if (activeTdRef.current && document.activeElement !== activeTdRef.current) {
      activeTdRef.current.focus();
      if (typeof window.getSelection !== 'undefined' && typeof document.createRange !== 'undefined') {
        const range = document.createRange();
        range.selectNodeContents(activeTdRef.current);
        // Only collapse to end if no inner table
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [activeCellId]);

  return (
    <div className="document">
      <table className={isInnermostSelectedTable ? "selected" : ""}>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id}>
              {row.cells.map((cell) => {
                const isActive = cell.id === activeCellId;
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
                    onKeyDown={(e) => {
                      // Let ArrowLeft/Right stay within the cell if cursor is not at boundary
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
                    {cell.text || ''}
                    {/* If the cell contains a sub-table, render it recursively */}
                    {cell.table && (
                      <Table
                        table={cell.table}
                        activeCellId={activeCellId}
                        onCellClick={onCellClick}
                        onCellInput={onCellInput}
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
