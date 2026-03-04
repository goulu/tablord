import React from 'react';

interface HelpPopupProps {
  onClose: () => void;
}

export const HelpPopup: React.FC<HelpPopupProps> = ({ onClose }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        maxWidth: '500px',
        width: '90%',
      }}>
        <h2 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Keyboard Shortcuts</h2>
        <ul style={{ lineHeight: '1.6', paddingLeft: '20px' }}>
          <li><strong>Text Input</strong>: Type to fill the active cell.</li>
          <li><strong>Backspace</strong>: Delete the last character in the active cell.</li>
          <li><strong>Arrow Keys</strong>: Navigate to the adjacent cell in the same table.</li>
          <li><strong>Tab</strong>: Move to the next cell on the right. If at the end of the row, a new column is created.</li>
          <li><strong>Enter</strong>: Create a new row below the current active cell.</li>
          <li><strong>Ctrl + Tab</strong>: Create a nested sub-table inside the current active cell.</li>
        </ul>
        <div style={{ textAlign: 'right', marginTop: '20px' }}>
          <button 
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
