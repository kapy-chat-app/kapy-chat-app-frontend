import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Header from '@/components/shared/Header';

interface Permission {
  id: string;
  titleKey: string;
  subtitleKey: string;
  icon: string;
  iconColor: string;
  status: 'granted' | 'denied' | 'undetermined';
  type: 'camera' | 'microphone' | 'photos' | 'location';
}

export default function PrivacyScreen() {
  const router = useRouter();
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === 'dark';

  const [permissions, setPermissions] = useState<Permission[]>([
    {
      id: 'camera',
      titleKey: 'privacyScreen.permissions.camera.title',
      subtitleKey: 'privacyScreen.permissions.camera.subtitle',
      icon: 'camera-outline',
      iconColor: '#3B82F6',
      status: 'undetermined',
      type: 'camera',
    },
    {
      id: 'microphone',
      titleKey: 'privacyScreen.permissions.microphone.title',
      subtitleKey: 'privacyScreen.permissions.microphone.subtitle',
      icon: 'mic-outline',
      iconColor: '#EF4444',
      status: 'undetermined',
      type: 'microphone',
    },
    {
      id: 'photos',
      titleKey: 'privacyScreen.permissions.photos.title',
      subtitleKey: 'privacyScreen.permissions.photos.subtitle',
      icon: 'images-outline',
      iconColor: '#8B5CF6',
      status: 'undetermined',
      type: 'photos',
    },
    {
      id: 'location',
      titleKey: 'privacyScreen.permissions.location.title',
      subtitleKey: 'privacyScreen.permissions.location.subtitle',
      icon: 'location-outline',
      iconColor: '#10B981',
      status: 'undetermined',
      type: 'location',
    },
  ]);

  // MOCK FUNCTIONS - Chỉ để test UI
  const requestPermission = (type: Permission['type']) => {
    // Simulate permission request
    Alert.alert(
      'Mock Permission Request',
      `This will request ${type} permission when running on a real device or development build.`,
      [
        {
          text: 'Grant (Mock)',
          onPress: () => {
            setPermissions((prev) =>
              prev.map((permission) =>
                permission.type === type
                  ? { ...permission, status: 'granted' }
                  : permission
              )
            );
          },
        },
        {
          text: 'Deny (Mock)',
          onPress: () => {
            setPermissions((prev) =>
              prev.map((permission) =>
                permission.type === type
                  ? { ...permission, status: 'denied' }
                  : permission
              )
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const showSettingsAlert = (type: Permission['type']) => {
    const permissionName = t(`privacyScreen.permissions.${type}.title` as any);
    
    Alert.alert(
      t('privacyScreen.alert.title'),
      t('privacyScreen.alert.message', { permission: permissionName }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('privacyScreen.alert.openSettings'),
          onPress: () => {
            // Mock - In real app this would open settings
            Alert.alert('Mock', 'This would open device settings');
          },
        },
      ]
    );
  };

  const handlePermissionPress = (permission: Permission) => {
    if (permission.status === 'granted') {
      Alert.alert(
        t('privacyScreen.granted.title'),
        t('privacyScreen.granted.message', {
          permission: t(permission.titleKey as any),
        }),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('privacyScreen.granted.changeInSettings'),
            onPress: () => {
              Alert.alert('Mock', 'This would open device settings');
            },
          },
        ]
      );
    } else if (permission.status === 'denied') {
      showSettingsAlert(permission.type);
    } else {
      requestPermission(permission.type);
    }
  };

  const getStatusColor = (status: Permission['status']) => {
    switch (status) {
      case 'granted':
        return '#10B981';
      case 'denied':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  const getStatusText = (status: Permission['status']) => {
    switch (status) {
      case 'granted':
        return t('privacyScreen.status.granted');
      case 'denied':
        return t('privacyScreen.status.denied');
      default:
        return t('privacyScreen.status.notRequested');
    }
  };

  const PermissionItem = ({ permission }: { permission: Permission }) => (
    <TouchableOpacity
      onPress={() => handlePermissionPress(permission)}
      className={`flex-row items-center py-4 px-4 ${
        isDark ? 'bg-gray-900' : 'bg-white'
      } mb-2 rounded-xl`}
      activeOpacity={0.7}
    >
      <View
        style={{ backgroundColor: permission.iconColor + '20' }}
        className="w-12 h-12 rounded-full justify-center items-center"
      >
        <Ionicons
          name={permission.icon as any}
          size={24}
          color={permission.iconColor}
        />
      </View>
      
      <View className="flex-1 ml-4">
        <Text
          className={`text-base font-semibold ${
            isDark ? 'text-white' : 'text-black'
          }`}
        >
          {t(permission.titleKey as any)}
        </Text>
        <Text
          className={`text-sm mt-1 ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          {t(permission.subtitleKey as any)}
        </Text>
        <View className="flex-row items-center mt-2">
          <View
            style={{ backgroundColor: getStatusColor(permission.status) }}
            className="w-2 h-2 rounded-full"
          />
          <Text
            style={{ color: getStatusColor(permission.status) }}
            className="text-xs font-medium ml-2"
          >
            {getStatusText(permission.status)}
          </Text>
        </View>
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
        title={t('privacyScreen.title')}
        showBackButton
        onBackPress={() => router.back()}
      />

      <ScrollView className="flex-1">
        {/* Development Notice */}
        <View
          className={`mx-4 mt-4 mb-2 p-3 rounded-xl ${
            isDark ? 'bg-yellow-900/20' : 'bg-yellow-50'
          }`}
        >
          <View className="flex-row items-start">
            <Ionicons
              name="warning"
              size={20}
              color="#F59E0B"
              style={{ marginTop: 2 }}
            />
            <Text
              className={`flex-1 ml-2 text-xs ${
                isDark ? 'text-yellow-200' : 'text-yellow-900'
              }`}
            >
              Development Mode: Permission requests are mocked. Build a development build to test real permissions.
            </Text>
          </View>
        </View>

        {/* Info Card */}
        <View
          className={`mx-4 mb-6 p-4 rounded-xl ${
            isDark ? 'bg-blue-900/20' : 'bg-blue-50'
          }`}
        >
          <View className="flex-row items-start">
            <Ionicons
              name="information-circle"
              size={24}
              color="#3B82F6"
              style={{ marginTop: 2 }}
            />
            <Text
              className={`flex-1 ml-3 text-sm ${
                isDark ? 'text-blue-200' : 'text-blue-900'
              }`}
            >
              {t('privacyScreen.info')}
            </Text>
          </View>
        </View>

        {/* Permissions List */}
        <View className="mb-6">
          <Text
            className={`text-sm font-semibold px-6 mb-3 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {t('privacyScreen.permissionsTitle')}
          </Text>
          <View className="px-4">
            {permissions.map((permission) => (
              <PermissionItem key={permission.id} permission={permission} />
            ))}
          </View>
        </View>

        {/* System Settings Button */}
        <View className="px-4 pb-8">
          <TouchableOpacity
            onPress={() => Alert.alert('Mock', 'This would open device settings')}
            className={`flex-row items-center justify-center py-4 px-4 rounded-xl ${
              isDark ? 'bg-gray-800' : 'bg-gray-200'
            }`}
            activeOpacity={0.8}
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color={isDark ? '#9CA3AF' : '#6B7280'}
            />
            <Text
              className={`text-base font-semibold ml-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              {t('privacyScreen.openSystemSettings')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}