import { useState, useEffect, useCallback } from 'react';
import { initialDocument } from './types/document';
import type { Table as TableType } from './types/document';
import { handleTab, handleEnter, handleCtrlTab } from './utils/tableUtils';
import { TopBar } from './components/TopBar';
import { Table } from './components/Table';
import { HelpPopup } from './components/HelpPopup';
import './App.css';

// Helper function to deeply update a cell's text by ID
const updateCellText = (table: TableType, cellId: string, newText: string): TableType => {
  return {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        if (cell.id === cellId) {
          return { ...cell, text: newText };
        }
        if (cell.table) {
          return { ...cell, table: updateCellText(cell.table, cellId, newText) };
        }
        return cell;
      }),
    })),
  };
};

function App() {
  const [documentTable, setDocumentTable] = useState<TableType>(initialDocument);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Handle global keystrokes
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // If we don't have an active cell, or it's a modifier key alone without Tab, do nothing
      // We allow ctrlKey for Ctrl+Tab
      if (!activeCellId || e.metaKey || e.altKey) {
        return;
      }
      if (e.ctrlKey && e.key !== 'Tab') {
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.ctrlKey) {
          const { newTable, newActiveCellId } = handleCtrlTab(documentTable, activeCellId);
          setDocumentTable(newTable);
          setActiveCellId(newActiveCellId);
        } else {
          const { newTable, newActiveCellId } = handleTab(documentTable, activeCellId);
          setDocumentTable(newTable);
          setActiveCellId(newActiveCellId);
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const { newTable, newActiveCellId } = handleEnter(documentTable, activeCellId);
        setDocumentTable(newTable);
        setActiveCellId(newActiveCellId);
        return;
      }

      setDocumentTable((prevTable) => {
        // Find the current text to compute new text
        let currentText = '';
        
        // Very basic search function (recursive) to find current cell text
        const findText = (t: TableType): boolean => {
          for (const row of t.rows) {
            for (const cell of row.cells) {
              if (cell.id === activeCellId) {
                currentText = cell.text;
                return true;
              }
              if (cell.table) {
                if(findText(cell.table)) return true;
              }
            }
          }
          return false;
        };
        findText(prevTable);

        let newText = currentText;

        if (e.key === 'Backspace') {
          newText = currentText.slice(0, -1);
        } else if (e.key.length === 1) { // Normal character
          newText = currentText + e.key;
        } else {
           // keys like Enter, Arrow, etc., ignored in this simple version
           return prevTable;
        }

        return updateCellText(prevTable, activeCellId, newText);
      });
    },
    [activeCellId, documentTable]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleCellClick = (cellId: string) => {
    setActiveCellId(cellId);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }} onClick={() => setActiveCellId(null)}>
      <TopBar activeCellId={activeCellId} onHelpClick={() => setShowHelp(true)} />
      
      <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
        <Table 
          table={documentTable} 
          activeCellId={activeCellId} 
          onCellClick={handleCellClick}
        />
      </div>

      {showHelp && <HelpPopup onClose={() => setShowHelp(false)} />}
    </div>
  );
}

export default App;
