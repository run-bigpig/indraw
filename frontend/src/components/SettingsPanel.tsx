/**
 * 设置面板组件
 * 提供用户配置界面
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import {
  X,
  Settings,
  Cpu,
  Palette,
  Wrench,
  Eye,
  EyeOff,
  Download,
  Upload,
  RotateCcw,
  Check,
  AlertCircle,
  Brain,
  Loader2,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';
import clsx from 'clsx';
import { useSettings } from '../contexts/SettingsContext';
import { Settings as SettingsType, SettingsCategory } from '@/types';
import { AVAILABLE_FONTS, DEFAULT_FONT, isSymbolFont } from '@/constants/fonts';
import ConfirmDialog from './ConfirmDialog';
// ✅ 导入 wailsRuntime 以获取 window.runtime 类型定义
import '../utils/wailsRuntime';
import {
  getAvailableModels,
  getModelStatus,
  switchModel,
  downloadModel,
  getDownloadConfig,
  setDownloadConfig,
  HFDownloadConfig,
} from '../services/transformersService';
import { SelectDirectory, CheckAIProviderAvailability, CheckForUpdate, GetCurrentVersion, Update } from '../../wailsjs/go/core/App';

// ==================== 类型定义 ====================

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = SettingsCategory | 'models' | 'about';

// ==================== 子组件 ====================

const InputGroup = ({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs text-gray-300 font-medium">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-gray-500">{hint}</p>}
  </div>
);

const TextInput = ({ 
  value, 
  onChange, 
  placeholder,
  type = 'text',
  disabled = false
}: { 
  value: string; 
  onChange: (val: string) => void; 
  placeholder?: string;
  type?: 'text' | 'password';
  disabled?: boolean;
}) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
    className={clsx(
      "w-full bg-tech-900 border border-tech-700 rounded px-3 py-2 text-sm text-gray-300",
      "focus:border-cyan-500 focus:outline-none transition-colors",
      "placeholder:text-gray-600",
      disabled && "opacity-50 cursor-not-allowed"
    )}
  />
);

const NumberInput = ({ 
  value, 
  onChange, 
  min, 
  max,
  step = 1
}: { 
  value: number; 
  onChange: (val: number) => void; 
  min?: number;
  max?: number;
  step?: number;
}) => (
  <input
    type="number"
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    min={min}
    max={max}
    step={step}
    className="w-full bg-tech-900 border border-tech-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-cyan-500 focus:outline-none transition-colors"
  />
);

const SelectInput = ({ 
  value, 
  onChange, 
  options 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  options: { value: string; label: string }[];
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full bg-tech-900 border border-tech-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-cyan-500 focus:outline-none transition-colors cursor-pointer"
  >
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

const ColorInput = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => (
  <div className="flex gap-2 items-center">
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-10 h-10 rounded border border-tech-700 cursor-pointer bg-transparent"
    />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 bg-tech-900 border border-tech-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-cyan-500 focus:outline-none transition-colors font-mono"
    />
  </div>
);

const TextAreaInput = ({
  value,
  onChange,
  placeholder,
  rows = 6,
  error
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  error?: string;
}) => (
  <div className="flex flex-col gap-1">
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={clsx(
        "w-full bg-tech-900 border rounded px-3 py-2 text-sm text-gray-300",
        "focus:outline-none transition-colors resize-none font-mono",
        "placeholder:text-gray-600",
        error ? "border-red-500 focus:border-red-400" : "border-tech-700 focus:border-cyan-500"
      )}
    />
    {error && <p className="text-[10px] text-red-400">{error}</p>}
  </div>
);

const RadioGroup = ({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
}) => (
  <div className="flex gap-4">
    {options.map((opt) => (
      <label
        key={opt.value}
        className="flex items-center gap-2 cursor-pointer group"
      >
        <div className="relative">
          <input
            type="radio"
            value={opt.value}
            checked={value === opt.value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
          <div className={clsx(
            "w-4 h-4 rounded-full border-2 transition-colors",
            value === opt.value
              ? "border-cyan-500 bg-cyan-500"
              : "border-tech-600 group-hover:border-tech-500"
          )}>
            {value === opt.value && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
            )}
          </div>
        </div>
        <span className="text-sm text-gray-300">{opt.label}</span>
      </label>
    ))}
  </div>
);

const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (val: boolean) => void; label: string }) => (
  <label className="flex items-center justify-between cursor-pointer">
    <span className="text-xs text-gray-300">{label}</span>
    <div 
      className={clsx(
        "w-10 h-5 rounded-full transition-colors relative",
        checked ? "bg-cyan-600" : "bg-tech-700"
      )}
      onClick={() => onChange(!checked)}
    >
      <div 
        className={clsx(
          "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </div>
  </label>
);

const Slider = ({ 
  value, 
  min, 
  max, 
  step = 1, 
  onChange,
  showValue = true
}: { 
  value: number; 
  min: number; 
  max: number; 
  step?: number; 
  onChange: (val: number) => void;
  showValue?: boolean;
}) => (
  <div className="flex items-center gap-3">
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1 h-1.5 bg-tech-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500 hover:[&::-webkit-slider-thumb]:bg-cyan-400"
    />
    {showValue && <span className="text-xs text-cyan-400 w-12 text-right">{value}</span>}
  </div>
);

// ==================== 主组件 ====================

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { t } = useTranslation();
  const {
    settings,
    updateCategory,
    resetAllSettings,
    exportSettingsToJson,
    importSettingsFromJson,
    manualSaveSettings,
    reloadSettings
  } = useSettings();

  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showOpenaiApiKey, setShowOpenaiApiKey] = useState(false);
  const [showOpenaiImageApiKey, setShowOpenaiImageApiKey] = useState(false);
  const [showCloudToken, setShowCloudToken] = useState(false);
  const [vertexCredentialsError, setVertexCredentialsError] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    discardText?: string;
    type?: 'warning' | 'danger' | 'info';
    onConfirm: () => void;
    onCancel?: () => void;
    onDiscard?: () => void;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 模型管理状态
  const [models, setModels] = useState<Array<{
    id: string;
    name: string;
    description: string;
    repoId: string;
    size: number;
    downloaded: boolean;
    isDownloading: boolean;
  }>>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  // ✅ 下载进度状态：{ modelId: { fileName: string, progress: number, downloaded: number, total: number } }
  const [downloadProgress, setDownloadProgress] = useState<Record<string, { fileName: string; progress: number; downloaded: number; total: number }>>({});
  const [downloadConfig, setDownloadConfigState] = useState<HFDownloadConfig>({
    useMirror: true,
    proxyUrl: '',
    insecureSsl: false,
  });

  // 更新检测状态
  const [currentVersion, setCurrentVersion] = useState<string>('1.0.0');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdate: boolean;
    latestVersion: string;
    currentVersion: string;
    releaseUrl: string;
    releaseNotes: string;
    error?: string;
  } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);

  // showMessage 函数需要在所有 Hooks 之前定义
  const showMessage = React.useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  // 加载模型列表和状态
  const loadModels = React.useCallback(async () => {
    setLoadingModels(true);
    try {
      // 新 API 直接返回带状态的模型列表
      const availableModels = await getAvailableModels();
      setModels(availableModels);
      
      // 同时加载下载配置
      const config = await getDownloadConfig();
      setDownloadConfigState(config);
    } catch (error) {
      console.error('Failed to load models:', error);
      showMessage('error', '加载模型列表失败');
    } finally {
      setLoadingModels(false);
    }
  }, [showMessage]);

  // 当切换到模型标签页时加载模型列表
  React.useEffect(() => {
    if (activeTab === 'models') {
      loadModels();
    }
  }, [activeTab, loadModels]);

  // 当切换到关于标签页时加载当前版本
  React.useEffect(() => {
    if (activeTab === 'about') {
      loadCurrentVersion();
    }
  }, [activeTab]);

  // 加载当前版本
  const loadCurrentVersion = async () => {
    try {
      const version = await GetCurrentVersion();
      setCurrentVersion(version);
    } catch (error) {
      console.error('Failed to load current version:', error);
    }
  };

  // 检查更新
  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateInfo(null);

    try {
      const resultJSON = await CheckForUpdate();
      const result = JSON.parse(resultJSON);
      setUpdateInfo(result);

      if (result.hasUpdate) {
        showMessage('success', `发现新版本: ${result.latestVersion}`);
      } else if (result.error) {
        showMessage('error', result.error);
      } else {
        showMessage('success', '当前已是最新版本');
      }
    } catch (error: any) {
      const errorMessage = error.message || '检查更新失败';
      setUpdateInfo({
        hasUpdate: false,
        latestVersion: currentVersion,
        currentVersion: currentVersion,
        releaseUrl: '',
        releaseNotes: '',
        error: errorMessage,
      });
      showMessage('error', errorMessage);
    } finally {
      setCheckingUpdate(false);
    }
  };

  // 执行程序内更新
  const handleUpdate = async () => {
    if (!updateInfo?.hasUpdate) {
      return;
    }

    setUpdating(true);
    setShowUpdateConfirm(false);

    try {
      await Update();
      showMessage('success', `成功更新到版本 ${updateInfo.latestVersion}，请重启应用程序以应用更新`);
      // 更新当前版本显示
      setCurrentVersion(updateInfo.latestVersion);
      setUpdateInfo({
        ...updateInfo,
        hasUpdate: false,
        currentVersion: updateInfo.latestVersion,
      });
    } catch (error: any) {
      const errorMessage = error.message || '更新失败';
      showMessage('error', errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  // ✅ 监听模型下载进度事件
  useEffect(() => {
    // 检查 runtime 是否可用
    if (typeof window === 'undefined' || !window.runtime || !window.runtime.EventsOn) {
      return;
    }

    // 监听下载开始事件
    const unsubscribeStarted = window.runtime.EventsOn('model-download-started', (modelId: string) => {
      setDownloadingModelId(modelId);
      setDownloadProgress({});
    });

    // 监听文件开始下载事件
    const unsubscribeFileStarted = window.runtime.EventsOn('model-download-file-started', (modelId: string, fileName: string, fileType: string) => {
      setDownloadProgress(prev => ({
        ...prev,
        [modelId]: {
          fileName,
          progress: 0,
          downloaded: 0,
          total: 0,
        }
      }));
    });

    // 监听下载进度事件
    const unsubscribeProgress = window.runtime.EventsOn('model-download-progress', (modelId: string, fileName: string, progress: number, downloaded: number, total: number) => {
      setDownloadProgress(prev => ({
        ...prev,
        [modelId]: {
          fileName,
          progress,
          downloaded,
          total,
        }
      }));
    });

    // 监听文件下载完成事件
    const unsubscribeFileComplete = window.runtime.EventsOn('model-download-file-complete', (modelId: string, fileName: string) => {
      // 文件下载完成，进度设为 100%
      setDownloadProgress(prev => ({
        ...prev,
        [modelId]: {
          fileName,
          progress: 100,
          downloaded: prev[modelId]?.total || 0,
          total: prev[modelId]?.total || 0,
        }
      }));
    });

    // 监听下载完成事件
    const unsubscribeCompleted = window.runtime.EventsOn('model-download-completed', (modelId: string) => {
      setDownloadingModelId(null);
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[modelId];
        return newProgress;
      });
      showMessage('success', '模型下载完成');
      loadModels(); // 重新加载状态
    });

    // 监听下载错误事件
    const unsubscribeError = window.runtime.EventsOn('model-download-error', (modelId: string, error: string) => {
      setDownloadingModelId(null);
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[modelId];
        return newProgress;
      });
      showMessage('error', `下载失败: ${error}`);
      loadModels(); // 重新加载状态
    });

    // 监听文件跳过事件
    const unsubscribeSkipped = window.runtime.EventsOn('model-download-file-skipped', (modelId: string, fileName: string, reason: string) => {
      // 可选文件跳过，不影响整体进度
      console.log(`[ModelDownload] 跳过文件 ${fileName}: ${reason}`);
    });

    // 清理函数
    return () => {
      if (unsubscribeStarted) unsubscribeStarted();
      if (unsubscribeFileStarted) unsubscribeFileStarted();
      if (unsubscribeProgress) unsubscribeProgress();
      if (unsubscribeFileComplete) unsubscribeFileComplete();
      if (unsubscribeCompleted) unsubscribeCompleted();
      if (unsubscribeError) unsubscribeError();
      if (unsubscribeSkipped) unsubscribeSkipped();
    };
  }, [loadModels, showMessage]);

  // JSON 验证函数
  const validateJSON = (jsonString: string): boolean => {
    if (!jsonString.trim()) {
      setVertexCredentialsError('');
      return true;
    }
    try {
      const parsed = JSON.parse(jsonString);
      // 验证是否包含必要的 GCP 服务账号字段
      if (parsed.type === 'service_account' && parsed.project_id && parsed.private_key) {
        setVertexCredentialsError('');
        return true;
      } else {
        setVertexCredentialsError('无效的服务账号 JSON 格式');
        return false;
      }
    } catch (e) {
      setVertexCredentialsError('JSON 格式错误');
      return false;
    }
  };

  // 包装 updateCategory 以标记未保存状态
  const handleUpdateCategory = <T extends SettingsCategory>(
    category: T,
    updates: Partial<SettingsType[T]>
  ) => {
    updateCategory(category, updates);
    setHasUnsavedChanges(true);
  };

  // 关闭面板时检查未保存的修改
  const handleClose = async () => {
    if (hasUnsavedChanges) {
      setConfirmDialog({
        isOpen: true,
        title: t('settings.unsavedChangesTitle', '未保存的修改'),
        message: t('settings.unsavedChangesMessage', '检测到未保存的修改，是否保存？'),
        confirmText: t('settings.save', '保存'),
        cancelText: t('settings.cancel', '取消'),
        discardText: t('settings.discard', '放弃'),
        type: 'warning',
        onConfirm: async () => {
          setConfirmDialog(null);
          const success = await manualSaveSettings();
          if (success) {
            setHasUnsavedChanges(false);
            showMessage('success', t('settings.saveSuccess', '设置已保存'));
            onClose();
          } else {
            showMessage('error', t('settings.saveError', '保存失败，请重试'));
            // 保存失败时不关闭面板
          }
        },
        onCancel: () => {
          setConfirmDialog(null);
          // 取消操作，不关闭面板
        },
        onDiscard: async () => {
          setConfirmDialog(null);
          await reloadSettings();
          setHasUnsavedChanges(false);
          onClose();
        },
      });
      return;
    }
    onClose();
  };

  if (!isOpen) return null;

  const tabs: { id: TabType; icon: React.ReactNode; label: string }[] = [
    { id: 'ai', icon: <Cpu size={16} />, label: t('settings.tabs.ai', 'AI 服务') },
    { id: 'canvas', icon: <Palette size={16} />, label: t('settings.tabs.canvas', '画布') },
    { id: 'tools', icon: <Wrench size={16} />, label: t('settings.tabs.tools', '工具') },
    { id: 'app', icon: <Settings size={16} />, label: t('settings.tabs.app', '应用') },
    { id: 'models', icon: <Brain size={16} />, label: t('settings.tabs.models', '模型') },
    { id: 'about', icon: <Info size={16} />, label: t('settings.tabs.about', '关于') },
  ];

  const handleExport = () => {
    const json = exportSettingsToJson(false);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `indraw-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showMessage('success', t('settings.exportSuccess', '设置已导出'));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const success = importSettingsFromJson(content);
      if (success) {
        showMessage('success', t('settings.importSuccess', '设置已导入'));
      } else {
        showMessage('error', t('settings.importError', '导入失败，文件格式无效'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleReset = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('settings.resetTitle', '重置设置'),
      message: t('settings.resetConfirm', '确定要重置所有设置吗？此操作不可撤销。'),
      confirmText: t('settings.reset', '重置'),
      cancelText: t('settings.cancel', '取消'),
      type: 'danger',
      onConfirm: () => {
        setConfirmDialog(null);
        resetAllSettings();
        showMessage('success', t('settings.resetSuccess', '设置已重置'));
      },
    });
  };

  // 检测服务可用性
  const handleCheckAvailability = async () => {
    const provider = settings.ai.provider;
    if (!provider) {
      showMessage('error', '请先选择服务提供商');
      return;
    }

    setCheckingAvailability(true);
    setAvailabilityStatus(null);

    try {
      // 先保存设置，确保检测使用的是最新配置
      await manualSaveSettings();
      
      const resultJSON = await CheckAIProviderAvailability(provider);
      const result = JSON.parse(resultJSON);
      
      setAvailabilityStatus({
        available: result.available,
        message: result.message || '',
      });

      if (result.available) {
        showMessage('success', t('settings.ai.availabilityCheckSuccess', '服务可用'));
      } else {
        showMessage('error', result.message || t('settings.ai.availabilityCheckFailed', '服务不可用'));
      }
    } catch (error: any) {
      const errorMessage = error.message || t('settings.ai.availabilityCheckError', '检测失败');
      setAvailabilityStatus({
        available: false,
        message: errorMessage,
      });
      showMessage('error', errorMessage);
    } finally {
      setCheckingAvailability(false);
    }
  };

  // 渲染 AI 设置
  const renderAISettings = () => (
    <div className="space-y-4">
      {/* 服务提供商选择 */}
      <InputGroup
        label={t('settings.ai.provider', '服务提供商')}
        hint={t('settings.ai.providerHint', '选择 AI 服务提供商')}
      >
        <SelectInput
          value={settings.ai.provider}
          onChange={(val) => handleUpdateCategory('ai', { provider: val as 'gemini' | 'openai' | 'cloud' })}
          options={[
            { value: 'gemini', label: t('settings.ai.providerGemini', 'Google Gemini') },
            { value: 'openai', label: t('settings.ai.providerOpenai', 'OpenAI 兼容') },
            { value: 'cloud', label: t('settings.ai.providerCloud', '云服务') },
          ]}
        />
      </InputGroup>

      {/* Gemini 配置 */}
      {settings.ai.provider === 'gemini' && (
        <>
          {/* 后端模式选择 */}
          <InputGroup
            label={t('settings.ai.backendMode', '后端模式')}
            hint={t('settings.ai.backendModeHint', '选择 Gemini API 或 Vertex AI')}
          >
            <RadioGroup
              value={settings.ai.useVertexAI ? 'vertex' : 'api'}
              onChange={(val) => handleUpdateCategory('ai', { useVertexAI: val === 'vertex' })}
              options={[
                { value: 'api', label: 'Gemini API' },
                { value: 'vertex', label: 'Vertex AI' }
              ]}
            />
          </InputGroup>

          {/* Gemini API 模式 */}
          {!settings.ai.useVertexAI && (
            <InputGroup
              label={t('settings.ai.apiKey', 'API Key')}
              hint={t('settings.ai.apiKeyHint', '用于调用 Google Gemini API')}
            >
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <TextInput
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.ai.apiKey}
                    onChange={(val) => handleUpdateCategory('ai', { apiKey: val })}
                    placeholder={t('settings.ai.apiKeyPlaceholder', '输入您的 API Key')}
                  />
                </div>
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-3 bg-tech-800 border border-tech-700 rounded hover:bg-tech-700 transition-colors"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </InputGroup>
          )}

          {/* Vertex AI 模式 */}
          {settings.ai.useVertexAI && (
            <>
              <InputGroup
                label={t('settings.ai.vertexProject', 'GCP 项目 ID')}
                hint={t('settings.ai.vertexProjectHint', 'Google Cloud Platform 项目 ID')}
              >
                <TextInput
                  value={settings.ai.vertexProject}
                  onChange={(val) => handleUpdateCategory('ai', { vertexProject: val })}
                  placeholder="my-project-123"
                />
              </InputGroup>

              <InputGroup
                label={t('settings.ai.vertexLocation', 'GCP 区域')}
                hint={t('settings.ai.vertexLocationHint', '选择最近的 GCP 区域以获得最佳性能')}
              >
                <SelectInput
                  value={settings.ai.vertexLocation}
                  onChange={(val) => handleUpdateCategory('ai', { vertexLocation: val })}
                  options={[
                    {value:'global',label:'global(Global)'},
                    { value: 'us-central1', label: 'us-central1 (Iowa, USA)' },
                    { value: 'us-east1', label: 'us-east1 (South Carolina, USA)' },
                    { value: 'us-east4', label: 'us-east4 (Virginia, USA)' },
                    { value: 'us-west1', label: 'us-west1 (Oregon, USA)' },
                    { value: 'us-west4', label: 'us-west4 (Nevada, USA)' },
                    { value: 'europe-west1', label: 'europe-west1 (Belgium)' },
                    { value: 'europe-west2', label: 'europe-west2 (London, UK)' },
                    { value: 'europe-west3', label: 'europe-west3 (Frankfurt, Germany)' },
                    { value: 'europe-west4', label: 'europe-west4 (Netherlands)' },
                    { value: 'asia-east1', label: 'asia-east1 (Taiwan)' },
                    { value: 'asia-northeast1', label: 'asia-northeast1 (Tokyo, Japan)' },
                    { value: 'asia-northeast3', label: 'asia-northeast3 (Seoul, South Korea)' },
                    { value: 'asia-southeast1', label: 'asia-southeast1 (Singapore)' },
                    { value: 'australia-southeast1', label: 'australia-southeast1 (Sydney)' },
                  ]}
                />
              </InputGroup>

              <InputGroup
                label={t('settings.ai.vertexCredentials', '服务账号 JSON')}
                hint={
                  <span className="flex items-center gap-1">
                    {t('settings.ai.vertexCredentialsHint', 'GCP 服务账号密钥 JSON 文件内容')}
                    <a
                      href="https://cloud.google.com/iam/docs/service-accounts-create"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 underline ml-1"
                    >
                      {t('settings.ai.howToGetCredentials', '如何获取？')}
                    </a>
                  </span>
                }
              >
                <TextAreaInput
                  value={settings.ai.vertexCredentials}
                  onChange={(val) => {
                    handleUpdateCategory('ai', { vertexCredentials: val });
                    validateJSON(val);
                  }}
                  placeholder={`{\n  "type": "service_account",\n  "project_id": "your-project-id",\n  "private_key_id": "...",\n  "private_key": "...",\n  ...\n}`}
                  rows={8}
                  error={vertexCredentialsError}
                />
              </InputGroup>
            </>
          )}

          {/* 模型配置（两种模式共用）*/}
          <InputGroup
            label={t('settings.ai.textModel', '文本模型')}
            hint={t('settings.ai.textModelHint', '用于文本生成和理解')}
          >
            <TextInput
              value={settings.ai.textModel}
              onChange={(val) => handleUpdateCategory('ai', { textModel: val })}
              placeholder="gemini-2.5-flash"
            />
          </InputGroup>

          <InputGroup
            label={t('settings.ai.imageModel', '图像模型')}
            hint={t('settings.ai.imageModelHint', '用于图像生成和编辑')}
          >
            <TextInput
              value={settings.ai.imageModel}
              onChange={(val) => handleUpdateCategory('ai', { imageModel: val })}
              placeholder="gemini-2.5-flash-preview-05-20"
            />
          </InputGroup>

          {/* 服务可用性检测 */}
          <div className="pt-2 border-t border-tech-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-300 font-medium">{t('settings.ai.availabilityCheck', '服务可用性检测')}</span>
              <button
                onClick={handleCheckAvailability}
                disabled={checkingAvailability}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors",
                  checkingAvailability
                    ? "bg-tech-700 text-gray-500 cursor-not-allowed"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white"
                )}
              >
                {checkingAvailability ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    {t('settings.ai.checking', '检测中...')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={12} />
                    {t('settings.ai.checkAvailability', '检测')}
                  </>
                )}
              </button>
            </div>
            {availabilityStatus && (
              <div className={clsx(
                "p-2 rounded text-xs",
                availabilityStatus.available
                  ? "bg-green-900/30 border border-green-700/50 text-green-400"
                  : "bg-red-900/30 border border-red-700/50 text-red-400"
              )}>
                <div className="flex items-center gap-1.5">
                  {availabilityStatus.available ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <XCircle size={12} />
                  )}
                  <span>
                    {availabilityStatus.available
                      ? t('settings.ai.available', '服务可用')
                      : availabilityStatus.message || t('settings.ai.unavailable', '服务不可用')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* OpenAI 兼容配置 */}
      {settings.ai.provider === 'openai' && (
        <>
          <InputGroup
              label={t('settings.ai.openaiBaseUrl', 'API Base URL')}
              hint={t('settings.ai.openaiBaseUrlHint', '可自定义为第三方兼容服务地址')}
          >
            <TextInput
                value={settings.ai.openaiBaseUrl}
                onChange={(val) => handleUpdateCategory('ai', { openaiBaseUrl: val })}
                placeholder="https://api.openai.com/v1"
            />
          </InputGroup>
          <InputGroup
            label={t('settings.ai.openaiApiKey', 'API Key')}
            hint={t('settings.ai.openaiApiKeyHint', '用于调用 OpenAI 兼容 API')}
          >
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <TextInput
                  type={showOpenaiApiKey ? 'text' : 'password'}
                  value={settings.ai.openaiApiKey}
                  onChange={(val) => handleUpdateCategory('ai', { openaiApiKey: val })}
                  placeholder={t('settings.ai.openaiApiKeyPlaceholder', '输入您的 API Key')}
                />
              </div>
              <button
                onClick={() => setShowOpenaiApiKey(!showOpenaiApiKey)}
                className="px-3 bg-tech-800 border border-tech-700 rounded hover:bg-tech-700 transition-colors"
              >
                {showOpenaiApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </InputGroup>
          <InputGroup
              label={t('settings.ai.openaiTextModel', '文本模型')}
              hint={t('settings.ai.openaiTextModelHint', '如 gpt-4o, gpt-3.5-turbo')}
          >
            <TextInput
                value={settings.ai.openaiTextModel}
                onChange={(val) => handleUpdateCategory('ai', { openaiTextModel: val })}
                placeholder="gpt-4o"
            />
          </InputGroup>
          <InputGroup
              label={t('settings.ai.openaiImageBaseUrl', '图像 API Base URL（可选）')}
              hint={t('settings.ai.openaiImageBaseUrlHint', '留空则使用通用 Base URL')}
          >
            <TextInput
                value={settings.ai.openaiImageBaseUrl || ''}
                onChange={(val) => handleUpdateCategory('ai', { openaiImageBaseUrl: val })}
                placeholder={t('settings.ai.openaiImageBaseUrlPlaceholder', '留空则使用通用 Base URL')}
            />
          </InputGroup>
          <InputGroup
            label={t('settings.ai.openaiImageApiKey', '图像 API Key（可选）')}
            hint={t('settings.ai.openaiImageApiKeyHint', '留空则使用通用 API Key')}
          >
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <TextInput
                  type={showOpenaiImageApiKey ? 'text' : 'password'}
                  value={settings.ai.openaiImageApiKey || ''}
                  onChange={(val) => handleUpdateCategory('ai', { openaiImageApiKey: val })}
                  placeholder={t('settings.ai.openaiImageApiKeyPlaceholder', '留空则使用通用 API Key')}
                />
              </div>
              <button
                onClick={() => setShowOpenaiImageApiKey(!showOpenaiImageApiKey)}
                className="px-3 bg-tech-800 border border-tech-700 rounded hover:bg-tech-700 transition-colors"
              >
                {showOpenaiImageApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </InputGroup>

          <InputGroup
            label={t('settings.ai.openaiImageModel', '图像模型')}
            hint={t('settings.ai.openaiImageModelHint', '如 dall-e-3, dall-e-2, gpt-4o')}
          >
            <TextInput
              value={settings.ai.openaiImageModel}
              onChange={(val) => handleUpdateCategory('ai', { openaiImageModel: val })}
              placeholder="dall-e-3"
            />
          </InputGroup>

          {/* OpenAI 图像接口模式 */}
          <InputGroup
            label={t('settings.ai.openaiImageMode', '图像接口模式')}
            hint={t('settings.ai.openaiImageModeHint', '选择图像生成和编辑使用的 API 接口类型')}
          >
            <SelectInput
              value={settings.ai.openaiImageMode || 'auto'}
              onChange={(val) => handleUpdateCategory('ai', { openaiImageMode: val as 'auto' | 'image_api' | 'chat' })}
              options={[
                { value: 'auto', label: t('settings.ai.openaiImageModeAuto', '自动判断') },
                { value: 'image_api', label: t('settings.ai.openaiImageModeImageApi', '专用 Image API') },
                { value: 'chat', label: t('settings.ai.openaiImageModeChat', 'Chat Completion API') },
              ]}
            />
          </InputGroup>

          {/* 模式说明 */}
          <div className="p-3 bg-tech-800/50 border border-tech-700 rounded text-xs space-y-2">
            <p className="text-gray-400">
              <span className="text-cyan-400 font-medium">{t('settings.ai.openaiImageModeAuto', '自动判断')}：</span>
              {t('settings.ai.openaiImageModeAutoHint', '根据模型名自动选择')}
            </p>
            <p className="text-gray-400">
              <span className="text-cyan-400 font-medium">{t('settings.ai.openaiImageModeImageApi', '专用 Image API')}：</span>
              {t('settings.ai.openaiImageModeImageApiHint', '使用 /v1/images/* 端点')}
            </p>
            <p className="text-gray-400">
              <span className="text-cyan-400 font-medium">{t('settings.ai.openaiImageModeChat', 'Chat Completion API')}：</span>
              {t('settings.ai.openaiImageModeChatHint', '使用 /v1/chat/completions 端点')}
            </p>
          </div>

          {/* OpenAI 流式模式配置 */}
          <InputGroup
            label={t('settings.ai.openaiStreamMode', '流式模式配置')}
            hint={t('settings.ai.openaiStreamModeHint', '某些第三方 OpenAI 中继服务仅提供流式接口')}
          >
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.ai.openaiTextStream ?? false}
                  onChange={(e) => handleUpdateCategory('ai', { openaiTextStream: e.target.checked })}
                  className="w-4 h-4 rounded border-tech-600 bg-tech-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                />
                <span>{t('settings.ai.openaiTextStream', '文本/聊天模型使用流式请求')}</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.ai.openaiImageStream ?? false}
                  onChange={(e) => handleUpdateCategory('ai', { openaiImageStream: e.target.checked })}
                  className="w-4 h-4 rounded border-tech-600 bg-tech-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                />
                <span>{t('settings.ai.openaiImageStream', '图像模型使用流式请求')}</span>
              </label>
            </div>
          </InputGroup>

          {/* OpenAI 兼容服务说明 */}
          <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded text-xs text-blue-400">
            <p className="font-medium mb-1">{t('settings.ai.openaiCompatNote', 'ℹ️ OpenAI 兼容服务说明')}</p>
            <p className="text-blue-500">{t('settings.ai.openaiCompatDesc', '专用 Image API 模式需要兼容 /v1/images/* 端点；Chat 模式可以支持图像编辑、融合等完整功能。')}</p>
          </div>

          {/* 服务可用性检测 */}
          <div className="pt-2 border-t border-tech-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-300 font-medium">{t('settings.ai.availabilityCheck', '服务可用性检测')}</span>
              <button
                onClick={handleCheckAvailability}
                disabled={checkingAvailability}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors",
                  checkingAvailability
                    ? "bg-tech-700 text-gray-500 cursor-not-allowed"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white"
                )}
              >
                {checkingAvailability ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    {t('settings.ai.checking', '检测中...')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={12} />
                    {t('settings.ai.checkAvailability', '检测')}
                  </>
                )}
              </button>
            </div>
            {availabilityStatus && (
              <div className={clsx(
                "p-2 rounded text-xs",
                availabilityStatus.available
                  ? "bg-green-900/30 border border-green-700/50 text-green-400"
                  : "bg-red-900/30 border border-red-700/50 text-red-400"
              )}>
                <div className="flex items-center gap-1.5">
                  {availabilityStatus.available ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <XCircle size={12} />
                  )}
                  <span>
                    {availabilityStatus.available
                      ? t('settings.ai.available', '服务可用')
                      : availabilityStatus.message || t('settings.ai.unavailable', '服务不可用')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Cloud 云服务配置 */}
      {settings.ai.provider === 'cloud' && (
        <>
          <InputGroup
            label={t('settings.ai.cloudEndpointUrl', '云服务端点 URL')}
            hint={t('settings.ai.cloudEndpointUrlHint', '配置云服务 API 端点地址')}
          >
            <TextInput
              value={settings.ai.cloudEndpointUrl || ''}
              onChange={(val) => handleUpdateCategory('ai', { cloudEndpointUrl: val })}
              placeholder="https://api.example.com/v1"
            />
          </InputGroup>

          <InputGroup
            label={t('settings.ai.cloudToken', '认证 Token')}
            hint={t('settings.ai.cloudTokenHint', '用于云服务 API 认证的 Token（可选）')}
          >
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <TextInput
                  type={showCloudToken ? 'text' : 'password'}
                  value={settings.ai.cloudToken || ''}
                  onChange={(val) => handleUpdateCategory('ai', { cloudToken: val })}
                  placeholder={t('settings.ai.cloudTokenPlaceholder', '输入您的认证 Token（可选）')}
                />
              </div>
              <button
                onClick={() => setShowCloudToken(!showCloudToken)}
                className="px-3 bg-tech-800 border border-tech-700 rounded hover:bg-tech-700 transition-colors"
              >
                {showCloudToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </InputGroup>

          {/* 云服务说明 */}
          <div className="p-3 bg-green-900/20 border border-green-700/50 rounded text-xs text-green-400">
            <p className="font-medium mb-1">{t('settings.ai.cloudNote', 'ℹ️ 云服务说明')}</p>
            <p className="text-green-500">{t('settings.ai.cloudDesc', '云服务将处理所有 AI 处理任务，本地客户端仅负责转发请求和处理响应。云服务应提供与 Gemini API 兼容的接口。如果云服务需要认证，请填写 Token。')}</p>
          </div>

          {/* 服务可用性检测 */}
          <div className="pt-2 border-t border-tech-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-300 font-medium">{t('settings.ai.availabilityCheck', '服务可用性检测')}</span>
              <button
                onClick={handleCheckAvailability}
                disabled={checkingAvailability}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors",
                  checkingAvailability
                    ? "bg-tech-700 text-gray-500 cursor-not-allowed"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white"
                )}
              >
                {checkingAvailability ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    {t('settings.ai.checking', '检测中...')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={12} />
                    {t('settings.ai.checkAvailability', '检测')}
                  </>
                )}
              </button>
            </div>
            {availabilityStatus && (
              <div className={clsx(
                "p-2 rounded text-xs",
                availabilityStatus.available
                  ? "bg-green-900/30 border border-green-700/50 text-green-400"
                  : "bg-red-900/30 border border-red-700/50 text-red-400"
              )}>
                <div className="flex items-center gap-1.5">
                  {availabilityStatus.available ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <XCircle size={12} />
                  )}
                  <span>
                    {availabilityStatus.available
                      ? t('settings.ai.available', '服务可用')
                      : availabilityStatus.message || t('settings.ai.unavailable', '服务不可用')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );

  // 渲染画布设置
  const renderCanvasSettings = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <InputGroup label={t('settings.canvas.width', '默认宽度')}>
          <NumberInput
            value={settings.canvas.width}
            onChange={(val) => handleUpdateCategory('canvas', { width: val })}
            min={100}
            max={4096}
          />
        </InputGroup>
        <InputGroup label={t('settings.canvas.height', '默认高度')}>
          <NumberInput
            value={settings.canvas.height}
            onChange={(val) => handleUpdateCategory('canvas', { height: val })}
            min={100}
            max={4096}
          />
        </InputGroup>
      </div>

      <InputGroup label={t('settings.canvas.background', '默认背景')}>
        <SelectInput
          value={settings.canvas.background}
          onChange={(val) => handleUpdateCategory('canvas', { background: val as 'transparent' | 'color' })}
          options={[
            { value: 'transparent', label: t('settings.canvas.transparent', '透明') },
            { value: 'color', label: t('settings.canvas.color', '纯色') },
          ]}
        />
      </InputGroup>

      {settings.canvas.background === 'color' && (
        <InputGroup label={t('settings.canvas.backgroundColor', '背景颜色')}>
          <ColorInput
            value={settings.canvas.backgroundColor}
            onChange={(val) => handleUpdateCategory('canvas', { backgroundColor: val })}
          />
        </InputGroup>
      )}
    </div>
  );

  // 渲染工具设置
  const renderToolSettings = () => (
    <div className="space-y-6">
      {/* 画笔设置 */}
      <div>
        <h4 className="text-sm font-medium text-gray-200 mb-3">{t('settings.tools.brush', '画笔')}</h4>
        <div className="space-y-3 pl-2 border-l-2 border-tech-700">
          <InputGroup label={t('settings.tools.brushSize', '默认大小')}>
            <Slider
              value={settings.tools.brush.size}
              min={1}
              max={100}
              onChange={(val) => handleUpdateCategory('tools', {
                brush: { ...settings.tools.brush, size: val }
              })}
            />
          </InputGroup>
          <InputGroup label={t('settings.tools.brushColor', '默认颜色')}>
            <ColorInput
              value={settings.tools.brush.color}
              onChange={(val) => handleUpdateCategory('tools', {
                brush: { ...settings.tools.brush, color: val }
              })}
            />
          </InputGroup>
          <InputGroup label={t('settings.tools.brushOpacity', '默认透明度')}>
            <Slider
              value={settings.tools.brush.opacity}
              min={0}
              max={1}
              step={0.1}
              onChange={(val) => handleUpdateCategory('tools', {
                brush: { ...settings.tools.brush, opacity: val }
              })}
            />
          </InputGroup>
        </div>
      </div>

      {/* 橡皮擦设置 */}
      <div>
        <h4 className="text-sm font-medium text-gray-200 mb-3">{t('settings.tools.eraser', '橡皮擦')}</h4>
        <div className="space-y-3 pl-2 border-l-2 border-tech-700">
          <InputGroup label={t('settings.tools.eraserSize', '默认大小')}>
            <Slider
              value={settings.tools.eraser.size}
              min={1}
              max={100}
              onChange={(val) => handleUpdateCategory('tools', {
                eraser: { ...settings.tools.eraser, size: val }
              })}
            />
          </InputGroup>
        </div>
      </div>

      {/* 文本设置 */}
      <div>
        <h4 className="text-sm font-medium text-gray-200 mb-3">{t('settings.tools.text', '文本')}</h4>
        <div className="space-y-3 pl-2 border-l-2 border-tech-700">
          <InputGroup label={t('settings.tools.textFont', '默认字体')}>
            <select
              value={settings.tools.text.fontFamily}
              onChange={(e) => handleUpdateCategory('tools', {
                text: { ...settings.tools.text, fontFamily: e.target.value }
              })}
              className="w-full bg-tech-900 border border-tech-700 rounded px-2 py-1.5 text-xs text-gray-300 focus:border-cyan-500 focus:outline-none"
              style={{ fontFamily: settings.tools.text.fontFamily }}
            >
              {AVAILABLE_FONTS.map((font) => (
                <option 
                  key={font} 
                  value={font} 
                  style={{ fontFamily: isSymbolFont(font) ? DEFAULT_FONT : font }}
                >
                  {font}
                </option>
              ))}
            </select>
          </InputGroup>
          <InputGroup label={t('settings.tools.textSize', '默认字号')}>
            <NumberInput
              value={settings.tools.text.fontSize}
              onChange={(val) => handleUpdateCategory('tools', {
                text: { ...settings.tools.text, fontSize: val }
              })}
              min={8}
              max={200}
            />
          </InputGroup>
          <InputGroup label={t('settings.tools.textColor', '默认颜色')}>
            <ColorInput
              value={settings.tools.text.color}
              onChange={(val) => handleUpdateCategory('tools', {
                text: { ...settings.tools.text, color: val }
              })}
            />
          </InputGroup>
        </div>
      </div>
    </div>
  );

  const handleModelSwitch = async (modelId: string) => {
    try {
      const model = models.find(m => m.id === modelId);
      if (!model) return;

      // 检查模型是否已下载
      if (!model.downloaded) {
        setConfirmDialog({
          isOpen: true,
          title: '模型未下载',
          message: `模型 "${model.name}" 尚未下载到本地。是否现在下载？`,
          confirmText: '下载',
          cancelText: '取消',
          type: 'info',
          onConfirm: async () => {
            setConfirmDialog(null);
            await handleModelDownload(modelId);
            // 下载完成后自动切换
            await performModelSwitch(modelId);
          },
        });
        return;
      }

      await performModelSwitch(modelId);
    } catch (error: any) {
      console.error('Failed to switch model:', error);
      showMessage('error', error.message || '切换模型失败');
    }
  };

  const performModelSwitch = async (modelId: string) => {
    try {
      // 获取模型信息
      const model = models.find(m => m.id === modelId);
      if (!model) {
        throw new Error('模型不存在');
      }

      // 切换模型（保存到后端）
      await switchModel(modelId);
      
      // 立即更新本地 settings 状态，使 UI 同步
      // 使用 updateCategory 而不是 handleUpdateCategory，避免设置 hasUnsavedChanges
      updateCategory('app', {
        transformers: {
          ...settings.app.transformers!,
          currentModelId: modelId,
        },
      });
      
      showMessage('success', '模型切换成功');
      await loadModels(); // 重新加载状态
    } catch (error: any) {
      throw error;
    }
  };

  const handleModelDownload = async (modelId: string) => {
    try {
      // ✅ 使用事件驱动的异步下载，不等待完成
      // 进度通过事件系统更新
      await downloadModel(modelId);
      // 注意：下载完成和错误处理由事件监听器处理
    } catch (error: any) {
      console.error('Failed to start model download:', error);
      showMessage('error', error.message || '启动下载失败');
      setDownloadingModelId(null);
    }
  };

  // 渲染模型设置
  const renderModelSettings = () => {
    const currentModelId = settings.app.transformers?.currentModelId || 'rmbg-1.4';
    const currentModel = models.find(m => m.id === currentModelId);

    // 格式化文件大小
    const formatSize = (bytes: number) => {
      if (bytes <= 0) return '未知';
      const mb = bytes / (1024 * 1024);
      return `${mb.toFixed(1)} MB`;
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-gray-200 mb-1">Transformers 模型</h3>
            <p className="text-xs text-gray-500">选择用于背景移除的 AI 模型（所有模型需先下载到本地）</p>
          </div>
        </div>

        {loadingModels ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-cyan-400" />
            <span className="ml-2 text-sm text-gray-400">加载中...</span>
          </div>
        ) : models.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            暂无可用模型
          </div>
        ) : (
          <div className="space-y-2">
            {models.map((model) => {
              const isSelected = model.id === currentModelId;
              const isDownloading = downloadingModelId === model.id || model.isDownloading;
              const progress = downloadProgress[model.id];

              return (
                <div
                  key={model.id}
                  className={clsx(
                    "border rounded-lg p-3 transition-all",
                    isSelected
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-tech-700 bg-tech-900/50 hover:border-tech-600"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-200">{model.name}</h4>
                        {isSelected && (
                          <CheckCircle2 size={14} className="text-cyan-400" />
                        )}
                        {model.size > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-tech-700 text-gray-400 rounded">
                            {formatSize(model.size)}
                          </span>
                        )}
                      </div>
                      {model.description && (
                        <p className="text-xs text-gray-500 mb-2">{model.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs">
                        {model.downloaded ? (
                          <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle2 size={12} />
                            已下载
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-yellow-400">
                            <XCircle size={12} />
                            未下载
                          </span>
                        )}
                        {model.repoId && (
                          <span className="text-gray-600">
                            {model.repoId}
                          </span>
                        )}
                      </div>
                      {/* ✅ 下载进度显示 */}
                      {isDownloading && progress && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>{progress.fileName}</span>
                            <span>{progress.progress}%</span>
                          </div>
                          <div className="w-full bg-tech-800 rounded-full h-1.5">
                            <div
                              className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${progress.progress}%` }}
                            />
                          </div>
                          {progress.total > 0 && (
                            <div className="text-xs text-gray-500">
                              {formatSize(progress.downloaded)} / {formatSize(progress.total)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {!model.downloaded && !isDownloading && (
                        <button
                          onClick={() => handleModelDownload(model.id)}
                          className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
                        >
                          下载
                        </button>
                      )}
                      {isDownloading && (
                        <div className="flex items-center gap-2 text-xs text-cyan-400">
                          <Loader2 size={12} className="animate-spin" />
                          下载中...
                        </div>
                      )}
                      {!isSelected && model.downloaded && (
                        <button
                          onClick={() => handleModelSwitch(model.id)}
                          className="px-3 py-1.5 text-xs bg-tech-700 hover:bg-tech-600 text-gray-300 rounded transition-colors"
                        >
                          选择
                        </button>
                      )}
                      {!isSelected && !model.downloaded && !isDownloading && (
                        <button
                          onClick={() => handleModelSwitch(model.id)}
                          className="px-3 py-1.5 text-xs bg-tech-700 hover:bg-tech-600 text-gray-300 rounded transition-colors"
                        >
                          选择
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-tech-700">
          <InputGroup
            label="模型配置"
            hint="量化模型可以提高性能并减少内存使用"
          >
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.app.transformers?.useQuantized ?? true}
                  onChange={(e) => {
                    handleUpdateCategory('app', {
                      transformers: {
                        ...settings.app.transformers!,
                        useQuantized: e.target.checked,
                      },
                    });
                  }}
                  className="w-4 h-4 rounded border-tech-600 bg-tech-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                />
                使用量化模型 (q8)
              </label>
            </div>
          </InputGroup>
        </div>

        {/* 下载设置 */}
        <div className="mt-6 pt-4 border-t border-tech-700">
          <InputGroup
            label="下载设置"
            hint="配置模型下载方式（建议国内用户开启镜像）"
          >
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={downloadConfig.useMirror}
                  onChange={async (e) => {
                    const newConfig = { ...downloadConfig, useMirror: e.target.checked };
                    setDownloadConfigState(newConfig);
                    try {
                      await setDownloadConfig(newConfig);
                    } catch (error) {
                      showMessage('error', '保存下载配置失败');
                    }
                  }}
                  className="w-4 h-4 rounded border-tech-600 bg-tech-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                />
                使用国内镜像 (hf-mirror.com)
              </label>
              
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={downloadConfig.insecureSsl}
                  onChange={async (e) => {
                    const newConfig = { ...downloadConfig, insecureSsl: e.target.checked };
                    setDownloadConfigState(newConfig);
                    try {
                      await setDownloadConfig(newConfig);
                    } catch (error) {
                      showMessage('error', '保存下载配置失败');
                    }
                  }}
                  className="w-4 h-4 rounded border-tech-600 bg-tech-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                />
                跳过 SSL 验证（解决部分网络环境问题）
              </label>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">代理地址（可选）</label>
                <input
                  type="text"
                  value={downloadConfig.proxyUrl}
                  onChange={(e) => setDownloadConfigState({ ...downloadConfig, proxyUrl: e.target.value })}
                  onBlur={async () => {
                    try {
                      await setDownloadConfig(downloadConfig);
                    } catch (error) {
                      showMessage('error', '保存下载配置失败');
                    }
                  }}
                  placeholder="例如: http://127.0.0.1:7890"
                  className="w-full bg-tech-900 border border-tech-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-cyan-500 focus:outline-none transition-colors placeholder:text-gray-600"
                />
              </div>
            </div>
          </InputGroup>
        </div>

        {/* 说明信息 */}
        <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded text-xs text-blue-400 mt-4">
          <p className="font-medium mb-1">ℹ️ 模型管理说明</p>
          <p className="text-blue-500">
            所有模型都需要先下载到本地才能使用。模型从 Hugging Face 下载，国内用户建议开启镜像加速。
          </p>
        </div>
      </div>
    );
  };

  // 渲染应用设置
  const renderAppSettings = () => {
    const handleSelectExportDirectory = async () => {
      try {
        const dirPath = await SelectDirectory(t('settings.app.selectExportDirectory', '选择导出目录'));
        if (dirPath) {
          handleUpdateCategory('app', { exportDirectory: dirPath });
        }
      } catch (error) {
        console.error('Failed to select export directory:', error);
        showMessage('error', t('settings.app.selectDirectoryFailed', '选择目录失败'));
      }
    };

    return (
      <div className="space-y-4">
        <InputGroup
          label={t('settings.app.exportDirectory', '导出目录')}
          hint={t('settings.app.exportDirectoryHint', '设置导出目录后，导出时将直接保存到该目录，无需选择文件位置。留空则使用文件对话框。')}
        >
          <div className="flex gap-2">
            <TextInput
              value={settings.app.exportDirectory || ''}
              onChange={(val) => handleUpdateCategory('app', { exportDirectory: val })}
              placeholder={t('settings.app.exportDirectoryPlaceholder', '留空则使用文件对话框')}
            />
            <button
              onClick={handleSelectExportDirectory}
              className="px-4 bg-tech-800 border border-tech-700 rounded hover:bg-tech-700 transition-colors text-sm text-gray-300 whitespace-nowrap"
            >
              {t('settings.app.browse', '浏览')}
            </button>
            {settings.app.exportDirectory && (
              <button
                onClick={() => handleUpdateCategory('app', { exportDirectory: '' })}
                className="px-3 bg-tech-800 border border-tech-700 rounded hover:bg-tech-700 transition-colors text-sm text-gray-400"
                title={t('settings.app.clear', '清除')}
              >
                <X size={16} />
              </button>
            )}
          </div>
          {settings.app.exportDirectory && (
            <p className="text-[10px] text-gray-500 mt-1">
              {t('settings.app.currentDirectory', '当前目录')}: {settings.app.exportDirectory}
            </p>
          )}
        </InputGroup>
      </div>
    );
  };

  // 渲染关于信息
  const renderAboutSettings = () => {
    return (
      <div className="space-y-6">
        {/* 软件信息 */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-200 border-b border-tech-700 pb-2">
            {t('settings.about.softwareInfo', '软件信息')}
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-tech-800">
              <span className="text-xs text-gray-400">{t('settings.about.name', '软件名称')}</span>
              <span className="text-sm text-gray-200 font-medium">Indraw Editor</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-tech-800">
              <span className="text-xs text-gray-400">{t('settings.about.version', '版本')}</span>
              <span className="text-sm text-gray-200">{currentVersion}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-tech-800">
              <span className="text-xs text-gray-400">{t('settings.about.description', '描述')}</span>
              <span className="text-sm text-gray-200 text-right max-w-[300px]">
                {t('settings.about.descriptionText', 'AI 驱动的图像编辑工具')}
              </span>
            </div>
          </div>
        </div>

        {/* 更新检测 */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-200 border-b border-tech-700 pb-2">
            {t('settings.about.updateCheck', '更新检测')}
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-300 font-medium">{t('settings.about.checkForUpdate', '检查更新')}</span>
              <button
                onClick={handleCheckUpdate}
                disabled={checkingUpdate}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors",
                  checkingUpdate
                    ? "bg-tech-700 text-gray-500 cursor-not-allowed"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white"
                )}
              >
                {checkingUpdate ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    {t('settings.about.checking', '检查中...')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={12} />
                    {t('settings.about.checkUpdate', '检查更新')}
                  </>
                )}
              </button>
            </div>
            {updateInfo && (
              <div className={clsx(
                "p-3 rounded text-xs space-y-2",
                updateInfo.hasUpdate
                  ? "bg-green-900/30 border border-green-700/50"
                  : updateInfo.error
                  ? "bg-red-900/30 border border-red-700/50"
                  : "bg-blue-900/30 border border-blue-700/50"
              )}>
                {updateInfo.hasUpdate ? (
                  <>
                    <div className="flex items-center gap-1.5 text-green-400">
                      <CheckCircle2 size={12} />
                      <span className="font-medium">{t('settings.about.updateAvailable', '发现新版本')}</span>
                    </div>
                    <div className="text-gray-300 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">{t('settings.about.currentVersion', '当前版本')}:</span>
                        <span>{updateInfo.currentVersion}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">{t('settings.about.latestVersion', '最新版本')}:</span>
                        <span className="text-green-400 font-medium">{updateInfo.latestVersion}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => setShowUpdateConfirm(true)}
                        disabled={updating}
                        className={clsx(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 text-white rounded text-xs transition-colors",
                          updating
                            ? "bg-tech-700 text-gray-500 cursor-not-allowed"
                            : "bg-cyan-600 hover:bg-cyan-500"
                        )}
                      >
                        {updating ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            {t('settings.about.updating', '更新中...')}
                          </>
                        ) : (
                          <>
                            <Download size={12} />
                            {t('settings.about.downloadUpdate', '下载更新')}
                          </>
                        )}
                      </button>
                      {updateInfo.releaseUrl && (
                        <a
                          href={updateInfo.releaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-tech-700 hover:bg-tech-600 text-gray-300 rounded text-xs transition-colors"
                        >
                          <Info size={12} />
                          {t('settings.about.viewOnGitHub', '在GitHub查看')}
                        </a>
                      )}
                    </div>
                    {updateInfo.releaseNotes && (
                      <div className="mt-3 pt-3 border-t border-green-700/30">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Info size={12} className="text-green-400" />
                          <span className="text-xs font-medium text-green-400">
                            {t('settings.about.releaseNotes', '更新日志')}
                          </span>
                        </div>
                        <div className="bg-tech-900/50 rounded p-2.5 border border-tech-700/50">
                          <div 
                            className="text-xs text-gray-300 leading-relaxed overflow-y-auto"
                            style={{
                              maxHeight: '200px',
                              wordBreak: 'break-word',
                              fontFamily: 'inherit'
                            }}
                          >
                            <ReactMarkdown
                              components={{
                                h1: ({node, ...props}) => <h1 className="text-base font-bold text-white mt-4 mb-2" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-sm font-bold text-gray-100 mt-4 mb-2" {...props} />,
                                h3: ({node, ...props}) => <h3 className="text-sm font-semibold text-gray-200 mt-3 mb-1.5" {...props} />,
                                p: ({node, ...props}) => <p className="my-2" {...props} />,
                                strong: ({node, ...props}) => <strong className="font-semibold text-gray-200" {...props} />,
                                em: ({node, ...props}) => <em className="italic text-gray-300" {...props} />,
                                code: ({node, inline, ...props}: any) => 
                                  inline ? (
                                    <code className="bg-tech-800 px-1.5 py-0.5 rounded text-[10px] text-cyan-400 font-mono border border-tech-700" {...props} />
                                  ) : (
                                    <code className="block bg-tech-800 p-2 rounded text-[10px] text-cyan-400 font-mono overflow-x-auto my-2 border border-tech-700" {...props} />
                                  ),
                                pre: ({node, ...props}) => <pre className="bg-tech-800 p-2 rounded text-[10px] text-cyan-400 font-mono overflow-x-auto my-2 border border-tech-700" {...props} />,
                                a: ({node, ...props}) => <a className="text-cyan-400 hover:text-cyan-300 underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                ul: ({node, ...props}) => <ul className="space-y-1 my-2 ml-5 list-disc" {...props} />,
                                ol: ({node, ...props}) => <ol className="space-y-1 my-2 ml-5 list-decimal" {...props} />,
                                li: ({node, ...props}) => <li className="text-gray-300 mb-1" {...props} />,
                                blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-tech-700 pl-3 my-2 italic text-gray-400" {...props} />,
                                hr: ({node, ...props}) => <hr className="my-3 border-tech-700" {...props} />,
                              }}
                            >
                              {updateInfo.releaseNotes}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : updateInfo.error ? (
                  <div className="flex items-center gap-1.5 text-red-400">
                    <XCircle size={12} />
                    <span>{updateInfo.error}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-blue-400">
                      <CheckCircle2 size={12} />
                      <span>{t('settings.about.latestVersionInstalled', '已安装最新版本')}</span>
                    </div>
                    {updateInfo.releaseNotes && (
                      <div className="mt-3 pt-3 border-t border-blue-700/30">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Info size={12} className="text-blue-400" />
                          <span className="text-xs font-medium text-blue-400">
                            {t('settings.about.releaseNotes', '更新日志')}
                          </span>
                        </div>
                        <div className="bg-tech-900/50 rounded p-2.5 border border-tech-700/50">
                          <div 
                            className="text-xs text-gray-300 leading-relaxed overflow-y-auto"
                            style={{
                              maxHeight: '200px',
                              wordBreak: 'break-word',
                              fontFamily: 'inherit'
                            }}
                          >
                            <ReactMarkdown
                              components={{
                                h1: ({node, ...props}) => <h1 className="text-base font-bold text-white mt-4 mb-2" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-sm font-bold text-gray-100 mt-4 mb-2" {...props} />,
                                h3: ({node, ...props}) => <h3 className="text-sm font-semibold text-gray-200 mt-3 mb-1.5" {...props} />,
                                p: ({node, ...props}) => <p className="my-2" {...props} />,
                                strong: ({node, ...props}) => <strong className="font-semibold text-gray-200" {...props} />,
                                em: ({node, ...props}) => <em className="italic text-gray-300" {...props} />,
                                code: ({node, inline, ...props}: any) => 
                                  inline ? (
                                    <code className="bg-tech-800 px-1.5 py-0.5 rounded text-[10px] text-cyan-400 font-mono border border-tech-700" {...props} />
                                  ) : (
                                    <code className="block bg-tech-800 p-2 rounded text-[10px] text-cyan-400 font-mono overflow-x-auto my-2 border border-tech-700" {...props} />
                                  ),
                                pre: ({node, ...props}) => <pre className="bg-tech-800 p-2 rounded text-[10px] text-cyan-400 font-mono overflow-x-auto my-2 border border-tech-700" {...props} />,
                                a: ({node, ...props}) => <a className="text-cyan-400 hover:text-cyan-300 underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                ul: ({node, ...props}) => <ul className="space-y-1 my-2 ml-5 list-disc" {...props} />,
                                ol: ({node, ...props}) => <ol className="space-y-1 my-2 ml-5 list-decimal" {...props} />,
                                li: ({node, ...props}) => <li className="text-gray-300 mb-1" {...props} />,
                                blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-tech-700 pl-3 my-2 italic text-gray-400" {...props} />,
                                hr: ({node, ...props}) => <hr className="my-3 border-tech-700" {...props} />,
                              }}
                            >
                              {updateInfo.releaseNotes}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 作者信息 */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-200 border-b border-tech-700 pb-2">
            {t('settings.about.authorInfo', '作者信息')}
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-tech-800">
              <span className="text-xs text-gray-400">{t('settings.about.author', '作者')}</span>
              <span className="text-sm text-gray-200 font-medium">syskey</span>
            </div>
          </div>
        </div>

        {/* 说明 */}
        <div className="p-4 bg-tech-800/30 border border-tech-700 rounded-lg">
          <p className="text-xs text-gray-400 leading-relaxed">
            {t('settings.about.thanks', '感谢使用 Indraw Editor！')}
          </p>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'ai': return renderAISettings();
      case 'canvas': return renderCanvasSettings();
      case 'tools': return renderToolSettings();
      case 'app': return renderAppSettings();
      case 'models': return renderModelSettings();
      case 'about': return renderAboutSettings();
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-tech-900 border border-tech-700 rounded-lg shadow-2xl w-[600px] max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-tech-700">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-cyan-400" />
            <h2 className="text-base font-medium text-gray-200">{t('settings.title', '设置')}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-tech-800 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={clsx(
            "mx-4 mt-3 px-3 py-2 rounded text-sm flex items-center gap-2",
            message.type === 'success' ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"
          )}>
            {message.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
            {message.text}
          </div>
        )}

        {/* 主体 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 侧边标签 */}
          <div className="w-32 border-r border-tech-700 py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors",
                  activeTab === tab.id 
                    ? "bg-tech-800 text-cyan-400 border-r-2 border-cyan-400" 
                    : "text-gray-400 hover:bg-tech-800 hover:text-gray-200"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* 内容区 */}
          <div className="flex-1 p-4 overflow-y-auto">
            {renderContent()}
          </div>
        </div>

        {/* 底部操作 */}
        <div className="border-t border-tech-700">
          {/* 其他操作按钮 */}
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-tech-800 hover:bg-tech-700 rounded transition-colors"
              >
                <Download size={14} />
                {t('settings.export', '导出')}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-tech-800 hover:bg-tech-700 rounded transition-colors"
              >
                <Upload size={14} />
                {t('settings.import', '导入')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/30 rounded transition-colors"
            >
              <RotateCcw size={14} />
              {t('settings.reset', '重置')}
            </button>
          </div>
        </div>
      </div>

      {/* 确认对话框 */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          cancelText={confirmDialog.cancelText}
          discardText={confirmDialog.discardText}
          type={confirmDialog.type}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel || (() => setConfirmDialog(null))}
          onDiscard={confirmDialog.onDiscard}
        />
      )}
      {/* 更新确认对话框 */}
      {updateInfo?.hasUpdate && (
        <ConfirmDialog
          isOpen={showUpdateConfirm}
          title={t('settings.about.confirmUpdate', '确认更新')}
          message={t('settings.about.confirmUpdateMessage', '确定要更新到版本 {{version}} 吗？更新完成后需要重启应用程序。', { version: updateInfo.latestVersion })}
          confirmText={t('settings.about.confirm', '确认')}
          cancelText={t('settings.about.cancel', '取消')}
          type="info"
          onConfirm={handleUpdate}
          onCancel={() => setShowUpdateConfirm(false)}
        />
      )}
    </div>
  );
}

