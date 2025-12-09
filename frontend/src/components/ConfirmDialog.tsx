/**
 * 确认对话框组件
 * 用于替换原生的 confirm 弹窗，提供更友好的用户体验
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  discardText?: string; // 新增：放弃按钮文本
  type?: 'warning' | 'danger' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  onDiscard?: () => void; // 新增：放弃按钮回调
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  discardText,
  type = 'warning',
  onConfirm,
  onCancel,
  onDiscard,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const typeStyles = {
    warning: {
      icon: 'text-yellow-400',
      iconBg: 'bg-yellow-400/10',
      button: 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg shadow-yellow-900/20',
      border: 'border-yellow-500/30',
      titleColor: 'text-yellow-100',
    },
    danger: {
      icon: 'text-red-400',
      iconBg: 'bg-red-400/10',
      button: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20',
      border: 'border-red-500/30',
      titleColor: 'text-red-100',
    },
    info: {
      icon: 'text-cyan-400',
      iconBg: 'bg-cyan-400/10',
      button: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20',
      border: 'border-cyan-500/30',
      titleColor: 'text-cyan-100',
    },
  };

  const styles = typeStyles[type];

  const dialogContent = (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div 
        className={clsx(
          "bg-tech-900 border rounded-xl w-full max-w-md shadow-2xl overflow-hidden",
          styles.border
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-tech-700 bg-tech-800/50">
          <div className="flex items-center gap-3">
            <div className={clsx("p-2 rounded-lg", styles.iconBg)}>
              <AlertTriangle size={20} className={styles.icon} />
            </div>
            <h3 className={clsx("text-base font-semibold", styles.titleColor)}>
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-tech-700 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-6">
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            {message}
          </p>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm bg-tech-700 hover:bg-tech-600 text-gray-300 rounded-lg transition-colors font-medium"
            >
              {cancelText}
            </button>
            {onDiscard && discardText && (
              <button
                onClick={onDiscard}
                className="px-4 py-2 text-sm bg-tech-700 hover:bg-tech-600 text-gray-300 rounded-lg transition-colors font-medium"
              >
                {discardText}
              </button>
            )}
            <button
              onClick={onConfirm}
              className={clsx(
                "px-4 py-2 text-sm rounded-lg transition-all font-medium",
                styles.button
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // 使用 Portal 渲染到 body，确保显示在最上层
  return typeof document !== 'undefined' 
    ? createPortal(dialogContent, document.body)
    : null;
}

