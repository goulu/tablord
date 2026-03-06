import React from 'react';

interface TopBarProps {
  activeCellName: string | null;
  activeCellType: 'text' | 'number' | 'formula' | undefined;
  onHelpClick: () => void;
  onCellTypeChange: (type: 'text' | 'number' | 'formula') => void;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  activeCellName, 
  activeCellType,
  onHelpClick, 
  onCellTypeChange 
}) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', padding: '10px' }}>
      <div>
        <button style={{ marginRight: '5px' }} title="Bold (placeholder)">B</button>
        <button style={{ marginRight: '5px' }} title="Italic (placeholder)">I</button>
        <button style={{ marginRight: '15px' }} title="Underline (placeholder)">U</button>
        <button 
           onClick={onHelpClick}
           style={{ backgroundColor: '#e2f0ff', borderColor: '#b3d4fc', color: '#0056b3' }}
           title="Show Help"
        >
          Help
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ marginRight: '10px' }}>
          {activeCellName ? `${activeCellName}` : 'Ready'}
        </span>
        {activeCellName && (
          <select 
            value={activeCellType || 'text'} 
            onChange={(e) => onCellTypeChange(e.target.value as any)}
            style={{ padding: '4px' }}
          >
            <option value="text">text</option>
            <option value="number">number</option>
            <option value="formula">formula</option>
          </select>
        )}
      </div>
    </div>
  );
};
