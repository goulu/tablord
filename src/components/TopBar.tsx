import React from 'react';

interface TopBarProps {
  activeCellId: string | null;
  onHelpClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeCellId, onHelpClick }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ccc', padding: '10px' }}>
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
      <div>
        {activeCellId ? `Active Cell: ${activeCellId}` : 'Ready'}
      </div>
    </div>
  );
};
