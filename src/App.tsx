import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initialDocument } from './types/document';
import type { Table as TableType } from './types/document';
import { handleTab, handleEnter, handleCtrlTab, handleArrow, getCellType, setCellTypeClass } from './utils/tableUtils';
import { parseHtmlToTable } from './utils/htmlUtils';
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
          // Auto-detect number
          let newTypeStr = getCellType(cell.className);
          if (newText.trim() !== '') {
            if (!isNaN(Number(newText))) {
              newTypeStr = 'number';
            } else if (newTypeStr === 'number') {
               // Revert to text if it was a number but is no longer valid
               newTypeStr = 'text';
            }
          } else {
             newTypeStr = 'text'; // Default to text when empty
          }
          
          return { ...cell, text: newText, className: setCellTypeClass(cell.className, newTypeStr) };
        }
        if (cell.table) {
          return { ...cell, table: updateCellText(cell.table, cellId, newText) };
        }
        return cell;
      }),
    })),
  };
};

const updateCellTypeInTree = (table: TableType, cellId: string, newType: 'text' | 'number' | 'formula'): TableType => {
  return {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        if (cell.id === cellId) {
          return { ...cell, className: setCellTypeClass(cell.className, newType) };
        }
        if (cell.table) {
          return { ...cell, table: updateCellTypeInTree(cell.table, cellId, newType) };
        }
        return cell;
      }),
    })),
  };
};

const findActiveCell = (table: TableType, cellId: string): TableType['rows'][0]['cells'][0] | null => {
  for (const row of table.rows) {
    for (const cell of row.cells) {
      if (cell.id === cellId) return cell;
      if (cell.table) {
        const found = findActiveCell(cell.table, cellId);
        if (found) return found;
      }
    }
  }
  return null;
};

const findContainingTableId = (table: TableType, cellId: string): string | null => {
  for (const row of table.rows) {
    for (const cell of row.cells) {
      if (cell.id === cellId) return table.id;
      if (cell.table) {
        const found = findContainingTableId(cell.table, cellId);
        if (found) return found;
      }
    }
  }
  return null;
};

function App() {
  const [documentTable, setDocumentTable] = useState<TableType>(initialDocument);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const tableRef = useRef(documentTable);
  const activeCellRef = useRef(activeCellId);
  const documentContainerRef = useRef<HTMLDivElement>(null);

  // Load document.html on startup
  useEffect(() => {
    fetch('/api/load')
      .then(res => {
        if (res.ok) return res.text();
        throw new Error('No document.html found');
      })
      .then(html => {
        const loadedTable = parseHtmlToTable(html);
        if (loadedTable) {
          setDocumentTable(loadedTable);
        }
      })
      .catch(err => console.log('Starting with initial document:', err.message));
  }, []);

  // Save document HTML whenever documentTable changes
  useEffect(() => {
    tableRef.current = documentTable;

    // We use setTimeout to ensure React has flushed the DOM updates before we grab the HTML
    const timer = setTimeout(() => {
      if (documentContainerRef.current) {
        // Clone to strip "selected" classes before saving
        const clone = documentContainerRef.current.cloneNode(true) as HTMLDivElement;
        const selectedEls = clone.querySelectorAll('.selected');
        selectedEls.forEach(el => el.classList.remove('selected'));
        // Remove empty class attributes
        const allEls = clone.querySelectorAll('*');
        allEls.forEach(el => {
          if (el.getAttribute('class') === '') el.removeAttribute('class');
        });
        // Strip the EditableText <span> wrappers — replace with their text content
        const spans = clone.querySelectorAll('span');
        spans.forEach(span => {
          const text = document.createTextNode(span.textContent || '');
          span.parentNode?.replaceChild(text, span);
        });
        // Also strip contenteditable attributes left on any elements
        clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));

        const htmlToSave = clone.innerHTML;
        fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'text/html' },
          body: htmlToSave
        }).catch(err => console.error('Failed to save document.html:', err));
      }
    }, 100); // 100ms debounce
    return () => clearTimeout(timer);
  }, [documentTable]);

  useEffect(() => {
    activeCellRef.current = activeCellId;
  }, [activeCellId]);

  // Handle keystrokes (Tab, Enter, Arrows) that bubble up
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentTable = tableRef.current;
      const currentActiveCellId = activeCellRef.current;

      // If we don't have an active cell, or it's a modifier key alone without Tab, do nothing
      // We allow ctrlKey for Ctrl+Tab
      if (!currentActiveCellId || e.metaKey || e.altKey) {
        return;
      }
      if (e.ctrlKey && e.key !== 'Tab') {
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.ctrlKey) {
          const { newTable, newActiveCellId } = handleCtrlTab(currentTable, currentActiveCellId);
          setDocumentTable(newTable);
          setActiveCellId(newActiveCellId);
        } else {
          const { newTable, newActiveCellId } = handleTab(currentTable, currentActiveCellId);
          setDocumentTable(newTable);
          setActiveCellId(newActiveCellId);
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const { newTable, newActiveCellId } = handleEnter(currentTable, currentActiveCellId);
        setDocumentTable(newTable);
        setActiveCellId(newActiveCellId);
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const newActiveCellId = handleArrow(currentTable, currentActiveCellId, e.key as any);
        setActiveCellId(newActiveCellId);
        return;
      }
    },
    [] // No dependencies needed due to refs
  );

  const handleCellClick = (cellId: string) => {
    setActiveCellId(cellId);
  };

  const handleCellTypeChange = (newType: 'text' | 'number' | 'formula') => {
    if (activeCellId) {
      setDocumentTable(prev => updateCellTypeInTree(prev, activeCellId, newType));
    }
  };

  const activeCellProps = activeCellId ? findActiveCell(documentTable, activeCellId) : null;
  const activeCellType = getCellType(activeCellProps?.className);
  
  const activeTableId = activeCellId ? findContainingTableId(documentTable, activeCellId) : null;

  return (
    <div 
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', outline: 'none' }} 
      onClick={() => setActiveCellId(null)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <TopBar 
        activeCellId={activeCellId} 
        activeTableId={activeTableId}
        activeCellType={activeCellType}
        onCellTypeChange={handleCellTypeChange}
        onHelpClick={() => setShowHelp(true)} 
      />
      
      <div style={{ flex: 1, padding: '20px', overflow: 'auto' }} ref={documentContainerRef}>
        <Table 
          table={documentTable} 
          activeCellId={activeCellId} 
          onCellClick={handleCellClick}
          onCellInput={(cellId, newText) => setDocumentTable(prev => updateCellText(prev, cellId, newText))}
        />
      </div>

      {showHelp && <HelpPopup onClose={() => setShowHelp(false)} />}
    </div>
  );
}

export default App;
