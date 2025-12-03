/**
 * 设置上下文
 * 提供全局配置状态管理
 */

import React, { createContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { Settings, SettingsCategory } from '@/types';
import {
  loadSettings,
  saveSettings,
  resetSettings,
  exportSettings,
  importSettings,
  DEFAULT_SETTINGS,
} from '../services/settingsService';

// ==================== Action 类型 ====================

type SettingsAction =
  | { type: 'LOAD_SETTINGS'; payload: Settings }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { type: 'UPDATE_CATEGORY'; category: SettingsCategory; payload: Partial<Settings[SettingsCategory]> }
  | { type: 'RESET_SETTINGS' }
  | { type: 'IMPORT_SETTINGS'; payload: Settings };

// ==================== Context 类型 ====================

export interface SettingsContextType {
  settings: Settings;
  isLoaded: boolean;
  updateSettings: (updates: Partial<Settings>) => void;
  updateCategory: <T extends SettingsCategory>(category: T, updates: Partial<Settings[T]>) => void;
  resetAllSettings: () => void;
  exportSettingsToJson: (includeSensitive?: boolean) => string;
  importSettingsFromJson: (json: string) => boolean;
  manualSaveSettings: () => Promise<boolean>;
  reloadSettings: () => Promise<void>;
}

// ==================== Reducer ====================

function settingsReducer(state: Settings, action: SettingsAction): Settings {
  switch (action.type) {
    case 'LOAD_SETTINGS':
      return action.payload;
    
    case 'UPDATE_SETTINGS':
      return { ...state, ...action.payload };
    
    case 'UPDATE_CATEGORY':
      const currentCategory = state[action.category];
      return {
        ...state,
        [action.category]: {
          ...(currentCategory || {}),
          ...action.payload,
        },
      };
    
    case 'RESET_SETTINGS':
      return DEFAULT_SETTINGS;
    
    case 'IMPORT_SETTINGS':
      return action.payload;
    
    default:
      return state;
  }
}

// ==================== Context ====================

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// ==================== Provider ====================

interface SettingsProviderProps {
  children: ReactNode;
}

function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, dispatch] = useReducer(settingsReducer, DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // 初始化加载设置
  useEffect(() => {
    const initSettings = async () => {
      try {
        const loaded = await loadSettings();
        dispatch({ type: 'LOAD_SETTINGS', payload: loaded });
        setIsLoaded(true);
      } catch (error) {
        console.error('[SettingsContext] Failed to load settings:', error);
        // 使用默认设置
        setIsLoaded(true);
      }
    };

    initSettings();
  }, []);

  // 手动保存设置
  const manualSaveSettings = useCallback(async (): Promise<boolean> => {
    try {
      const success = await saveSettings(settings);
      if (!success) {
        console.warn('[SettingsContext] Failed to save settings');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SettingsContext] Failed to save settings:', error);
      return false;
    }
  }, [settings]);

  // 重新加载设置（用于取消修改）
  const reloadSettings = useCallback(async (): Promise<void> => {
    try {
      const loaded = await loadSettings();
      dispatch({ type: 'LOAD_SETTINGS', payload: loaded });
    } catch (error) {
      console.error('[SettingsContext] Failed to reload settings:', error);
    }
  }, []);

  // 更新整体设置
  const updateSettings = useCallback((updates: Partial<Settings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: updates });
  }, []);

  // 更新特定分类
  const updateCategory = useCallback(<T extends SettingsCategory>(
    category: T,
    updates: Partial<Settings[T]>
  ) => {
    dispatch({ type: 'UPDATE_CATEGORY', category, payload: updates });
  }, []);

  // 重置所有设置
  const resetAllSettings = useCallback(async () => {
    try {
      await resetSettings();
      dispatch({ type: 'RESET_SETTINGS' });
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  }, []);

  // 导出设置
  const exportSettingsToJson = useCallback((includeSensitive: boolean = false): string => {
    return exportSettings(settings, includeSensitive);
  }, [settings]);

  // 导入设置
  const importSettingsFromJson = useCallback((json: string): boolean => {
    const imported = importSettings(json);
    if (imported) {
      dispatch({ type: 'IMPORT_SETTINGS', payload: imported });
      return true;
    }
    return false;
  }, []);

  const value: SettingsContextType = {
    settings,
    isLoaded,
    updateSettings,
    updateCategory,
    resetAllSettings,
    exportSettingsToJson,
    importSettingsFromJson,
    manualSaveSettings,
    reloadSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// 导出组件
export { SettingsProvider };

// 重新导出 hooks（从单独的文件导入以支持 Fast Refresh）
export { useSettings, useSettingsCategory } from './useSettings';

