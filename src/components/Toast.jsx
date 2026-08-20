import React, { useEffect, useState } from 'react';

const ICONS = { success: '✓', error: '✕', info: 'ℹ' };

export default function Toast({ message, type = 'info', onDone }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation on next tick
    const tShow = setTimeout(() => setVisible(true), 10);
    const tHide = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, 3300);
    return () => { clearTimeout(tShow); clearTimeout(tHide); };
  }, []);

  return (
    <div className={`toast toast-${type} ${visible ? 'show' : 'hide'}`} role="alert">
      <span className="toast-icon">{ICONS[type] ?? ICONS.info}</span>
      <span>{message}</span>
    </div>
  );
}
