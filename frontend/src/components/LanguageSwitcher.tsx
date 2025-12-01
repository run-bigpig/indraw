import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import clsx from 'clsx';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  
  const currentLanguage = i18n.language;
  const isZhCN = currentLanguage === 'zh-CN';
  
  const toggleLanguage = () => {
    const newLang = isZhCN ? 'en-US' : 'zh-CN';
    i18n.changeLanguage(newLang).then(() => {
      localStorage.setItem('language', newLang);
    });
  };
  
  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-tech-800 rounded-lg transition-colors group"
      title={isZhCN ? 'Switch to English' : '切换到中文'}
    >
      <Languages size={16} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
      <span className="font-medium">
        {isZhCN ? 'EN' : '中'}
      </span>
    </button>
  );
};

export default LanguageSwitcher;

