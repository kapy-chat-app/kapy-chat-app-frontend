import ProfileEditModal from "@/components/page/profile/ProfileEditModal";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { UserProfile, useUserApi } from "@/hooks/user/useUserApi";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function ProfileScreen() {
  const router = useRouter();
  const { actualTheme, themeMode } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";
  
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Use ref to prevent unnecessary recreations
  const loadingRef = useRef(false);

  const { getUserProfile, uploadAvatar, removeAvatar, isLoading, error } =
    useUserApi();

  // Memoize loadProfile function with stable dependencies
  const loadProfile = useCallback(async () => {
    // Prevent multiple concurrent requests
    if (loadingRef.current) return;

    loadingRef.current = true;
    try {
      const result = await getUserProfile();
      if (result.success && result.data) {
        setProfile(result.data);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      loadingRef.current = false;
    }
  }, []); // Remove getUserProfile from dependencies

  // Use useFocusEffect with stable callback
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, []) // Empty dependencies array
  );

  // Separate onRefresh function to avoid recreation
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await getUserProfile();
      if (result.success && result.data) {
        setProfile(result.data);
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
    } finally {
      setRefreshing(false);
    }
  }, []); // Empty dependencies

  const handleImagePicker = useCallback(() => {
    Alert.alert(t('profile.edit.imagePicker.title'), t('profile.edit.imagePicker.message'), [
      { text: t('camera'), onPress: () => pickImage("camera") },
      { text: t('gallery'), onPress: () => pickImage("gallery") },
      {
        text: t('profile.edit.removePhoto'),
        onPress: handleRemoveAvatar,
        style: "destructive",
      },
      { text: t('cancel'), style: "cancel" },
    ]);
  }, [t]);

  const pickImage = useCallback(
    async (source: "camera" | "gallery") => {
      try {
        const permissionResult =
          source === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionResult.status !== "granted") {
          Alert.alert(
            t('profile.edit.permission.title'),
            t('profile.edit.permission.message', { source })
          );
          return;
        }

        const result =
          source === "camera"
            ? await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });

        if (!result.canceled && result.assets[0]) {
          const uploadResult = await uploadAvatar(result.assets[0].uri);
          if (uploadResult.success) {
            // Reload profile after successful upload
            const profileResult = await getUserProfile();
            if (profileResult.success && profileResult.data) {
              setProfile(profileResult.data);
            }
            Alert.alert(t('success'), t('profile.edit.imageUpdated'));
          } else {
            Alert.alert(
              t('error'),
              uploadResult.error || t('profile.edit.imageUpdateFailed')
            );
          }
        }
      } catch (error) {
        console.error("Error picking image:", error);
        Alert.alert(t('error'), t('profile.edit.imagePickFailed'));
      }
    },
    [uploadAvatar, getUserProfile, t]
  );

  const handleRemoveAvatar = useCallback(async () => {
    try {
      const result = await removeAvatar();
      if (result.success) {
        // Reload profile after successful removal
        const profileResult = await getUserProfile();
        if (profileResult.success && profileResult.data) {
          setProfile(profileResult.data);
        }
        Alert.alert(t('success'), t('profile.edit.imageRemoved'));
      } else {
        Alert.alert(
          t('error'),
          result.error || t('profile.edit.imageRemoveFailed')
        );
      }
    } catch (error) {
      console.error("Error removing avatar:", error);
      Alert.alert(t('error'), t('profile.edit.imageRemoveFailed'));
    }
  }, [removeAvatar, getUserProfile, t]);

  const formatDate = useCallback((date: Date | undefined) => {
    if (!date) return t('profile.labels.notSet');
    return new Date(date).toLocaleDateString();
  }, [t]);

  const getThemeDisplayText = useCallback(() => {
    switch (themeMode) {
      case 'light':
        return '☀️ Light Mode';
      case 'dark':
        return '🌙 Dark Mode';
      case 'system':
        return `📱 System (${actualTheme === 'dark' ? 'Dark' : 'Light'})`;
      default:
        return 'System';
    }
  }, [themeMode, actualTheme]);

  // Memoized component to prevent unnecessary rerenders
  const InfoRow = useCallback(
    ({
      label,
      value,
      icon,
    }: {
      label: string;
      value: string;
      icon?: string;
    }) => (
      <View className="flex-row items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center">
          {icon && (
            <Ionicons
              name={icon as any}
              size={18}
              color={isDark ? "#9CA3AF" : "#6B7280"}
              style={{ marginRight: 12 }}
            />
          )}
          <Text className="text-gray-600 dark:text-gray-400 text-sm font-medium">
            {label}
          </Text>
        </View>
        <Text
          className={`text-right flex-1 ml-4 ${isDark ? "text-white" : "text-black"}`}
        >
          {value}
        </Text>
      </View>
    ),
    [isDark]
  );

  // Handle modal close and success
  const handleEditModalClose = useCallback(() => {
    setIsEditModalVisible(false);
  }, []);

  const handleEditSuccess = useCallback(async () => {
    // Reload profile after successful edit
    const result = await getUserProfile();
    if (result.success && result.data) {
      setProfile(result.data);
    }
    setIsEditModalVisible(false);
  }, [getUserProfile]);

  if (!profile) {
    return (
      <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
        <Header title={t('profile.screen.title')} showBackButton={true} onMenuPress={() => setIsSidebarVisible(true)} />
        <View className="flex-1 justify-center items-center">
          <Text className={`text-lg ${isDark ? "text-white" : "text-black"}`}>
            {t('loading')}
          </Text>
        </View>
        <Sidebar
          isVisible={isSidebarVisible}
          onClose={() => setIsSidebarVisible(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
      <Header
      showBackButton={true}
        title={t('profile.screen.title')}
        onMenuPress={() => setIsSidebarVisible(true)}
        rightComponent={
          <TouchableOpacity
            onPress={() => setIsEditModalVisible(true)}
            className="p-2"
          >
            <Ionicons
              name="create-outline"
              size={24}
              color={isDark ? "white" : "black"}
            />
          </TouchableOpacity>
        }
      />

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Header */}
        <View className={`${isDark ? "bg-gray-900" : "bg-gray-50"} pb-6`}>
          <View className="items-center pt-6">
            <TouchableOpacity onPress={handleImagePicker} className="relative">
              <View className="w-32 h-32 rounded-full overflow-hidden bg-gray-300 dark:bg-gray-600 border-4 border-white dark:border-gray-800">
                {profile.avatar?.url ? (
                  <Image
                    source={{ uri: profile.avatar.url }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-full justify-center items-center">
                    <Ionicons
                      name="person"
                      size={60}
                      color={isDark ? "#9CA3AF" : "#6B7280"}
                    />
                  </View>
                )}
              </View>
              <View className="absolute -bottom-2 -right-2 w-10 h-10 bg-orange-500 rounded-full justify-center items-center border-3 border-white dark:border-gray-800">
                <Ionicons name="camera" size={20} color="white" />
              </View>
            </TouchableOpacity>

            <Text
              className={`text-2xl font-bold mt-6 ${isDark ? "text-white" : "text-black"}`}
            >
              {profile.full_name}
            </Text>
            <Text
              className={`text-base ${isDark ? "text-gray-400" : "text-gray-600"}`}
            >
              @{profile.username}
            </Text>
            {profile.bio && (
              <Text
                className={`text-center mt-3 px-6 leading-5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
              >
                {profile.bio}
              </Text>
            )}
          </View>
        </View>

        {/* Profile Sections */}
        <View className="px-4 py-6">
          {/* General Section */}
          <Text
            className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-black"}`}
          >
            {t('profile.sections.general')}
          </Text>

          <InfoRow
            label={t('profile.labels.fullName')}
            value={profile.full_name}
            icon="person-outline"
          />

          <InfoRow
            label={t('profile.labels.username')}
            value={`@${profile.username}`}
            icon="at-outline"
          />

          <InfoRow
            label={t('profile.labels.bio')}
            value={profile.bio || t('profile.labels.bioEmpty')}
            icon="document-text-outline"
          />

          <InfoRow
            label={t('profile.labels.gender')}
            value={
              profile.gender
                ? profile.gender.charAt(0).toUpperCase() +
                  profile.gender.slice(1)
                : t('profile.labels.notSet')
            }
            icon="body-outline"
          />

          <InfoRow
            label={t('profile.labels.birthday')}
            value={formatDate(profile.date_of_birth)}
            icon="calendar-outline"
          />

          {/* Contact Section */}
          <Text
            className={`text-lg font-semibold mb-4 mt-8 ${isDark ? "text-white" : "text-black"}`}
          >
            {t('profile.sections.contact')}
          </Text>

          <InfoRow
            label={t('profile.labels.phone')}
            value={profile.phone || t('profile.labels.notSet')}
            icon="call-outline"
          />

          <InfoRow label={t('profile.labels.email')} value={profile.email} icon="mail-outline" />

          <InfoRow
            label={t('profile.labels.location')}
            value={profile.location || t('profile.labels.notSet')}
            icon="location-outline"
          />

          {/* Personal Section */}
          <Text
            className={`text-lg font-semibold mb-4 mt-8 ${isDark ? "text-white" : "text-black"}`}
          >
            {t('profile.sections.personal')}
          </Text>

          <InfoRow
            label={t('profile.labels.website')}
            value={profile.website || t('profile.labels.notSet')}
            icon="globe-outline"
          />

          <InfoRow
            label={t('profile.labels.status')}
            value={profile.status || t('profile.labels.active')}
            icon="radio-outline"
          />

          {/* Appearance Section */}
          <Text
            className={`text-lg font-semibold mb-4 mt-8 ${isDark ? "text-white" : "text-black"}`}
          >
            {t('profile.sections.preferences')}
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/setting/appearance')}
            className="flex-row items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center flex-1">
              <Ionicons
                name="color-palette-outline"
                size={18}
                color={isDark ? "#9CA3AF" : "#6B7280"}
                style={{ marginRight: 12 }}
              />
              <View className="flex-1">
                <Text className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                  {t('profile.labels.theme')}
                </Text>
                <Text
                  className={`text-xs mt-1 ${
                    isDark ? "text-gray-500" : "text-gray-500"
                  }`}
                >
                  {getThemeDisplayText()}
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={isDark ? "#9CA3AF" : "#6B7280"}
            />
          </TouchableOpacity>

          {/* Account Info */}
          <Text
            className={`text-lg font-semibold mb-4 mt-8 ${isDark ? "text-white" : "text-black"}`}
          >
            {t('profile.sections.account')}
          </Text>

          <InfoRow
            label={t('profile.labels.joined')}
            value={formatDate(profile.created_at)}
            icon="time-outline"
          />

          {profile.clerk_data?.email_verified !== undefined && (
            <View className="flex-row items-center justify-between py-4 border-b border-gray-200 dark:border-gray-700">
              <View className="flex-row items-center">
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                  style={{ marginRight: 12 }}
                />
                <Text className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                  {t('profile.labels.verified')}
                </Text>
              </View>
              <View className="flex-row items-center flex-1 ml-4 justify-end">
                <Ionicons
                  name={
                    profile.clerk_data.email_verified
                      ? "checkmark-circle"
                      : "close-circle"
                  }
                  size={16}
                  color={
                    profile.clerk_data.email_verified ? "#10B981" : "#EF4444"
                  }
                />
                <Text
                  className={`ml-2 ${isDark ? "text-white" : "text-black"}`}
                >
                  {profile.clerk_data.email_verified
                    ? t('profile.labels.verifiedStatus.yes')
                    : t('profile.labels.verifiedStatus.no')}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      {profile && (
        <ProfileEditModal
          isVisible={isEditModalVisible}
          onClose={handleEditModalClose}
          profile={profile}
          onUpdateSuccess={handleEditSuccess}
        />
      )}

      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setIsSidebarVisible(false)}
      />
    </SafeAreaView>
  );
}