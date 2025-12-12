import { Language, TranslationKey } from "@/types/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import en from "@/locales/en.json";
import vi from "@/locales/vi.json";
import zh from "@/locales/zh.json";

const translations = {
  en,
  vi,
  zh,
};

let currentLanguage: Language = "en";

const LANGUAGE_KEY = "@app_language";

/**
 * Get nested value from object using dot notation
 * Example: getNestedValue(obj, 'settingsScreen.account.title')
 */
function getNestedValue(obj: any, path: string): string {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      // Return the key itself if path not found (fallback)
      return path;
    }
  }

  return typeof current === 'string' ? current : path;
}

/**
 * Replace interpolation variables in string
 * Supports both {{variable}} and {variable} formats
 * Example: 
 *   interpolate("Hello, {{name}}!", {name: "John"}) => "Hello, John!"
 *   interpolate("Enable {permission} access", {permission: "Camera"}) => "Enable Camera access"
 */
function interpolate(
  text: string,
  options?: Record<string, string | number>
): string {
  if (!options) return text;

  let result = text;

  // Replace {{variable}} format (double braces)
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return options[key]?.toString() || '';
  });

  // Replace {variable} format (single braces)
  result = result.replace(/\{(\w+)\}/g, (_, key) => {
    return options[key]?.toString() || `{${key}}`;
  });

  return result;
}

/**
 * Auto-detect device language
 */
const detectDeviceLanguage = (): Language => {
  const locales = getLocales();
  const deviceLocale = locales[0]?.languageCode?.toLowerCase() || "en";

  switch (deviceLocale) {
    case "vi":
      return "vi";
    case "zh":
      return "zh";
    case "en":
    default:
      return "en";
  }
};

/**
 * Load saved language from storage
 */
export const loadLanguage = async (): Promise<Language> => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

    if (savedLanguage && ["en", "vi", "zh"].includes(savedLanguage)) {
      currentLanguage = savedLanguage as Language;
      return currentLanguage;
    }
  } catch (error) {
    console.error("Error loading language:", error);
  }

  // Fallback to device language
  currentLanguage = detectDeviceLanguage();
  return currentLanguage;
};

/**
 * Change and save language
 */
export const changeLanguage = async (language: Language): Promise<void> => {
  try {
    currentLanguage = language;
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
  } catch (error) {
    console.error("Error saving language:", error);
  }
};

/**
 * Translate function with nested key support and variable interpolation
 * @param key - Translation key (supports nested like 'settingsScreen.account.title')
 * @param options - Optional interpolation variables (supports both {{var}} and {var} formats)
 * @returns Translated string with replaced variables
 * 
 * @example
 * // Simple translation
 * translate('home') // 'Home'
 * 
 * @example
 * // With single brace variable (for permission messages)
 * translate('privacyScreen.alert.message', { permission: 'Camera' })
 * // 'Please go to Settings to enable Camera permission'
 * 
 * @example
 * // With double brace variable (for other cases)
 * translate('welcome.message', { name: 'John', age: 25 })
 * // 'Hello {{name}}, you are {{age}} years old'
 */
export const translate = (
  key: TranslationKey,
  options?: Record<string, string | number>
): string => {
  const translation = translations[currentLanguage];
  const value = getNestedValue(translation, key);
  return interpolate(value, options);
};

/**
 * Get current locale
 */
export const getCurrentLocale = (): Language => {
  return currentLanguage;
};

/**
 * Shorthand alias for translate
 */
export const t = translate;