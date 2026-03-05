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

const EditableText: React.FC<{ text: string; isActive: boolean; onTextChange: (val: string) => void }> = ({ text, isActive, onTextChange }) => {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (spanRef.current && spanRef.current.textContent !== text) {
      spanRef.current.textContent = text;
    }
  }, [text]);

  useEffect(() => {
    if (isActive && spanRef.current) {
      if (document.activeElement !== spanRef.current) {
        spanRef.current.focus();
        if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
            const range = document.createRange();
            range.selectNodeContents(spanRef.current);
            range.collapse(false);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
      }
    }
  }, [isActive]);

  return (
    <span
      ref={spanRef}
      contentEditable={isActive}
      suppressContentEditableWarning
      style={{ outline: 'none', display: 'inline-block', minWidth: '10px' }}
      onInput={(e) => onTextChange(e.currentTarget.textContent || '')}
      onKeyDown={(e) => {
         if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
           const selection = window.getSelection();
           if (selection && selection.rangeCount > 0) {
             const range = selection.getRangeAt(0);
             const pos = range.startOffset;
             const textLen = spanRef.current?.textContent?.length || 0;
             if (e.key === 'ArrowLeft' && pos > 0) {
               e.stopPropagation(); 
             } else if (e.key === 'ArrowRight' && pos < textLen) {
               e.stopPropagation();
             }
           }
         }
      }}
    />
  );
};

export const Table: React.FC<TableProps> = ({ table, activeCellId, onCellClick, onCellInput, depth = 0 }) => {
  const isInnermostSelectedTable = table.rows.some(row => 
    row.cells.some(cell => cell.id === activeCellId)
  );

  return (
    <div className="document">
      {/* Optional: Render table headers if > 1 columns or for debugging */}
      <table className={isInnermostSelectedTable ? "selected" : ""}>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id}>
              {row.cells.map((cell) => {
                const isActive = cell.id === activeCellId;
                return (
                  <td
                    key={cell.id}
                    className={`${isActive ? "selected " : ""}${cell.className || "text"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCellClick(cell.id);
                    }}
                    >
                      <EditableText 
                        text={cell.text} 
                        isActive={isActive} 
                        onTextChange={(val) => onCellInput(cell.id, val)}
                      />
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
