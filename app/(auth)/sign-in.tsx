/* eslint-disable react/no-unescaped-entities */
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Text, TouchableOpacity, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function SignInPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const { t } = useLanguage();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSignInPress = async () => {
    if (!isLoaded) return;

    if (!emailAddress.trim()) {
      Alert.alert(t('error'), t('auth.signIn.errors.emailRequired'));
      return;
    }

    if (!password.trim()) {
      Alert.alert(t('error'), t('auth.signIn.errors.passwordRequired'));
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
        router.replace("/");
      } else {
        console.error("Sign in incomplete:", signInAttempt);
        Alert.alert(
          t('auth.signIn.errors.signInFailed'),
          t('auth.signIn.errors.incomplete')
        );
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].longMessage || err.errors[0].message;
        Alert.alert(t('auth.signIn.errors.signInFailed'), errorMessage);
      } else {
        Alert.alert(t('error'), t('auth.signIn.errors.generic'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView 
      className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        className="flex-1"
      >
        <View className="flex-1 px-6 justify-center py-8">
          {/* Title */}
          <Text className={`text-4xl font-bold text-center mb-12 ${
            isDark ? 'text-orange-400' : 'text-orange-500'
          }`}>
            {t('auth.signIn.title')}
          </Text>

          {/* Form */}
          <View className="space-y-4">
            <Input
              placeholder={t('auth.signIn.emailPlaceholder')}
              value={emailAddress}
              onChangeText={setEmailAddress}
              leftIcon="person-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
              style={{ marginVertical: 8 }}
            />

            <Input
              placeholder={t('auth.signIn.passwordPlaceholder')}
              value={password}
              onChangeText={setPassword}
              leftIcon="lock-closed-outline"
              secureTextEntry={true}
              editable={!isLoading}
              style={{ marginVertical: 8 }}
            />

            {/* Forgot Password */}
            <View className="items-center mt-4">
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity disabled={isLoading}>
                  <Text className={`text-base ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {t('auth.signIn.forgotPassword')}{" "}
                    <Text className={`font-semibold ${
                      isDark ? 'text-orange-400' : 'text-orange-500'
                    }`}>
                      {t('auth.signIn.resetNow')}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>

            {/* Sign In Button */}
            <View className="mt-8">
              <Button
                title={isLoading ? t('auth.signIn.signingIn') : t('auth.signIn.signInButton')}
                onPress={onSignInPress}
                variant="primary"
                disabled={isLoading}
                loading={isLoading}
                fullWidth={true}
                style={{ marginTop: 16 }}
              />
            </View>
          </View>

          {/* Sign Up Link */}
          <View className="items-center mt-8">
            <Text className={`text-base ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {t('auth.signIn.noAccount')}
            </Text>
            <Link href="/sign-up" asChild>
              <TouchableOpacity className="mt-2">
                <Text className={`font-semibold text-base ${
                  isDark ? 'text-orange-400' : 'text-orange-500'
                }`}>
                  {t('auth.signIn.signUpLink')}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}