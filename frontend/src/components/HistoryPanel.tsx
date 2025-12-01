/**
 * 历史记录面板组件
 * 显示所有历史操作记录，允许用户跳转到任意历史状态
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, History as HistoryIcon, Check, Clock } from 'lucide-react';
import clsx from 'clsx';
import { HistoryEntry } from '@/types';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  currentStep: number;
  onJumpToStep: (step: number) => void;
}

export default function HistoryPanel({
  isOpen,
  onClose,
  history,
  currentStep,
  onJumpToStep,
}: HistoryPanelProps) {
  const { t } = useTranslation(['common']);

  if (!isOpen) return null;

  // 格式化时间戳
  const formatTime = (timestamp: number) => {
    // 如果时间戳无效（0或未定义），返回提示信息
    if (!timestamp || timestamp <= 0) {
      console.warn('[HistoryPanel] Invalid timestamp:', timestamp);
      return t('common:history.invalidTime', '时间无效');
    }
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      // 今天的记录只显示时间
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } else {
      // 其他日期显示日期+时间
      return date.toLocaleString([], {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-tech-900 border border-tech-700 rounded-lg shadow-2xl w-[400px] max-h-[600px] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-tech-700">
          <div className="flex items-center gap-2">
            <HistoryIcon size={18} className="text-cyan-400" />
            <h2 className="text-base font-medium text-gray-200">
              {t('common:historyList', '历史记录列表')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-tech-800 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 历史记录列表 */}
        <div className="flex-1 overflow-y-auto p-2">
          {history.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              {t('common:noHistory', '暂无历史记录')}
            </div>
          ) : (
            <div className="space-y-1">
              {history.map((entry, index) => {
                const isCurrent = index === currentStep;
                const isFuture = index > currentStep;

                return (
                  <button
                    key={index}
                    onClick={() => onJumpToStep(index)}
                    className={clsx(
                      "w-full flex flex-col gap-1 px-3 py-2.5 rounded-lg text-sm transition-all",
                      isCurrent
                        ? "bg-cyan-600 text-white shadow-lg"
                        : isFuture
                        ? "bg-tech-800/50 text-gray-500 hover:bg-tech-800 hover:text-gray-400"
                        : "bg-tech-800 text-gray-300 hover:bg-tech-700"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        {isCurrent && <Check size={14} className="text-white" />}
                        <span className={clsx(
                          "font-medium",
                          isCurrent && "font-semibold"
                        )}>
                          {t(`common:${entry.description}`, entry.description)}
                        </span>
                      </div>
                      {isCurrent && (
                        <span className="text-xs text-cyan-200">
                          {t('common:currentState', '当前状态')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs opacity-70">
                      <Clock size={12} />
                      <span>{formatTime(entry.timestamp)}</span>
                      <span className="ml-auto font-mono">#{index}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="border-t border-tech-700 px-4 py-3 bg-tech-950/50">
          <p className="text-xs text-gray-500 text-center">
            {t('common:jumpToState', '点击任意历史记录跳转到该状态')}
          </p>
        </div>
      </div>
    </div>
  );
}

