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
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Language, LanguageOption } from '@/types/i18n';

const languages: LanguageOption[] = [
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    flag: '🇬🇧',
  },
  {
    code: 'vi',
    label: 'Vietnamese',
    nativeLabel: 'Tiếng Việt',
    flag: '🇻🇳',
  },
  {
    code: 'zh',
    label: 'Chinese',
    nativeLabel: '中文',
    flag: '🇨🇳',
  },
];

export default function LanguageScreen() {
  const router = useRouter();
  const { actualTheme } = useTheme();
  const { language, switchLanguage, t } = useLanguage();
  const isDark = actualTheme === 'dark';

  const handleLanguageChange = async (lang: Language) => {
    await switchLanguage(lang);
  };

  const getCurrentLanguageInfo = () => {
    return languages.find((l) => l.code === language);
  };

  const LanguageCard = ({ option }: { option: LanguageOption }) => {
    const isSelected = language === option.code;

    return (
      <TouchableOpacity
        onPress={() => handleLanguageChange(option.code)}
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
          <Text style={{ fontSize: 32 }}>{option.flag}</Text>
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
            {option.nativeLabel}
          </Text>
          <Text
            className={`text-sm mt-1 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {option.label}
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

  const currentLang = getCurrentLanguageInfo();

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
          {t('settingsScreen.preferences.language.title')}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-6">
        {/* Current Language Display */}
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
              {t('languageScreen.currentLanguage.title')}
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
                {currentLang?.flag} {currentLang?.nativeLabel}
              </Text>
            </View>
          </View>
          <Text
            className={`text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {t('languageScreen.currentLanguage.description')}
          </Text>
        </View>

        {/* Language Options */}
        <Text
          className={`text-sm font-semibold mb-4 ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          {t('languageScreen.availableLanguages')}
        </Text>

        {languages.map((option) => (
          <LanguageCard key={option.code} option={option} />
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
              {t('languageScreen.info')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}