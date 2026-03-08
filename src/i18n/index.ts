import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入翻译文件
import zh from './locales/zh.json';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';
import ja from './locales/ja.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      'zh-TW': { translation: zhTW },
      en: { translation: en },
      ja: { translation: ja },
    },
    fallbackLng: 'zh',
    supportedLngs: ['zh', 'zh-TW', 'en', 'ja'], // 明确支持的语言列表，防止浏览器检测到 ja-JP 但是无法匹配 ja 导致 fallback 回繁体或简体中文
    nonExplicitSupportedLngs: true, // 允许类似 ja-JP 映射到 ja
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'language', // 强制指定缓存的 key，兼容老用户的 localStorage 数据
      caches: ['localStorage'],
    },
  });

// 监听语言变化，确保 fallback 时本地存储强制同步
i18n.on('languageChanged', (lng) => {
  if (lng) {
    let standardizedLng = lng;
    if (lng.includes('zh-TW')) standardizedLng = 'zh-TW';
    else if (lng.includes('zh')) standardizedLng = 'zh';
    else if (lng.includes('ja')) standardizedLng = 'ja';
    else if (lng.includes('en')) standardizedLng = 'en';
    
    // 如果存在不规范的标准码被加载，则通过它自己映射并缓存
    localStorage.setItem('language', standardizedLng);
    localStorage.setItem('i18nextLng', standardizedLng);
  }
});

export default i18n;
