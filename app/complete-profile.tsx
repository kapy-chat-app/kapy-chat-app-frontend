// app/(auth)/complete-profile.tsx
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useProfileCheck } from "@/hooks/user/useProfileCheck";
import { useUserApi } from "@/hooks/user/useUserApi";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

export default function CompleteProfilePage() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();
  const { createUser, checkUsername, isLoading: isCreatingUser } = useUserApi();
  const { markProfileComplete } = useProfileCheck();

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [isUsernameValid, setIsUsernameValid] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  // Debounce username check
  const checkUsernameDebounced = useCallback(
    debounce(async (username: string) => {
      if (username.length >= 3) {
        const isAvailable = await checkUsername(username);
        setIsUsernameValid(isAvailable);
        setUsernameError(isAvailable ? "" : "Username is not available");
      }
    }, 500),
    [checkUsername]
  );

  React.useEffect(() => {
    if (username) {
      checkUsernameDebounced(username);
    } else {
      setIsUsernameValid(false);
      setUsernameError("");
    }
  }, [username, checkUsernameDebounced]);

  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "You must complete your profile to use the app. Do you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await signOut();
            router.replace("/(auth)/sign-in");
          },
        },
      ]
    );
  };

  const onCompleteProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert("Error", "Please enter your full name");
      return;
    }

    if (!username.trim()) {
      Alert.alert("Error", "Please enter a username");
      return;
    }

    if (!isUsernameValid) {
      Alert.alert("Error", "Please choose a valid username");
      return;
    }

    try {
      const result = await createUser({
        email: user?.primaryEmailAddress?.emailAddress || "",
        full_name: fullName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
      });

      if (result.success) {
        // Mark profile as complete và redirect về home
        markProfileComplete();
        router.replace("/");
      } else {
        Alert.alert("Error", result.error || "Failed to create user profile");
      }
    } catch (error) {
      console.error("Error completing profile:", error);
      Alert.alert("Error", "Failed to complete profile. Please try again.");
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className="px-6 py-12">
        <Text className="text-4xl font-bold text-orange-500 dark:text-orange-400 text-center mb-4">
          Complete Profile
        </Text>

        <Text className="text-base text-gray-600 dark:text-gray-400 text-center mb-8">
          You must complete your profile to continue using the app
        </Text>

        <View className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Enter your full name"
            value={fullName}
            onChangeText={setFullName}
            leftIcon="person-outline"
            required
            editable={!isCreatingUser}
          />

          <Input
            label="Username"
            placeholder="Choose a unique username"
            value={username}
            onChangeText={setUsername}
            leftIcon="at"
            required
            autoCapitalize="none"
            editable={!isCreatingUser}
            error={!!usernameError}
            errorMessage={usernameError}
          />

          <Input
            label="Bio"
            placeholder="Tell us about yourself (optional)"
            value={bio}
            onChangeText={setBio}
            leftIcon="document-text-outline"
            multiline
            numberOfLines={3}
            maxLength={500}
            editable={!isCreatingUser}
          />

          <Input
            label="Phone Number"
            placeholder="Your phone number (optional)"
            value={phone}
            onChangeText={setPhone}
            leftIcon="call-outline"
            keyboardType="phone-pad"
            editable={!isCreatingUser}
          />

          <Button
            title={isCreatingUser ? "Creating Profile..." : "Complete Profile"}
            onPress={onCompleteProfile}
            variant="primary"
            disabled={isCreatingUser || !isUsernameValid || !fullName.trim()}
            loading={isCreatingUser}
            fullWidth={true}
            style={{ marginTop: 24 }}
          />

          <Button
            title="Sign Out"
            onPress={handleSignOut}
            variant="outline"
            fullWidth={true}
            style={{ marginTop: 12 }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

// Utility function for debouncing
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
