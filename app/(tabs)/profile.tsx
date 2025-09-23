import ProfileEditModal from "@/components/page/profile/ProfileEditModal";
import Header from "@/components/shared/Header";
import Sidebar from "@/components/shared/Sidebar";
import { UserProfile, useUserApi } from "@/hooks/user/useUserApi";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useState, useRef } from "react";
import {
  Alert,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
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
    Alert.alert("Profile Picture", "Choose an option", [
      { text: "Camera", onPress: () => pickImage("camera") },
      { text: "Gallery", onPress: () => pickImage("gallery") },
      {
        text: "Remove Photo",
        onPress: handleRemoveAvatar,
        style: "destructive",
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, []);

  const pickImage = useCallback(async (source: "camera" | "gallery") => {
    try {
      const permissionResult =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.status !== "granted") {
        Alert.alert(
          "Permission needed",
          `Please grant permission to access your ${source}`
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
          Alert.alert("Success", "Profile picture updated successfully");
        } else {
          Alert.alert(
            "Error",
            uploadResult.error || "Failed to update profile picture"
          );
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  }, [uploadAvatar, getUserProfile]);

  const handleRemoveAvatar = useCallback(async () => {
    try {
      const result = await removeAvatar();
      if (result.success) {
        // Reload profile after successful removal
        const profileResult = await getUserProfile();
        if (profileResult.success && profileResult.data) {
          setProfile(profileResult.data);
        }
        Alert.alert("Success", "Profile picture removed successfully");
      } else {
        Alert.alert(
          "Error",
          result.error || "Failed to remove profile picture"
        );
      }
    } catch (error) {
      console.error("Error removing avatar:", error);
      Alert.alert("Error", "Failed to remove profile picture");
    }
  }, [removeAvatar, getUserProfile]);

  const formatDate = useCallback((date: Date | undefined) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString();
  }, []);

  // Memoized component to prevent unnecessary rerenders
  const InfoRow = useCallback(({
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
  ), [isDark]);

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
        <Header title="Profile" onMenuPress={() => setIsSidebarVisible(true)} />
        <View className="flex-1 justify-center items-center">
          <Text className={`text-lg ${isDark ? "text-white" : "text-black"}`}>
            Loading...
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
        title="Profile"
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
            General
          </Text>

          <InfoRow
            label="Full Name"
            value={profile.full_name}
            icon="person-outline"
          />

          <InfoRow
            label="Username"
            value={`@${profile.username}`}
            icon="at-outline"
          />

          <InfoRow
            label="Bio"
            value={profile.bio || "No bio available"}
            icon="document-text-outline"
          />

          <InfoRow
            label="Gender"
            value={
              profile.gender
                ? profile.gender.charAt(0).toUpperCase() +
                  profile.gender.slice(1)
                : "Not set"
            }
            icon="body-outline"
          />

          <InfoRow
            label="Birthday"
            value={formatDate(profile.date_of_birth)}
            icon="calendar-outline"
          />

          {/* Contact Section */}
          <Text
            className={`text-lg font-semibold mb-4 mt-8 ${isDark ? "text-white" : "text-black"}`}
          >
            Contact
          </Text>

          <InfoRow
            label="Phone"
            value={profile.phone || "Not set"}
            icon="call-outline"
          />

          <InfoRow label="Email" value={profile.email} icon="mail-outline" />

          <InfoRow
            label="Location"
            value={profile.location || "Not set"}
            icon="location-outline"
          />

          {/* Personal Section */}
          <Text
            className={`text-lg font-semibold mb-4 mt-8 ${isDark ? "text-white" : "text-black"}`}
          >
            Personal
          </Text>

          <InfoRow
            label="Website"
            value={profile.website || "Not set"}
            icon="globe-outline"
          />

          <InfoRow
            label="Status"
            value={profile.status || "Active"}
            icon="radio-outline"
          />

          {/* Account Info */}
          <Text
            className={`text-lg font-semibold mb-4 mt-8 ${isDark ? "text-white" : "text-black"}`}
          >
            Account Information
          </Text>

          <InfoRow
            label="Joined"
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
                  Verified
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
                    ? "Verified"
                    : "Not Verified"}
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