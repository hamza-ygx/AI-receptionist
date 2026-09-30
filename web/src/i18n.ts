import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import sv from "./locales/sv.json";
import en from "./locales/en.json";

const saved = (() => { try { return localStorage.getItem("rkjh.lang"); } catch { return null; } })();

void i18n.use(initReactI18next).init({
  resources: { sv: { translation: sv }, en: { translation: en } },
  lng: saved === "en" ? "en" : "sv",
  fallbackLng: "sv",
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: "sv" | "en"): void {
  void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  try { localStorage.setItem("rkjh.lang", lang); } catch { /* storage unavailable */ }
}

export default i18n;
