'use client';

import { useEffect, useRef, useState } from 'react';
import { Reply, Forward, Edit3, Trash2, Copy, Smile } from 'lucide-react';

interface MessageActionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onReply: () => void;
  onForward: () => void;
  onEdit?: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onReact: () => void;
  position: { x: number; y: number };
  isOwnMessage: boolean;
}

export function MessageActionsMenu({
  isOpen,
  onClose,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onCopy,
  onReact,
  position,
  isOwnMessage,
}: MessageActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    // Adjust position to keep menu on screen
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x;
    let y = position.y;

    // Keep menu within viewport
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 10;
    }
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 10;
    }
    if (x < 10) x = 10;
    if (y < 10) y = 10;

    setAdjustedPosition({ x, y });
  }, [isOpen, position]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    { icon: Smile, label: 'React', onClick: onReact, color: 'var(--text)' },
    { icon: Reply, label: 'Reply', onClick: onReply, color: 'var(--text)' },
    { icon: Forward, label: 'Forward', onClick: onForward, color: 'var(--text)' },
    { icon: Copy, label: 'Copy', onClick: onCopy, color: 'var(--text)' },
    ...(isOwnMessage && onEdit ? [{ icon: Edit3, label: 'Edit', onClick: onEdit, color: 'var(--text)' }] : []),
    { icon: Trash2, label: 'Delete', onClick: onDelete, color: 'var(--danger)' },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: `${adjustedPosition.y}px`,
        left: `${adjustedPosition.x}px`,
        zIndex: 3000,
        minWidth: 180,
        background: 'var(--surface)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border)',
        padding: '6px 0',
        backdropFilter: 'blur(12px)',
      }}
    >
      {menuItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={index}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: item.color,
              fontSize: 14,
              fontWeight: 500,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(100, 116, 139, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Icon size={16} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
