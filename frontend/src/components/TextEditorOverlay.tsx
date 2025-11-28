import React from 'react';

export interface EditingTextState {
  id: string;
  value: string;
  x: number;
  y: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  fill: string;
  width: number;
  rotation: number;
  align: string;
}

interface TextEditorOverlayProps {
  editingText: EditingTextState | null;
  onChange: (value: string) => void;
  onCommit: () => void;
}

const TextEditorOverlay: React.FC<TextEditorOverlayProps> = ({ editingText, onChange, onCommit }) => {
  if (!editingText) return null;

  return (
    <textarea
      value={editingText.value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onCommit();
        }
      }}
      style={{
        position: 'absolute',
        top: `${editingText.y}px`,
        left: `${editingText.x}px`,
        width: `${editingText.width + 20}px`,
        height: 'auto',
        fontSize: `${editingText.fontSize}px`,
        lineHeight: editingText.lineHeight,
        fontFamily: editingText.fontFamily,
        color: editingText.fill,
        transform: `rotate(${editingText.rotation}deg)`,
        transformOrigin: 'top left',
        background: 'transparent',
        border: '1px dashed #06B6D4',
        outline: 'none',
        overflow: 'hidden',
        zIndex: 100,
        textAlign: editingText.align as any,
      }}
      autoFocus
    />
  );
};

export default TextEditorOverlay;
