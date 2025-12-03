/**
 * 设置相关 Hooks
 * 从 SettingsContext 分离出来以支持 Fast Refresh
 */

import { useContext, useCallback } from 'react';
import { Settings, SettingsCategory } from '@/types';
import { SettingsContext, SettingsContextType } from './SettingsContext';

/**
 * 使用设置 Hook
 */
export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

/**
 * 获取特定分类的设置
 */
export function useSettingsCategory<T extends SettingsCategory>(category: T) {
  const { settings, updateCategory } = useSettings();
  
  const update = useCallback((updates: Partial<Settings[T]>) => {
    updateCategory(category, updates);
  }, [category, updateCategory]);

  return {
    settings: settings[category],
    update,
  };
}

