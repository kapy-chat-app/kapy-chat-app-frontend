import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Language } from '@/types/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = '@has_seen_onboarding';

interface OnboardingSlide {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  iconColor: string;
}

const slides: OnboardingSlide[] = [
  {
    id: '1',
    titleKey: 'onboarding.slide1.title',
    descriptionKey: 'onboarding.slide1.description',
    icon: 'shield-checkmark',
    iconColor: '#10B981',
  },
  {
    id: '2',
    titleKey: 'onboarding.slide2.title',
    descriptionKey: 'onboarding.slide2.description',
    icon: 'sparkles',
    iconColor: '#8B5CF6',
  },
  {
    id: '3',
    titleKey: 'onboarding.slide3.title',
    descriptionKey: 'onboarding.slide3.description',
    icon: 'heart',
    iconColor: '#EC4899',
  },
];

const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { language, switchLanguage, t } = useLanguage();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showLanguageSelector, setShowLanguageSelector] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleLanguageSelect = async (lang: Language) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await switchLanguage(lang);
      // Small delay to ensure language is saved
      setTimeout(() => {
        setShowLanguageSelector(false);
        setIsProcessing(false);
      }, 300);
    } catch (error) {
      console.error('Error switching language:', error);
      setIsProcessing(false);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (isProcessing) return;
    
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = () => {
    if (isProcessing) return;
    handleGetStarted();
  };

  const handleGetStarted = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      console.log('Onboarding completed, navigating to sign-in');
      
      // Use replace to prevent going back
      router.replace('/(auth)/sign-in');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      setIsProcessing(false);
    }
  };

  // Language Selector Screen
  if (showLanguageSelector) {
    return (
      <SafeAreaView
        className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}
      >
        <View className="flex-1 px-6 justify-center">
          {/* Icon */}
          <View className="items-center mb-8">
            <View
              className={`w-24 h-24 rounded-full items-center justify-center ${
                isDark ? 'bg-orange-900/20' : 'bg-orange-50'
              }`}
            >
              <Ionicons
                name="language"
                size={48}
                color={isDark ? '#FB923C' : '#F97316'}
              />
            </View>
          </View>

          {/* Title */}
          <Text
            className={`text-3xl font-bold text-center mb-3 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Choose Your Language
          </Text>

          {/* Description */}
          <Text
            className={`text-base text-center mb-12 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            Select your preferred language to continue
          </Text>

          {/* Language Options */}
          <View className="space-y-3">
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                onPress={() => handleLanguageSelect(lang.code)}
                disabled={isProcessing}
                className={`flex-row items-center p-4 rounded-2xl border-2 ${
                  language === lang.code
                    ? isDark
                      ? 'bg-orange-900/20 border-orange-500'
                      : 'bg-orange-50 border-orange-500'
                    : isDark
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-gray-50 border-gray-200'
                } ${isProcessing ? 'opacity-50' : ''}`}
                activeOpacity={0.7}
              >
                <Text className="text-3xl mr-4">{lang.flag}</Text>
                <Text
                  className={`text-lg font-semibold flex-1 ${
                    language === lang.code
                      ? 'text-orange-500'
                      : isDark
                      ? 'text-white'
                      : 'text-gray-900'
                  }`}
                >
                  {lang.label}
                </Text>
                {language === lang.code && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color="#F97316"
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            onPress={() => {
              if (!isProcessing) {
                setShowLanguageSelector(false);
              }
            }}
            disabled={isProcessing}
            className={`mt-12 bg-orange-500 py-4 rounded-2xl ${
              isProcessing ? 'opacity-50' : ''
            }`}
            activeOpacity={0.8}
          >
            <Text className="text-white text-center text-lg font-semibold">
              {isProcessing ? 'Loading...' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Onboarding Slides
  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}
    >
      {/* Skip Button */}
      {currentIndex < slides.length - 1 && (
        <TouchableOpacity
          onPress={handleSkip}
          disabled={isProcessing}
          className={`absolute top-16 right-6 z-10 px-4 py-2 ${
            isProcessing ? 'opacity-50' : ''
          }`}
          activeOpacity={0.7}
        >
          <Text
            className={`text-base font-semibold ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            Skip
          </Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        scrollEnabled={!isProcessing}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{ width }}
            className="flex-1 items-center justify-center px-8"
          >
            {/* Icon */}
            <View
              style={{ backgroundColor: item.iconColor + '20' }}
              className="w-32 h-32 rounded-full items-center justify-center mb-12"
            >
              <Ionicons
                name={item.icon as any}
                size={64}
                color={item.iconColor}
              />
            </View>

            {/* Title */}
            <Text
              className={`text-3xl font-bold text-center mb-6 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {t(item.titleKey as any)}
            </Text>

            {/* Description */}
            <Text
              className={`text-base text-center leading-7 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {t(item.descriptionKey as any)}
            </Text>
          </View>
        )}
      />

      {/* Bottom Section */}
      <View className="px-8 pb-12">
        {/* Pagination Dots */}
        <View className="flex-row justify-center mb-8">
          {slides.map((_, index) => (
            <View
              key={index}
              className={`h-2 rounded-full mx-1 ${
                index === currentIndex
                  ? 'w-8 bg-orange-500'
                  : isDark
                  ? 'w-2 bg-gray-700'
                  : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </View>

        {/* Next/Get Started Button */}
        <TouchableOpacity
          onPress={handleNext}
          disabled={isProcessing}
          className={`bg-orange-500 py-4 rounded-2xl flex-row items-center justify-center ${
            isProcessing ? 'opacity-50' : ''
          }`}
          activeOpacity={0.8}
        >
          <Text className="text-white text-center text-lg font-semibold mr-2">
            {isProcessing
              ? 'Loading...'
              : currentIndex === slides.length - 1
              ? 'Get Started'
              : 'Next'}
          </Text>
          {!isProcessing && (
            <Ionicons name="arrow-forward" size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}