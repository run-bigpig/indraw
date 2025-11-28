import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './zh-CN';
import enUS from './en-US';

// 从 localStorage 获取保存的语言，默认为中文
const savedLanguage = localStorage.getItem('language') || 'zh-CN';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': zhCN,
      'en-US': enUS,
    },
    lng: savedLanguage,
    fallbackLng: 'zh-CN',
    interpolation: {
      escapeValue: false, // React 已经处理了 XSS
    },
    // 启用调试模式（开发环境）
    debug: false,
  });

export default i18n;

