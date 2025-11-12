import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface ThemeOption {
  mode: ThemeMode;
  titleKey: string;
  descriptionKey: string;
  icon: string;
}

export default function AppearanceScreen() {
  const router = useRouter();
  const { themeMode, actualTheme, setThemeMode } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === 'dark';

  const themeOptions: ThemeOption[] = [
    {
      mode: 'light',
      titleKey: 'appearance.light.title',
      descriptionKey: 'appearance.light.description',
      icon: 'sunny-outline',
    },
    {
      mode: 'dark',
      titleKey: 'appearance.dark.title',
      descriptionKey: 'appearance.dark.description',
      icon: 'moon-outline',
    },
    {
      mode: 'system',
      titleKey: 'appearance.system.title',
      descriptionKey: 'appearance.system.description',
      icon: 'phone-portrait-outline',
    },
  ];

  const handleThemeChange = async (mode: ThemeMode) => {
    await setThemeMode(mode);
  };

  const getThemeDisplayText = () => {
    switch (themeMode) {
      case 'light':
        return `☀️ ${t('appearance.light.title')}`;
      case 'dark':
        return `🌙 ${t('appearance.dark.title')}`;
      case 'system':
        return `📱 ${t('appearance.system.title')}`;
      default:
        return t('appearance.system.title');
    }
  };

  const getCurrentThemeStatus = () => {
    if (themeMode === 'system') {
      return t('appearance.currentTheme.followingDevice');
    }
    return t('appearance.currentTheme.usingMode', { mode: t(`appearance.${themeMode}.title`) });
  };

  const ThemeOptionCard = ({ option }: { option: ThemeOption }) => {
    const isSelected = themeMode === option.mode;

    return (
      <TouchableOpacity
        onPress={() => handleThemeChange(option.mode)}
        className={`flex-row items-center p-4 mb-3 rounded-2xl ${
          isSelected
            ? isDark
              ? 'bg-orange-500/20 border-2 border-orange-500'
              : 'bg-orange-50 border-2 border-orange-500'
            : isDark
            ? 'bg-gray-900'
            : 'bg-white'
        }`}
        activeOpacity={0.7}
      >
        <View
          className={`w-14 h-14 rounded-full justify-center items-center ${
            isSelected
              ? 'bg-orange-500'
              : isDark
              ? 'bg-gray-800'
              : 'bg-gray-100'
          }`}
        >
          <Ionicons
            name={option.icon as any}
            size={28}
            color={isSelected ? 'white' : isDark ? '#9CA3AF' : '#6B7280'}
          />
        </View>

        <View className="flex-1 ml-4">
          <Text
            className={`text-lg font-semibold ${
              isSelected
                ? 'text-orange-500'
                : isDark
                ? 'text-white'
                : 'text-black'
            }`}
          >
            {t(option.titleKey as any)}
          </Text>
          <Text
            className={`text-sm mt-1 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {t(option.descriptionKey as any)}
          </Text>
        </View>

        {isSelected && (
          <View className="w-6 h-6 rounded-full bg-orange-500 justify-center items-center">
            <Ionicons name="checkmark" size={18} color="white" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-gray-50'}`}>
      {/* Header */}
      <View
        className={`flex-row items-center px-4 py-4 ${
          isDark ? 'bg-black' : 'bg-white'
        }`}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-4 p-2"
          activeOpacity={0.7}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDark ? 'white' : 'black'}
          />
        </TouchableOpacity>
        <Text
          className={`text-xl font-bold ${
            isDark ? 'text-white' : 'text-black'
          }`}
        >
          {t('settingsScreen.preferences.appearance.title')}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-6">
        {/* Current Theme Display */}
        <View
          className={`p-6 mb-6 rounded-2xl ${
            isDark ? 'bg-gray-900' : 'bg-white'
          }`}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text
              className={`text-base font-semibold ${
                isDark ? 'text-white' : 'text-black'
              }`}
            >
              {t('appearance.currentTheme.title')}
            </Text>
            <View
              className={`px-3 py-1 rounded-full ${
                isDark ? 'bg-gray-800' : 'bg-gray-100'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  isDark ? 'text-orange-400' : 'text-orange-600'
                }`}
              >
                {getThemeDisplayText()}
              </Text>
            </View>
          </View>
          <Text
            className={`text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {getCurrentThemeStatus()}
          </Text>
        </View>

        {/* Theme Options */}
        <Text
          className={`text-sm font-semibold mb-4 ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          {t('appearance.chooseTheme')}
        </Text>

        {themeOptions.map((option) => (
          <ThemeOptionCard key={option.mode} option={option} />
        ))}

        {/* Info Card */}
        <View
          className={`mt-6 p-4 rounded-xl ${
            isDark ? 'bg-blue-500/10' : 'bg-blue-50'
          }`}
        >
          <View className="flex-row items-start">
            <Ionicons
              name="information-circle"
              size={20}
              color={isDark ? '#60A5FA' : '#3B82F6'}
              style={{ marginTop: 2 }}
            />
            <Text
              className={`flex-1 ml-3 text-sm leading-5 ${
                isDark ? 'text-blue-300' : 'text-blue-800'
              }`}
            >
              {t('appearance.info')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}