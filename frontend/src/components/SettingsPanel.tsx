/**
 * 设置面板组件
 * 提供用户配置界面
 */

import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  AlertCircle
} from 'lucide-react';
import clsx from 'clsx';
import { useSettings } from '../contexts/SettingsContext';
import { Settings as SettingsType, SettingsCategory } from '@/types';
import { AVAILABLE_FONTS, DEFAULT_FONT, isSymbolFont } from '@/constants/fonts';
import ConfirmDialog from './ConfirmDialog';

// ==================== 类型定义 ====================

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = SettingsCategory;

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
  const [vertexCredentialsError, setVertexCredentialsError] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'warning' | 'danger' | 'info';
    onConfirm: () => void;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // 保存设置
  const handleSave = async () => {
    const success = await manualSaveSettings();
    if (success) {
      setHasUnsavedChanges(false);
      showMessage('success', t('settings.saveSuccess', '设置已保存'));
    } else {
      showMessage('error', t('settings.saveError', '保存失败，请重试'));
    }
  };

  // 取消修改
  const handleCancel = async () => {
    if (hasUnsavedChanges) {
      setConfirmDialog({
        isOpen: true,
        title: t('settings.discardTitle', '放弃修改'),
        message: t('settings.discardConfirm', '确定要放弃未保存的修改吗？'),
        confirmText: t('settings.discard', '放弃'),
        cancelText: t('settings.cancel', '取消'),
        type: 'warning',
        onConfirm: async () => {
          setConfirmDialog(null);
          await reloadSettings();
          setHasUnsavedChanges(false);
        },
      });
      return;
    }
    await reloadSettings();
    setHasUnsavedChanges(false);
  };

  // 关闭面板时检查未保存的修改
  const handleClose = () => {
    if (hasUnsavedChanges) {
      setConfirmDialog({
        isOpen: true,
        title: t('settings.discardTitle', '放弃修改'),
        message: t('settings.discardConfirm', '确定要放弃未保存的修改吗？'),
        confirmText: t('settings.discard', '放弃'),
        cancelText: t('settings.cancel', '取消'),
        type: 'warning',
        onConfirm: () => {
          setConfirmDialog(null);
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
  ];

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

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
          onChange={(val) => handleUpdateCategory('ai', { provider: val as 'gemini' | 'openai' })}
          options={[
            { value: 'gemini', label: t('settings.ai.providerGemini', 'Google Gemini') },
            { value: 'openai', label: t('settings.ai.providerOpenai', 'OpenAI 兼容') },
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

          {/* OpenAI 兼容服务说明 */}
          <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded text-xs text-blue-400">
            <p className="font-medium mb-1">{t('settings.ai.openaiCompatNote', 'ℹ️ OpenAI 兼容服务说明')}</p>
            <p className="text-blue-500">{t('settings.ai.openaiCompatDesc', '专用 Image API 模式需要兼容 /v1/images/* 端点；Chat 模式可以支持图像编辑、融合等完整功能。')}</p>
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

  const renderContent = () => {
    switch (activeTab) {
      case 'ai': return renderAISettings();
      case 'canvas': return renderCanvasSettings();
      case 'tools': return renderToolSettings();
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
          {/* 保存/取消按钮区域 */}
          <div className="flex items-center justify-end gap-3 px-4 py-3 bg-tech-950/50">
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-tech-700 hover:bg-tech-600 text-gray-300 rounded transition-colors"
            >
              {t('settings.cancel', '取消')}
            </button>
            <button
              onClick={handleSave}
              className={clsx(
                "flex items-center gap-1.5 px-4 py-2 text-sm rounded transition-colors",
                hasUnsavedChanges
                  ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                  : "bg-cyan-600/50 text-gray-300 cursor-default"
              )}
            >
              <Check size={16} />
              {t('settings.save', '保存')}
              {hasUnsavedChanges && <span className="ml-1 text-xs">*</span>}
            </button>
          </div>

          {/* 其他操作按钮 */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-tech-700/50">
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
          type={confirmDialog.type}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

