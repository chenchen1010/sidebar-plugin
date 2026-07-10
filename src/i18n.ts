import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";

type SupportedLanguage = "zh" | "en" | "ja";

function detectLanguage(): SupportedLanguage {
  const requested = new URLSearchParams(window.location.search).get("lang")?.toLowerCase();
  if (requested === "en") return "en";
  if (requested === "ja" || requested === "jp") return "ja";
  if (requested === "zh") return "zh";

  const browserLanguage = window.navigator.language.toLowerCase();
  if (browserLanguage.startsWith("ja")) return "ja";
  if (browserLanguage.startsWith("en")) return "en";
  return "zh";
}

void i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
    ja: { translation: ja },
  },
  lng: detectLanguage(),
  fallbackLng: "zh",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
