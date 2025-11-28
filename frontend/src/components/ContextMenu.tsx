
import React, { useEffect, useRef } from 'react';
import { Copy, Trash2, ArrowUp, ArrowDown, BringToFront, SendToBack, Sparkles, Group, FolderInput } from 'lucide-react';

export interface ContextMenuItem {
    id: string;
    label: string;
    icon?: any;
    shortcut?: string;
    color?: string;
    type?: 'item' | 'divider';
}

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAction: (action: string) => void;
  items?: ContextMenuItem[];
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onAction, items }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const defaultItems: ContextMenuItem[] = [
    { id: 'group', label: 'Group Selection', icon: Group, shortcut: 'Ctrl+G' },
    { id: 'ungroup', label: 'Ungroup', icon: FolderInput, shortcut: 'Ctrl+Sh+G' },
    { type: 'divider', id: 'div1', label: '' },
    { id: 'ai-blend', label: 'AI Blend with Below', icon: Sparkles, color: 'text-purple-400' },
    { type: 'divider', id: 'div2', label: '' },
    { id: 'duplicate', label: 'Duplicate Layer', icon: Copy, shortcut: 'Ctrl+D' },
    { id: 'delete', label: 'Delete Layer', icon: Trash2, shortcut: 'Del', color: 'text-red-400' },
    { type: 'divider', id: 'div3', label: '' },
    { id: 'bringToFront', label: 'Bring to Front', icon: BringToFront },
    { id: 'bringForward', label: 'Bring Forward', icon: ArrowUp },
    { id: 'sendBackward', label: 'Send Backward', icon: ArrowDown },
    { id: 'sendToBack', label: 'Send to Back', icon: SendToBack },
  ];

  const menuItems = items || defaultItems;

  // Adjust position if close to edge
  const style = {
      top: Math.min(y, window.innerHeight - (menuItems.length * 36)),
      left: Math.min(x, window.innerWidth - 200),
  };

  return (
    <div 
        ref={menuRef}
        className="fixed z-50 w-60 bg-tech-900 border border-tech-600 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        style={style}
    >
      {menuItems.map((item, idx) => {
          if (item.type === 'divider') {
              return <div key={idx} className="h-px bg-tech-700 my-1" />;
          }
          const Icon = item.icon as any;
          return (
            <button
                key={item.id}
                onClick={() => { onAction(item.id || ''); onClose(); }}
                className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-tech-800 transition-colors ${item.color || 'text-gray-300'}`}
            >
                {Icon && <Icon size={14} />}
                <span className="text-xs font-medium flex-1">{item.label}</span>
                {item.shortcut && <span className="text-[10px] text-gray-500 font-mono">{item.shortcut}</span>}
            </button>
          )
      })}
    </div>
  );
};

export default ContextMenu;
