/**
 * 设置上下文
 * 提供全局配置状态管理
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { Settings, SettingsCategory } from '@/types';
import {
  loadSettings,
  saveSettings,
  resetSettings,
  exportSettings,
  importSettings,
  DEFAULT_SETTINGS,
} from '../services/settingsService';
import i18n from '../locales';

// ==================== Action 类型 ====================

type SettingsAction =
  | { type: 'LOAD_SETTINGS'; payload: Settings }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { type: 'UPDATE_CATEGORY'; category: SettingsCategory; payload: Partial<Settings[SettingsCategory]> }
  | { type: 'RESET_SETTINGS' }
  | { type: 'IMPORT_SETTINGS'; payload: Settings };

// ==================== Context 类型 ====================

interface SettingsContextType {
  settings: Settings;
  isLoaded: boolean;
  updateSettings: (updates: Partial<Settings>) => void;
  updateCategory: <T extends SettingsCategory>(category: T, updates: Partial<Settings[T]>) => void;
  resetAllSettings: () => void;
  exportSettingsToJson: (includeSensitive?: boolean) => string;
  importSettingsFromJson: (json: string) => boolean;
}

// ==================== Reducer ====================

function settingsReducer(state: Settings, action: SettingsAction): Settings {
  switch (action.type) {
    case 'LOAD_SETTINGS':
      return action.payload;
    
    case 'UPDATE_SETTINGS':
      return { ...state, ...action.payload };
    
    case 'UPDATE_CATEGORY':
      return {
        ...state,
        [action.category]: {
          ...state[action.category],
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

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// ==================== Provider ====================

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, dispatch] = useReducer(settingsReducer, DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // 初始化加载设置
  useEffect(() => {
    const initSettings = async () => {
      console.log('[SettingsContext] Initializing settings...');
      try {
        const loaded = await loadSettings();
        console.log('[SettingsContext] Settings loaded successfully:', loaded);
        dispatch({ type: 'LOAD_SETTINGS', payload: loaded });
        setIsLoaded(true);

        // 同步语言设置
        if (loaded.app.language !== i18n.language) {
          i18n.changeLanguage(loaded.app.language);
        }
      } catch (error) {
        console.error('[SettingsContext] Failed to load settings:', error);
        // 使用默认设置
        setIsLoaded(true);
      }
    };

    initSettings().then(r => console.log('initSettings resolved', r));
  }, []);

  // 用于跟踪是否是首次加载（避免首次加载时触发保存）
  const isFirstLoad = React.useRef(true);

  // 设置变更时自动保存
  useEffect(() => {
    if (isLoaded) {
      // 跳过首次加载时的保存（因为这时候 settings 是从后端加载的，不需要再保存回去）
      if (isFirstLoad.current) {
        console.log('[SettingsContext] Skipping first save (initial load)');
        isFirstLoad.current = false;
        return;
      }

      console.log('[SettingsContext] Settings changed, saving...', settings);

      const saveAsync = async () => {
        try {
          const success = await saveSettings(settings);
          if (!success) {
            console.warn('[SettingsContext] Settings save returned false, may not have been saved');
          } else {
            console.log('[SettingsContext] Settings saved successfully');
          }

          // 同步语言设置到 i18n
          if (settings.app.language !== i18n.language) {
            i18n.changeLanguage(settings.app.language);
          }
        } catch (error) {
          console.error('[SettingsContext] Failed to save settings:', error);
        }
      };

      saveAsync();
    }
  }, [settings, isLoaded]);

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
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// ==================== Hook ====================

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

