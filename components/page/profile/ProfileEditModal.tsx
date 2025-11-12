import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Components
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import TextArea from "@/components/ui/TextArea";
import DatePicker from "@/components/ui/DatePicker";
import SingleSelector, { SelectOption } from "@/components/ui/SingleSelector";

// Hooks and Types
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ProfileUpdateData,
  UserProfile,
  useUserApi,
} from "@/hooks/user/useUserApi";
import {
  GENDER_OPTIONS,
  ProfileFormData,
  validateProfile,
} from "@/types/profile";

interface ProfileEditModalProps {
  isVisible: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdateSuccess: () => void;
}

// Convert GENDER_OPTIONS to SelectOption format
const genderOptions: SelectOption[] = GENDER_OPTIONS.map(option => ({
  label: option.label,
  value: option.value,
  icon: option.value === 'male' ? 'male' : 
        option.value === 'female' ? 'female' : 
        option.value === 'other' ? 'transgender' : 'eye-off',
  description: option.value === 'private' ? 'Only visible to you' : undefined,
}));

// Status options
const statusOptions: SelectOption[] = [
  {
    label: "Available",
    value: "available",
    icon: "checkmark-circle",
    description: "Ready to connect and chat"
  },
  {
    label: "Busy",
    value: "busy",
    icon: "time",
    description: "Limited availability"
  },
  {
    label: "Away",
    value: "away",
    icon: "moon",
    description: "Currently away"
  },
  {
    label: "Do Not Disturb",
    value: "dnd",
    icon: "remove-circle",
    description: "Please don't disturb me"
  },
  {
    label: "Offline",
    value: "offline",
    icon: "radio-button-off",
    description: "Not available"
  },
];

