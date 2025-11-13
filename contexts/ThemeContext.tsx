import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  actualTheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = '@app_theme_mode';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Calculate actual theme based on mode
  const actualTheme: 'light' | 'dark' = 
    themeMode === 'system' 
      ? (systemColorScheme === 'dark' ? 'dark' : 'light')
      : themeMode;

  useEffect(() => {
    loadThemeMode();
  }, []);

  const loadThemeMode = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_KEY);
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeModeState(savedTheme as ThemeMode);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_KEY, mode);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const value: ThemeContextType = {
    themeMode,
    actualTheme,
    setThemeMode,
    isLoading
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};