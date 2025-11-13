import { changeLanguage, loadLanguage, translate } from "@/lib/language/i18n";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Language, TranslationKey } from "@/types/i18n";

interface LanguageContextType {
  language: Language;
  switchLanguage: (lang: Language) => Promise<void>;
  t: (key: TranslationKey, options?: Record<string, string | number>) => string;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
}) => {
  const [language, setLanguage] = useState<Language>("en");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLanguage()
      .then(setLanguage)
      .finally(() => setIsLoading(false));
  }, []);

  const switchLanguage = async (lang: Language): Promise<void> => {
    setIsLoading(true);
    await changeLanguage(lang);
    setLanguage(lang);
    setIsLoading(false);
  };

  const value: LanguageContextType = {
    language,
    switchLanguage,
    t: translate,
    isLoading,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};