export default function ProfileEditModal({
  isVisible,
  onClose,
  profile,
  onUpdateSuccess,
}: ProfileEditModalProps) {
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = actualTheme === "dark";
  const { updateUserProfile, isLoading } = useUserApi();

  const [formData, setFormData] = useState<ProfileFormData>({
    full_name: "",
    username: "",
    bio: "",
    phone: "",
    location: "",
    website: "",
    gender: "private",
    status: "",
  });

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        username: profile.username || "",
        bio: profile.bio || "",
        phone: profile.phone || "",
        location: profile.location || "",
        website: profile.website || "",
        gender: (profile.gender as any) || "private",
        status: profile.status || "available",
      });

      if (profile.date_of_birth) {
        setSelectedDate(new Date(profile.date_of_birth));
      }
    }
  }, [profile]);

  const handleInputChange = useCallback(
    (field: keyof ProfileFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error when user starts typing
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: "" }));
      }
    },
    [errors]
  );

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleGenderChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, gender: value as ProfileFormData['gender'] }));
    if (errors.gender) {
      setErrors(prev => ({ ...prev, gender: "" }));
    }
  }, [errors.gender]);

  const handleStatusChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, status: value }));
    if (errors.status) {
      setErrors(prev => ({ ...prev, status: "" }));
    }
  }, [errors.status]);

  const handleSave = useCallback(async () => {
    // Validate form
    const validation = validateProfile(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      Alert.alert(t('profile.edit.validation.title'), t('profile.edit.validation.message'));
      return;
    }

    try {
      const updateData: ProfileUpdateData = {
        ...formData,
        date_of_birth: selectedDate.toISOString().split("T")[0], // Format as YYYY-MM-DD
      };

      const result = await updateUserProfile(updateData);

      if (result.success) {
        Alert.alert(t('success'), t('profile.edit.updateSuccess'), [
          {
            text: t('ok'),
            onPress: () => {
              onUpdateSuccess();
              onClose();
            },
          },
        ]);
      } else {
        Alert.alert(t('error'), result.error || t('profile.edit.updateFailed'));
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert(t('error'), t('profile.edit.unexpectedError'));
    }
  }, [formData, selectedDate, updateUserProfile, onUpdateSuccess, onClose, t]);

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView className={`flex-1 ${isDark ? "bg-black" : "bg-white"}`}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          {/* Header */}
          <View className={`px-6 py-4 border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>
            <View className="flex-row items-center justify-between">
              <Button
                title={t('cancel')}
                variant="text"
                size="medium"
                onPress={onClose}
                style={{ paddingHorizontal: 0 }}
              />

              <Text className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                {t('profile.edit.title')}
              </Text>

              <Button
                title={isLoading ? t('saving') : t('save')}
                variant="primary"
                size="medium"
                onPress={handleSave}
                disabled={isLoading}
                loading={isLoading}
                style={{ paddingHorizontal: 20 }}
              />
            </View>
          </View>

          {/* Form Content */}
          <ScrollView
            className="flex-1 px-6 py-6"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Basic Information Section */}
            <View className="mb-6">
              <Text className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
                {t('profile.edit.sections.basic')}
              </Text>

              <Input
                label={t('profile.labels.fullName')}
                required
                placeholder={t('profile.edit.placeholders.fullName')}
                value={formData.full_name}
                onChangeText={(value) => handleInputChange("full_name", value)}
                error={!!errors.full_name}
                errorMessage={errors.full_name}
                leftIcon="person-outline"
              />

              <Input
                label={t('profile.labels.username')}
                required
                placeholder={t('profile.edit.placeholders.username')}
                value={formData.username}
                onChangeText={(value) => handleInputChange("username", value)}
                error={!!errors.username}
                errorMessage={errors.username}
                leftIcon="at-outline"
                autoCapitalize="none"
              />

              <TextArea
                label={t('profile.labels.bio')}
                placeholder={t('profile.edit.placeholders.bio')}
                value={formData.bio}
                onChangeText={(value) => handleInputChange("bio", value)}
                error={!!errors.bio}
                errorMessage={errors.bio}
                leftIcon="document-text-outline"
                rows={3}
                maxLength={500}
              />
            </View>

            {/* Contact Information Section */}
            <View className="mb-6">
              <Text className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
                {t('profile.edit.sections.contact')}
              </Text>

              <Input
                label={t('profile.labels.phone')}
                placeholder={t('profile.edit.placeholders.phone')}
                value={formData.phone}
                onChangeText={(value) => handleInputChange("phone", value)}
                error={!!errors.phone}
                errorMessage={errors.phone}
                leftIcon="call-outline"
                keyboardType="phone-pad"
              />

              <Input
                label={t('profile.labels.location')}
                placeholder={t('profile.edit.placeholders.location')}
                value={formData.location}
                onChangeText={(value) => handleInputChange("location", value)}
                error={!!errors.location}
                errorMessage={errors.location}
                leftIcon="location-outline"
              />

              <Input
                label={t('profile.labels.website')}
                placeholder={t('profile.edit.placeholders.website')}
                value={formData.website}
                onChangeText={(value) => handleInputChange("website", value)}
                error={!!errors.website}
                errorMessage={errors.website}
                leftIcon="globe-outline"
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>

            {/* Personal Information Section */}
            <View className="mb-6">
              <Text className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
                {t('profile.edit.sections.personal')}
              </Text>

              <SingleSelector
                label={t('profile.labels.gender')}
                placeholder={t('profile.edit.placeholders.gender')}
                options={genderOptions}
                value={formData.gender}
                onChange={handleGenderChange}
                error={!!errors.gender}
                errorMessage={errors.gender}
                leftIcon="person-outline"
              />

              <DatePicker
                label={t('profile.labels.birthday')}
                placeholder={t('profile.edit.placeholders.birthday')}
                value={selectedDate}
                onChange={handleDateChange}
                mode="date"
                maximumDate={new Date()}
                format="medium"
                leftIcon="calendar-outline"
              />

              <SingleSelector
                label={t('profile.labels.status')}
                placeholder={t('profile.edit.placeholders.status')}
                options={statusOptions}
                value={formData.status}
                onChange={handleStatusChange}
                error={!!errors.status}
                errorMessage={errors.status}
                leftIcon="radio-outline"
              />
            </View>

            {/* Save Button */}
            <Button
              title={isLoading ? t('profile.edit.saving') : t('profile.edit.saveChanges')}
              variant="primary"
              size="large"
              onPress={handleSave}
              disabled={isLoading}
              loading={isLoading}
              fullWidth
              leftIcon="checkmark-outline"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}