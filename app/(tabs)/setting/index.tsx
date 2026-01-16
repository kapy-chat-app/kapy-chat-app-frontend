import Header from '@/components/shared/Header';
import Sidebar from '@/components/shared/Sidebar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { UserProfile, useUserApi } from '@/hooks/user/useUserApi';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SettingItem {
  id: string;
  titleKey: string;
  subtitleKey?: string;
  icon: string;
  route: string;
  iconColor?: string;
}

interface SettingSection {
  titleKey: string;
  items: SettingItem[];
}

export default function MainSettingScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const { getUserProfile } = useUserApi();
  
  const isDark = actualTheme === 'dark';
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const result = await getUserProfile();
      if (result.success && result.data) {
        setProfile(result.data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, []);

  const settingsSections: SettingSection[] = [
    {
      titleKey: 'settingsScreen.account.title',
      items: [
        {
          id: 'security',
          titleKey: 'settingsScreen.account.security.title',
          subtitleKey: 'settingsScreen.account.security.subtitle',
          icon: 'shield-checkmark-outline',
          route: '/(tabs)/setting/security',
          iconColor: '#10B981',
        },
        {
          id: 'privacy',
          titleKey: 'settingsScreen.account.privacy.title',
          subtitleKey: 'settingsScreen.account.privacy.subtitle',
          icon: 'lock-closed-outline',
          route: '/(tabs)/setting/privacy',
          iconColor: '#3B82F6',
        },
      ],
    },
    {
      titleKey: 'settingsScreen.preferences.title',
      items: [
        {
          id: 'appearance',
          titleKey: 'settingsScreen.preferences.appearance.title',
          subtitleKey: 'settingsScreen.preferences.appearance.subtitle',
          icon: 'color-palette-outline',
          route: '/(tabs)/setting/appearance',
          iconColor: '#8B5CF6',
        },
        {
          id: 'language',
          titleKey: 'settingsScreen.preferences.language.title',
          subtitleKey: 'settingsScreen.preferences.language.subtitle',
          icon: 'language-outline',
          route: '/(tabs)/setting/language',
          iconColor: '#F59E0B',
        },
      ],
    },
    {
      titleKey: 'settingsScreen.data.title',
      items: [
        {
          id: 'storage',
          titleKey: 'settingsScreen.data.storage.title',
          subtitleKey: 'settingsScreen.data.storage.subtitle',
          icon: 'folder-outline',
          route: '/(tabs)/setting/storage',
          iconColor: '#EC4899',
        },
        {
          id: 'devices',
          titleKey: 'settingsScreen.data.devices.title',
          subtitleKey: 'settingsScreen.data.devices.subtitle',
          icon: 'phone-portrait-outline',
          route: '/(tabs)/setting/devices',
          iconColor: '#06B6D4',
        },
      ],
    },
  ];

  const handleSignOut = () => {
    Alert.alert(
      t('settingsScreen.signOut.title'),
      t('settingsScreen.signOut.message'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('settingsScreen.signOut.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Error signing out:', error);
            }
          },
        },
      ]
    );
  };

  const SettingItemComponent = ({ item }: { item: SettingItem }) => (
    <TouchableOpacity
      onPress={() => router.push(item.route as any)}
      className={`flex-row items-center py-4 px-4 ${
        isDark ? 'bg-gray-900' : 'bg-white'
      } mb-2 rounded-xl`}
      activeOpacity={0.7}
    >
      <View
        style={{ backgroundColor: item.iconColor + '20' }}
        className="w-12 h-12 rounded-full justify-center items-center"
      >
        <Ionicons
          name={item.icon as any}
          size={24}
          color={item.iconColor}
        />
      </View>
      <View className="flex-1 ml-4">
        <Text
          className={`text-base font-semibold ${
            isDark ? 'text-white' : 'text-black'
          }`}
        >
          {t(item.titleKey as any)}
        </Text>
        {item.subtitleKey && (
          <Text
            className={`text-sm mt-1 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {t(item.subtitleKey as any)}
          </Text>
        )}
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={isDark ? '#9CA3AF' : '#6B7280'}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-gray-50'}`}>
      <Header
        title={t('settings')}
        onMenuPress={() => setIsSidebarVisible(true)}
        showFloatingRec={true}
      />

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Card */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/setting/profile')}
          className={`mx-4 mt-4 mb-6 p-6 rounded-2xl ${
            isDark ? 'bg-gray-900' : 'bg-white'
          }`}
          activeOpacity={0.8}
        >
          <View className="flex-row items-center">
            <View className="relative">
              <View className="w-20 h-20 rounded-full overflow-hidden bg-gray-300 dark:bg-gray-600">
                {profile?.avatar?.url ? (
                  <Image
                    source={{ uri: profile.avatar.url }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-full justify-center items-center">
                    <Ionicons
                      name="person"
                      size={40}
                      color={isDark ? '#9CA3AF' : '#6B7280'}
                    />
                  </View>
                )}
              </View>
              <View className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full border-3 border-white dark:border-gray-900" />
            </View>

            <View className="flex-1 ml-4">
              <Text
                className={`text-xl font-bold ${
                  isDark ? 'text-white' : 'text-black'
                }`}
              >
                {profile?.full_name || t('settingsScreen.profile.loading')}
              </Text>
              <Text
                className={`text-sm mt-1 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                @{profile?.username || '...'}
              </Text>
              <Text
                className={`text-xs mt-2 ${
                  isDark ? 'text-gray-500' : 'text-gray-500'
                }`}
              >
                {t('settingsScreen.profile.viewAndEdit')}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={24}
              color={isDark ? '#9CA3AF' : '#6B7280'}
            />
          </View>
        </TouchableOpacity>

        {/* Settings Sections */}
        {settingsSections.map((section, index) => (
          <View key={index} className="mb-6">
            <Text
              className={`text-sm font-semibold px-6 mb-3 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {t(section.titleKey as any)}
            </Text>
            <View className="px-4">
              {section.items.map((item) => (
                <SettingItemComponent key={item.id} item={item} />
              ))}
            </View>
          </View>
        ))}

        {/* Sign Out Button */}
        <View className="px-4 pb-8">
          <TouchableOpacity
            onPress={handleSignOut}
            className="flex-row items-center justify-center py-4 px-4 bg-red-500 rounded-xl"
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={24} color="white" />
            <Text className="text-white text-base font-semibold ml-2">
              {t('settingsScreen.signOut.title')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setIsSidebarVisible(false)}
      />
    </SafeAreaView>
  );
}