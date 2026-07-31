import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initialDocument } from './types/document';
import type { Table as TableType } from './types/document';
import { 
  handleTab, handleEnter, handleCtrlTab, handleArrow, 
  getCellType, setCellTypeClass, evaluateFormula, recalculateTable, buildValueMap,
  deleteRow, deleteColumn, deleteTable, getCellNameById, insertSubTableAtCell,
  adjustFormulasAfterStructureChange, getCellStyle, updateCellStyleInTree, type HeadingStyle
} from './utils/tableUtils';
import { parseHtmlToTable } from './utils/htmlUtils';
import { availableImporters } from './import';
import { TopBar } from './components/TopBar';
import { Table } from './components/Table';
import { HelpPopup } from './components/HelpPopup';
import { HistoryManager } from './history/HistoryManager';
import { DocumentCommand } from './history/DocumentCommand';
import { UpdateCellCommand } from './history/UpdateCellCommand';
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

function App() {
  const [documentTable, setDocumentTable] = useState<TableType>(initialDocument);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, cellId: string } | null>(null);

  const historyManagerRef = useRef(new HistoryManager());
  const historyManager = historyManagerRef.current;
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const tableRef = useRef(documentTable);
  const activeCellRef = useRef(activeCellId);
  const documentContainerRef = useRef<HTMLDivElement>(null);

  const editingSessionRef = useRef<{ cellId: string; initialText: string } | null>(null);
  const isUndoingOrRedoingRef = useRef(false);
  const ignoreNextActiveCellSessionRef = useRef(false);

  const applyCellUpdate = useCallback((cellId: string, text: string, targetActiveId: string | null) => {
    setDocumentTable(prev => updateCellText(prev, cellId, text));
    setActiveCellId(targetActiveId);
  }, []);

  const applyState = useCallback((table: TableType, cellId: string | null) => {
    setDocumentTable(table);
    setActiveCellId(cellId);
  }, []);

  const flushEditingSession = useCallback(() => {
    if (isUndoingOrRedoingRef.current || ignoreNextActiveCellSessionRef.current) {
      editingSessionRef.current = null;
      return;
    }
    const session = editingSessionRef.current;
    if (session) {
      const currentCell = findActiveCell(tableRef.current, session.cellId);
      const currentText = currentCell?.text ?? '';
      if (currentText !== session.initialText) {
        const cmd = new UpdateCellCommand(
          'Edit Cell',
          session.cellId,
          session.initialText,
          currentText,
          session.cellId,
          activeCellRef.current,
          applyCellUpdate
        );
        historyManagerRef.current.execute(cmd, true);
      }
      editingSessionRef.current = null;
    }
  }, [applyCellUpdate]);

  const handleUndo = useCallback(() => {
    flushEditingSession();
    isUndoingOrRedoingRef.current = true;
    ignoreNextActiveCellSessionRef.current = true;
    historyManagerRef.current.undo();
    editingSessionRef.current = null;
    isUndoingOrRedoingRef.current = false;
  }, [flushEditingSession]);

  const handleRedo = useCallback(() => {
    flushEditingSession();
    isUndoingOrRedoingRef.current = true;
    ignoreNextActiveCellSessionRef.current = true;
    historyManagerRef.current.redo();
    editingSessionRef.current = null;
    isUndoingOrRedoingRef.current = false;
  }, [flushEditingSession]);

  useEffect(() => {
    return historyManager.subscribe(() => {
      setCanUndo(historyManager.canUndo());
      setCanRedo(historyManager.canRedo());
    });
  }, [historyManager]);

  // Track cell edit session changes: flushes and resets ONLY when activeCellId changes
  useEffect(() => {
    if (isUndoingOrRedoingRef.current || ignoreNextActiveCellSessionRef.current) {
      ignoreNextActiveCellSessionRef.current = false;
      editingSessionRef.current = null;
      return;
    }
    flushEditingSession();

    if (activeCellId) {
      const cell = findActiveCell(tableRef.current, activeCellId);
      editingSessionRef.current = {
        cellId: activeCellId,
        initialText: cell?.text ?? '',
      };
    }
  }, [activeCellId, flushEditingSession]);

  // Load on startup: localStorage first, then dev-server /api/load as fallback
  useEffect(() => {
    const STORAGE_KEY = 'tablord_document';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const loadedTable = parseHtmlToTable(saved);
      if (loadedTable) {
        setDocumentTable(recalculateTable(loadedTable));
        if (loadedTable.rows.length > 0 && loadedTable.rows[0].cells.length > 0) {
          setActiveCellId(loadedTable.rows[0].cells[0].id);
        }
        return;
      }
    }
    // Fallback to dev-server file (only works when running locally)
    fetch('/api/load')
      .then(res => { if (res.ok) return res.text(); throw new Error('no api'); })
      .then(html => {
        const loadedTable = parseHtmlToTable(html);
        if (loadedTable) {
          setDocumentTable(recalculateTable(loadedTable));
          if (loadedTable.rows.length > 0 && loadedTable.rows[0].cells.length > 0) {
            setActiveCellId(loadedTable.rows[0].cells[0].id);
          }
        }
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

  // Handle global shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleUndo, handleRedo]);

  // Handle keystrokes (Tab, Enter, Arrows) bubbling up
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentTable = tableRef.current;
      const currentActiveCellId = activeCellRef.current;

      if (!currentActiveCellId || e.metaKey || e.altKey) {
        return;
      }
      if (e.ctrlKey && e.key !== 'Tab') {
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        flushEditingSession();
        const oldTable = currentTable;
        const oldActive = currentActiveCellId;
        if (e.ctrlKey) {
          const { newTable, newActiveCellId } = handleCtrlTab(currentTable, currentActiveCellId);
          const cmd = new DocumentCommand('Add Subtable', oldTable, newTable, oldActive, newActiveCellId, applyState);
          historyManager.execute(cmd);
        } else {
          const { newTable, newActiveCellId } = handleTab(currentTable, currentActiveCellId);
          const adjusted = adjustFormulasAfterStructureChange(currentTable, newTable);
          const finalTable = recalculateTable(adjusted);
          const cmd = new DocumentCommand('Add Column', oldTable, finalTable, oldActive, newActiveCellId, applyState);
          historyManager.execute(cmd);
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        flushEditingSession();
        const oldTable = currentTable;
        const oldActive = currentActiveCellId;
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
        const finalTable = recalculateTable(adjusted);
        const cmd = new DocumentCommand('Add Row', oldTable, finalTable, oldActive, newActiveCellId, applyState);
        historyManager.execute(cmd);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        flushEditingSession();
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
        flushEditingSession();
        const newActiveCellId = handleArrow(currentTable, currentActiveCellId, e.key as any);
        setActiveCellId(newActiveCellId);
        return;
      }
    },
    [applyState, flushEditingSession, historyManager]
  );

  const handleCellClick = (cellId: string) => {
    setActiveCellId(cellId);
  };

  const handleCellContextMenu = useCallback((e: React.MouseEvent, cellId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, cellId });
  }, []);

  const formulaRefStateRef = useRef<{ cellId: string; refText: string } | null>(null);
  useEffect(() => { formulaRefStateRef.current = null; }, [activeCellId]);

  const handleCellRefClick = useCallback((clickedCellId: string) => {
    if (!activeCellId) return;
    const activeTd = document.querySelector(`[data-cell-id="${activeCellId}"]`) as HTMLElement | null;
    if (!activeTd) return;

    const visualName = getCellNameById(documentTable, clickedCellId);
    if (!visualName) return;

    const relRef = visualName;
    const absRef = visualName
      .replace(/([A-Z]+)\./g, '$$$1.')
      .replace(/\.(\d+)/g, '.$$$1');

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
      const inserted = document.execCommand('insertText', false, relRef);
      if (!inserted) {
        const newText = (activeTd.textContent || '') + relRef;
        activeTd.textContent = newText;
        setDocumentTable(prev => updateCellText(prev, activeCellId, newText));
      }
      formulaRefStateRef.current = { cellId: clickedCellId, refText: relRef };
    }
    activeTd.focus();
  }, [activeCellId, documentTable]);

  const handleCellTypeChange = (newType: 'text' | 'number' | 'formula') => {
    if (activeCellId) {
      flushEditingSession();
      const oldTable = tableRef.current;
      const newTable = updateCellTypeInTree(oldTable, activeCellId, newType);
      const cmd = new DocumentCommand('Change Cell Type', oldTable, newTable, activeCellId, activeCellId, applyState);
      historyManager.execute(cmd);
    }
  };

  const handleCellStyleChange = (newStyle: HeadingStyle) => {
    if (activeCellId) {
      flushEditingSession();
      const oldTable = tableRef.current;
      const newTable = updateCellStyleInTree(oldTable, activeCellId, newStyle);
      const cmd = new DocumentCommand('Change Cell Style', oldTable, newTable, activeCellId, activeCellId, applyState);
      historyManager.execute(cmd);
    }
  };

  const activeCellProps = activeCellId ? findActiveCell(documentTable, activeCellId) : null;
  const activeCellType = getCellType(activeCellProps?.className);
  const activeCellStyle = getCellStyle(activeCellProps?.className);
  const isEditingFormula = (activeCellProps?.text ?? '').startsWith('=');
  
  const activeCellName = activeCellId ? getCellNameById(documentTable, activeCellId) : null;

  const handleDeleteMenuAction = (action: 'row' | 'column' | 'table') => {
    if (!contextMenu) return;
    flushEditingSession();
    const { cellId } = contextMenu;
    const oldTable = tableRef.current;
    const oldActive = activeCellId;
    let newTable = oldTable;
    if (action === 'row') newTable = deleteRow(newTable, cellId);
    if (action === 'column') newTable = deleteColumn(newTable, cellId);
    if (action === 'table') newTable = deleteTable(newTable, cellId);
    const adjusted = adjustFormulasAfterStructureChange(oldTable, newTable);
    const finalTable = recalculateTable(adjusted);
    const cmd = new DocumentCommand(`Delete ${action}`, oldTable, finalTable, oldActive, null, applyState);
    historyManager.execute(cmd);
    setContextMenu(null);
  };

  const handleImportFile = (importerId: string, file: File) => {
    if (!activeCellId) return;
    const importer = availableImporters.find(imp => imp.id === importerId);
    if (!importer) return;

    flushEditingSession();
    const oldTable = tableRef.current;
    const oldActive = activeCellId;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (typeof content === 'string') {
        const parsedSubTable = importer.parse(content);
        const finalTable = recalculateTable(insertSubTableAtCell(oldTable, oldActive, parsedSubTable));
        const cmd = new DocumentCommand(`Import ${importer.name}`, oldTable, finalTable, oldActive, oldActive, applyState);
        historyManager.execute(cmd);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div 
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', outline: 'none' }} 
      onClick={() => {
        flushEditingSession();
        setActiveCellId(null);
        if (contextMenu) setContextMenu(null);
      }}
      onKeyDown={handleKeyDown}
    >
      <TopBar 
        activeCellName={activeCellName} 
        activeCellType={activeCellType}
        activeCellStyle={activeCellStyle}
        onHelpClick={() => setShowHelp(true)}
        onCellTypeChange={handleCellTypeChange}
        onCellStyleChange={handleCellStyleChange}
        onImportFile={handleImportFile}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      <div 
        ref={documentContainerRef}
        style={{ flex: 1, overflow: 'auto', padding: '20px' }}
      >
        <Table 
          table={documentTable} 
          activeCellId={activeCellId}
          onCellClick={handleCellClick}
          onCellInput={(cellId, newText) => {
            setDocumentTable(prev => updateCellText(prev, cellId, newText));
          }}
          onCellContextMenu={handleCellContextMenu}
          isEditingFormula={isEditingFormula}
          onCellRefClick={handleCellRefClick}
          onDeselect={() => setActiveCellId(null)}
        />
      </div>
      {showHelp && <HelpPopup onClose={() => setShowHelp(false)} />}
      
      {contextMenu && (
        <div 
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            boxShadow: '2px 2px 5px rgba(0,0,0,0.2)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => handleDeleteMenuAction('row')}
            style={{ padding: '8px 12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            Supprimer la ligne
          </button>
          <button 
            onClick={() => handleDeleteMenuAction('column')}
            style={{ padding: '8px 12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            Supprimer la colonne
          </button>
          <button 
            onClick={() => handleDeleteMenuAction('table')}
            style={{ padding: '8px 12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            Supprimer le sous-tableau
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
