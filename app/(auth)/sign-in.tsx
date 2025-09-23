/* eslint-disable react/no-unescaped-entities */
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

export default function SignInPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSignInPress = async () => {
    if (!isLoaded) return;

    if (!emailAddress.trim()) {
      Alert.alert("Error", "Please enter your email or phone number");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Error", "Please enter your password");
      return;
    }

    setIsLoading(true);

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress.trim(),
        password,
      });

      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        
        // Redirect về home, useProfileCheck sẽ handle việc check profile
        router.replace("/");
      } else {
        console.error("Sign in incomplete:", signInAttempt);
        Alert.alert("Sign In Incomplete", "Please complete additional steps required.");
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].longMessage || err.errors[0].message;
        Alert.alert("Sign In Failed", errorMessage);
      } else {
        Alert.alert("Error", "Failed to sign in. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900 px-6 justify-center">
      <Text className="text-4xl font-bold text-orange-500 dark:text-orange-400 text-center mb-12">
        Sign in
      </Text>

      <View className="space-y-4">
        <Input
          placeholder="PhoneNumber or Email"
          value={emailAddress}
          onChangeText={setEmailAddress}
          leftIcon="person-outline"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoading}
          style={{ marginVertical: 8 }}
        />

        <Input
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          leftIcon="lock-closed-outline"
          secureTextEntry={true}
          editable={!isLoading}
          style={{ marginVertical: 8 }}
        />

        <View className="items-center mt-4">
          <TouchableOpacity>
            <Text className="text-gray-600 dark:text-gray-400 text-base">
              Forgot your password?{" "}
              <Text className="text-orange-500 dark:text-orange-400 font-semibold">Reset now</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mt-8">
          <Button
            title={isLoading ? "Signing In..." : "Sign In"}
            onPress={onSignInPress}
            variant="primary"
            disabled={isLoading}
            loading={isLoading}
            fullWidth={true}
            style={{ marginTop: 16 }}
          />
        </View>
      </View>

      <View className="items-center mt-8">
        <Text className="text-gray-600 dark:text-gray-400 text-base">Don't have an account? </Text>
        <Link href="/sign-up" asChild>
          <TouchableOpacity className="mt-2">
            <Text className="text-orange-500 dark:text-orange-400 font-semibold text-base">
              Sign Up
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}