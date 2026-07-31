import React, { useRef, useState } from 'react';
import { availableImporters } from '../import';

interface TopBarProps {
  activeCellName: string | null;
  activeCellType: 'text' | 'number' | 'formula' | 'markdown' | undefined;
  activeCellStyle?: 'none' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | undefined;
  onHelpClick: () => void;
  onCellTypeChange: (type: 'text' | 'number' | 'formula' | 'markdown') => void;
  onCellStyleChange?: (style: 'none' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') => void;
  onImportFile: (importerId: string, file: File) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  activeCellName, 
  activeCellType,
  activeCellStyle = 'none',
  onHelpClick, 
  onCellTypeChange,
  onCellStyleChange,
  onImportFile,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedImporterIdRef = useRef<string | null>(null);
  const [fileAccept, setFileAccept] = useState<string>('*');

  const handleImportSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const importerId = e.target.value;
    if (!importerId) return;

    if (!activeCellName) {
      alert('Veuillez d\'abord sélectionner une cellule où importer le sous-tableau.');
      e.target.value = '';
      return;
    }

    const importer = availableImporters.find(imp => imp.id === importerId);
    if (importer) {
      selectedImporterIdRef.current = importer.id;
      setFileAccept(importer.fileExtensions.join(','));
      // Reset input value to allow re-selecting the same file if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
    }
    e.target.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const importerId = selectedImporterIdRef.current;
    if (file && importerId) {
      onImportFile(importerId, file);
    }
    selectedImporterIdRef.current = null;
  };

  return (
    <div 
      onClick={(e) => e.stopPropagation()} 
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', padding: '10px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button style={{ marginRight: '5px' }} title="Bold (placeholder)">B</button>
        <button style={{ marginRight: '5px' }} title="Italic (placeholder)">I</button>
        <button style={{ marginRight: '15px' }} title="Underline (placeholder)">U</button>

        <button 
          onClick={onUndo} 
          disabled={!canUndo} 
          style={{ marginRight: '5px', padding: '4px 8px', cursor: canUndo ? 'pointer' : 'default', opacity: canUndo ? 1 : 0.4 }} 
          title="Annuler (Ctrl+Z)"
        >
          ↺ Undo
        </button>
        <button 
          onClick={onRedo} 
          disabled={!canRedo} 
          style={{ marginRight: '15px', padding: '4px 8px', cursor: canRedo ? 'pointer' : 'default', opacity: canRedo ? 1 : 0.4 }} 
          title="Rétablir (Ctrl+Y / Ctrl+Shift+Z)"
        >
          ↻ Redo
        </button>
        
        <select 
          defaultValue=""
          onChange={handleImportSelect}
          style={{ marginRight: '15px', padding: '4px', cursor: 'pointer' }}
          title="Importer un fichier dans la cellule courante"
        >
          <option value="" disabled>Import...</option>
          {availableImporters.map(imp => (
            <option key={imp.id} value={imp.id}>{imp.name}</option>
          ))}
        </select>

        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept={fileAccept}
          onChange={handleFileChange}
        />

        <button 
           onClick={onHelpClick}
           style={{ backgroundColor: '#e2f0ff', borderColor: '#b3d4fc', color: '#0056b3' }}
           title="Show Help"
        >
          Help
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ marginRight: '4px' }}>
          {activeCellName ? `${activeCellName}` : 'Ready'}
        </span>
        {activeCellName && (
          <>
            <select 
              value={activeCellType || 'text'} 
              onChange={(e) => onCellTypeChange(e.target.value as any)}
              style={{ padding: '4px' }}
              title="Type de cellule"
            >
              <option value="text">text</option>
              <option value="number">number</option>
              <option value="formula">formula</option>
              <option value="markdown">markdown</option>
            </select>

            <select
              value={activeCellStyle || 'none'}
              onChange={(e) => onCellStyleChange && onCellStyleChange(e.target.value as any)}
              style={{ padding: '4px' }}
              title="Style de cellule (titre)"
            >
              <option value="none">Standard</option>
              <option value="h1">Titre 1 (h1)</option>
              <option value="h2">Titre 2 (h2)</option>
              <option value="h3">Titre 3 (h3)</option>
              <option value="h4">Titre 4 (h4)</option>
              <option value="h5">Titre 5 (h5)</option>
              <option value="h6">Titre 6 (h6)</option>
            </select>
          </>
        )}
      </div>
    </div>
  );
};
