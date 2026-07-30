import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initialDocument } from './types/document';
import type { Table as TableType } from './types/document';
import { 
  handleTab, handleEnter, handleCtrlTab, handleArrow, 
  getCellType, setCellTypeClass, evaluateFormula, recalculateTable, buildValueMap,
  deleteRow, deleteColumn, deleteTable, getCellNameById, insertSubTableAtCell,
  adjustFormulasAfterStructureChange
} from './utils/tableUtils';
import { parseHtmlToTable } from './utils/htmlUtils';
import { availableImporters } from './import';
import { TopBar } from './components/TopBar';
import { Table } from './components/Table';
import { HelpPopup } from './components/HelpPopup';
import './App.css';

// Helper: update a cell's text and recalculate the whole table (propagates to dependents)
const updateCellText = (table: TableType, cellId: string, newText: string): TableType => {
  const valueMap = buildValueMap(table); // snapshot for immediate formula preview
  const updated = {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        if (cell.id === cellId) {
          // Detect formula — always keep class as 'formula'
          if (newText.startsWith('=')) {
            const visualName = getCellNameById(table, cellId) || '';
            const evaluated = evaluateFormula(newText, visualName, valueMap);
            return { ...cell, text: newText, value: evaluated, className: setCellTypeClass(cell.className, 'formula') };
          }
          // Auto-detect number
          let newTypeStr = getCellType(cell.className) === 'formula' ? 'text' : getCellType(cell.className);
          if (newText.trim() !== '') {
            if (!isNaN(Number(newText))) {
              newTypeStr = 'number';
            } else if (newTypeStr === 'number') {
               newTypeStr = 'text';
            }
          } else {
             newTypeStr = 'text';
          }
          return { ...cell, text: newText, value: undefined, className: setCellTypeClass(cell.className, newTypeStr) };
        }
        if (cell.table) {
          return { ...cell, table: updateCellText(cell.table, cellId, newText) };
        }
        return cell;
      }),
    })),
  };
  // Propagate changes to all dependent formulas
  return recalculateTable(updated);
};

