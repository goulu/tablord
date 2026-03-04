import React from 'react';

interface TopBarProps {
  activeCellId: string | null;
}

export const TopBar: React.FC<TopBarProps> = ({ activeCellId }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ccc', padding: '10px' }}>
      <div>
        <button style={{ marginRight: '5px' }} title="Bold (placeholder)">B</button>
        <button style={{ marginRight: '5px' }} title="Italic (placeholder)">I</button>
        <button title="Underline (placeholder)">U</button>
      </div>
      <div>
        {activeCellId ? `Active Cell: ${activeCellId}` : 'Ready'}
      </div>
    </div>
  );
};
