import React from 'react';
import type { Table as TableType } from '../types/document';
import '../App.css';

interface TableProps {
  table: TableType;
  activeCellId: string | null;
  onCellClick: (cellId: string) => void;
  depth?: number;
}
export const Table: React.FC<TableProps> = ({ table, activeCellId, onCellClick, depth = 0 }) => {
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
                    className={isActive ? "selected" : ""}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCellClick(cell.id);
                    }}
                    >
                      {cell.text}
                      {/* If the cell contains a sub-table, render it recursively */}
                      {cell.table && (
                        <Table
                          table={cell.table}
                          activeCellId={activeCellId}
                          onCellClick={onCellClick}
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