const updateCellTypeInTree = (table: TableType, cellId: string, newType: 'text' | 'number' | 'formula'): TableType => {
  return {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        if (cell.id === cellId) {
          let newText = cell.text;
          let newValue = cell.value;
          if (newType === 'formula' && !newText.startsWith('=')) {
             newText = '=' + newText;
             const visualName = getCellNameById(table, cellId) || '';
             newValue = evaluateFormula(newText, visualName, buildValueMap(table));
          } else if (newType !== 'formula' && newText.startsWith('=')) {
             newValue = undefined;
          }
          return { ...cell, text: newText, value: newValue, className: setCellTypeClass(cell.className, newType) };
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
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, cellId: string } | null>(null);

  const tableRef = useRef(documentTable);
  const activeCellRef = useRef(activeCellId);
  const documentContainerRef = useRef<HTMLDivElement>(null);

  // Load on startup: localStorage first, then dev-server /api/load as fallback
  useEffect(() => {
    const STORAGE_KEY = 'tablord_document';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const loadedTable = parseHtmlToTable(saved);
      if (loadedTable) {
        setDocumentTable(recalculateTable(loadedTable));
        return;
      }
    }
    // Fallback to dev-server file (only works when running locally)
    fetch('/api/load')
      .then(res => { if (res.ok) return res.text(); throw new Error('no api'); })
      .then(html => {
        const loadedTable = parseHtmlToTable(html);
        if (loadedTable) setDocumentTable(recalculateTable(loadedTable));
      })
      .catch(() => {}); // silently ignore — not available on GitHub Pages
  }, []);

  // Persist document whenever it changes
  useEffect(() => {
    const STORAGE_KEY = 'tablord_document';
    tableRef.current = documentTable;

    const timer = setTimeout(() => {
      if (!documentContainerRef.current) return;
      // Clone to strip transient UI attributes before saving
      const clone = documentContainerRef.current.cloneNode(true) as HTMLDivElement;
      clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
      clone.querySelectorAll('.formula-ref-target').forEach(el => el.classList.remove('formula-ref-target'));
      clone.querySelectorAll('*').forEach(el => {
        if (el.getAttribute('class') === '') el.removeAttribute('class');
      });
      clone.querySelectorAll('span').forEach(span => {
        span.parentNode?.replaceChild(document.createTextNode(span.textContent || ''), span);
      });
      clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));

      const htmlToSave = clone.innerHTML;

      // Always persist to localStorage (works everywhere)
      localStorage.setItem(STORAGE_KEY, htmlToSave);

      // Also sync to dev-server file when available
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'text/html' },
        body: htmlToSave
      }).catch(() => {}); // silently ignore on GitHub Pages
    }, 100);
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
          const adjusted = adjustFormulasAfterStructureChange(currentTable, newTable);
          setDocumentTable(recalculateTable(adjusted));
          setActiveCellId(newActiveCellId);
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        // Commit any in-progress edit: read formula text directly from DOM
        // (avoids stale tableRef when Enter is pressed immediately after typing)
        let latestTable = currentTable;
        if (currentActiveCellId) {
          const activeTd = document.querySelector(`[data-cell-id="${currentActiveCellId}"]`) as HTMLElement | null;
          if (activeTd && !activeTd.querySelector('table')) {
            const domText = activeTd.textContent || '';
            latestTable = updateCellText(latestTable, currentActiveCellId, domText);
          }
        }
        const { newTable, newActiveCellId } = handleEnter(latestTable, currentActiveCellId!);
        const adjusted = adjustFormulasAfterStructureChange(latestTable, newTable);
        setDocumentTable(recalculateTable(adjusted));
        setActiveCellId(newActiveCellId);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (currentActiveCellId) {
          const activeTd = document.querySelector(`[data-cell-id="${currentActiveCellId}"]`) as HTMLElement | null;
          if (activeTd) {
            activeTd.blur();
          }
        }
        setActiveCellId(null);
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

  // Track last-inserted cell reference during formula editing (for cycling rel→abs→remove)
  const formulaRefStateRef = useRef<{ cellId: string; refText: string } | null>(null);
  useEffect(() => { formulaRefStateRef.current = null; }, [activeCellId]);

  const handleCellTypeChange = (newType: 'text' | 'number' | 'formula') => {
    if (activeCellId) {
      setDocumentTable(prev => updateCellTypeInTree(prev, activeCellId, newType));
    }
  };

  const activeCellProps = activeCellId ? findActiveCell(documentTable, activeCellId) : null;
  const activeCellType = getCellType(activeCellProps?.className);
  const isEditingFormula = (activeCellProps?.text ?? '').startsWith('=');
  
  const activeCellName = activeCellId ? getCellNameById(documentTable, activeCellId) : null;

  const handleCellRefClick = useCallback((clickedCellId: string) => {
    if (!activeCellId) return;
    const activeTd = document.querySelector(`[data-cell-id="${activeCellId}"]`) as HTMLElement | null;
    if (!activeTd) return;

    // Convert the UUID to its visual representation (e.g. B.3)
    const visualName = getCellNameById(documentTable, clickedCellId);
    if (!visualName) return;

    // Relative: "B.3"  |  Absolute: "$B.$3"
    const relRef = visualName;
    const absRef = visualName
      .replace(/([A-Z]+)\./g, '$$$1.')  // B. → $B.   ('$$$1' = literal$ + capture group 1)
      .replace(/\.(\d+)/g, '.$$$1');   // .3 → .$3   ('.$$$1' = .$ + capture group 1)

    // Place cursor at a specific text offset in a contentEditable element
    const setCursor = (el: HTMLElement, offset: number) => {
      const node = el.firstChild;
      if (!node) return;
      const range = document.createRange();
      range.setStart(node, Math.min(offset, node.textContent?.length ?? 0));
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    };

    const lastRef = formulaRefStateRef.current;

    if (lastRef && lastRef.cellId === clickedCellId) {
      const currentText = activeTd.textContent || '';
      if (lastRef.refText === relRef) {
        // Cycle relative → absolute
        const idx = currentText.lastIndexOf(relRef);
        if (idx >= 0) {
          const newText = currentText.slice(0, idx) + absRef + currentText.slice(idx + relRef.length);
          activeTd.textContent = newText;
          formulaRefStateRef.current = { cellId: clickedCellId, refText: absRef };
          setDocumentTable(prev => updateCellText(prev, activeCellId, newText));
          activeTd.focus();
          setCursor(activeTd, idx + absRef.length);
          return;
        }
      } else {
        // Cycle absolute → remove
        const idx = currentText.lastIndexOf(lastRef.refText);
        if (idx >= 0) {
          const newText = currentText.slice(0, idx) + currentText.slice(idx + lastRef.refText.length);
          activeTd.textContent = newText;
          formulaRefStateRef.current = null;
          setDocumentTable(prev => updateCellText(prev, activeCellId, newText));
          activeTd.focus();
          setCursor(activeTd, idx);
          return;
        }
      }
    } else {
      // Insert relative ref at cursor; execCommand preserves cursor position naturally
      const inserted = document.execCommand('insertText', false, relRef);
      if (!inserted) {
        const newText = (activeTd.textContent || '') + relRef;
        activeTd.textContent = newText;
        setDocumentTable(prev => updateCellText(prev, activeCellId, newText));
      }
      formulaRefStateRef.current = { cellId: clickedCellId, refText: relRef };
    }
    activeTd.focus();
  }, [activeCellId]);

  const handleCellContextMenu = useCallback((e: React.MouseEvent, cellId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, cellId });
  }, []);

  const closeContextMenu = () => {
    if (contextMenu) setContextMenu(null);
  };

  const handleDeleteMenuAction = (action: 'row' | 'column' | 'table') => {
    if (!contextMenu) return;
    const { cellId } = contextMenu;
    setDocumentTable(prev => {
      let newTable = prev;
      if (action === 'row') newTable = deleteRow(newTable, cellId);
      if (action === 'column') newTable = deleteColumn(newTable, cellId);
      if (action === 'table') newTable = deleteTable(newTable, cellId);
      const adjusted = adjustFormulasAfterStructureChange(prev, newTable);
      return recalculateTable(adjusted);
    });
    setContextMenu(null);
  };

  const handleImportFile = (importerId: string, file: File) => {
    if (!activeCellId) return;
    const importer = availableImporters.find(imp => imp.id === importerId);
    if (!importer) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (typeof content === 'string') {
        const parsedSubTable = importer.parse(content);
        setDocumentTable(prev => recalculateTable(insertSubTableAtCell(prev, activeCellId, parsedSubTable)));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div 
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', outline: 'none' }} 
      onClick={() => {
        setActiveCellId(null);
        closeContextMenu();
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <TopBar 
        activeCellName={activeCellName} 
        activeCellType={activeCellType}
        onCellTypeChange={handleCellTypeChange}
        onHelpClick={() => setShowHelp(true)} 
        onImportFile={handleImportFile}
      />
      
      <div style={{ flex: 1, padding: '20px', overflow: 'auto' }} ref={documentContainerRef}>
        <Table 
          table={documentTable} 
          activeCellId={activeCellId} 
          onCellClick={handleCellClick}
          onCellInput={(cellId, newText) => setDocumentTable(prev => updateCellText(prev, cellId, newText))}
          onDeselect={() => setActiveCellId(null)}
          isEditingFormula={isEditingFormula}
          onCellRefClick={handleCellRefClick}
          onCellContextMenu={handleCellContextMenu}
        />
      </div>

      {contextMenu && (
        <div 
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()} // don't close immediately when clicking inside
        >
          <div onClick={() => handleDeleteMenuAction('row')}>Supprimer la ligne</div>
          <div onClick={() => handleDeleteMenuAction('column')}>Supprimer la colonne</div>
          {getCellNameById(documentTable, contextMenu.cellId) !== 'A.1' && (
            <div onClick={() => handleDeleteMenuAction('table')}>Supprimer la table</div>
          )}
        </div>
      )}

      {showHelp && <HelpPopup onClose={() => setShowHelp(false)} />}
    </div>
  );
}

export default App;
