/* eslint-disable react/no-unescaped-entities */
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Text, TouchableOpacity, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function ForgotPasswordPage() {
  const { signIn, isLoaded } = useSignIn();
  const router = useRouter();
  const { t } = useLanguage();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const [emailAddress, setEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"request" | "reset">("request");

  // Step 1: Request password reset code
  const onRequestReset = async () => {
    if (!isLoaded) return;

    if (!emailAddress.trim()) {
      Alert.alert(t('error'), t('auth.forgotPassword.errors.emailRequired'));
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress.trim())) {
      Alert.alert(t('error'), t('auth.forgotPassword.errors.emailInvalid'));
      return;
    }

    setIsLoading(true);

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: emailAddress.trim(),
      });

      Alert.alert(
        t('auth.forgotPassword.alerts.codeSent.title'),
        t('auth.forgotPassword.alerts.codeSent.message'),
        [{ text: t('ok') }]
      );
      setStep("reset");
    } catch (err: any) {
      console.error("Reset request error:", err);
      
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].longMessage || err.errors[0].message;
        Alert.alert(t('error'), errorMessage);
      } else {
        Alert.alert(t('error'), t('auth.forgotPassword.errors.sendFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Reset password with code
  const onResetPassword = async () => {
    if (!isLoaded) return;

    if (!code.trim()) {
      Alert.alert(t('error'), t('auth.forgotPassword.errors.codeRequired'));
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert(t('error'), t('auth.forgotPassword.errors.passwordRequired'));
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert(t('error'), t('auth.forgotPassword.errors.passwordLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('error'), t('auth.forgotPassword.errors.passwordMismatch'));
      return;
    }

    setIsLoading(true);

    try {
      const resetAttempt = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: code.trim(),
        password: newPassword,
      });

      if (resetAttempt.status === "complete") {
        Alert.alert(
          t('auth.forgotPassword.alerts.success.title'),
          t('auth.forgotPassword.alerts.success.message'),
          [
            {
              text: t('ok'),
              onPress: () => router.replace("/(auth)/sign-in"),
            },
          ]
        );
      } else {
        Alert.alert(t('error'), t('auth.forgotPassword.errors.incomplete'));
      }
    } catch (err: any) {
      console.error("Reset password error:", err);
      
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].longMessage || err.errors[0].message;
        Alert.alert(t('error'), errorMessage);
      } else {
        Alert.alert(t('error'), t('auth.forgotPassword.errors.resetFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onResendCode = async () => {
    setIsLoading(true);
    try {
      await signIn?.create({
        strategy: "reset_password_email_code",
        identifier: emailAddress.trim(),
      });
      Alert.alert(t('success'), t('auth.forgotPassword.alerts.resendSuccess'));
    } catch (err: any) {
      console.error("Resend code error:", err);
      Alert.alert(t('error'), t('auth.forgotPassword.errors.resendFailed'));
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
        <View className="flex-1 px-6 pt-8">
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => {
              if (step === "reset") {
                setStep("request");
                setCode("");
                setNewPassword("");
                setConfirmPassword("");
              } else {
                router.back();
              }
            }}
            className="mb-8"
            disabled={isLoading}
          >
            <Ionicons 
              name="arrow-back" 
              size={28} 
              color={isDark ? '#FB923C' : '#F97316'}
            />
          </TouchableOpacity>

          {/* Title */}
          <Text className={`text-4xl font-bold mb-4 ${
            isDark ? 'text-orange-400' : 'text-orange-500'
          }`}>
            {step === "request" ? t('auth.forgotPassword.title') : t('auth.forgotPassword.resetTitle')}
          </Text>

          {/* Description */}
          <Text className={`text-base mb-8 ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {step === "request" 
              ? t('auth.forgotPassword.description')
              : t('auth.forgotPassword.resetDescription')
            }
          </Text>

          {/* Step 1: Request Reset Code */}
          {step === "request" && (
            <View className="space-y-4">
              <Input
                placeholder={t('auth.forgotPassword.emailPlaceholder')}
                value={emailAddress}
                onChangeText={setEmailAddress}
                leftIcon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
                style={{ marginVertical: 8 }}
              />

              <View className="mt-8">
                <Button
                  title={isLoading ? t('auth.forgotPassword.sending') : t('auth.forgotPassword.sendCodeButton')}
                  onPress={onRequestReset}
                  variant="primary"
                  disabled={isLoading}
                  loading={isLoading}
                  fullWidth={true}
                  style={{ marginTop: 16 }}
                />
              </View>
            </View>
          )}

          {/* Step 2: Reset Password with Code */}
          {step === "reset" && (
            <View className="space-y-4">
              {/* Email Info */}
              <View className={`p-4 rounded-xl mb-4 ${
                isDark ? 'bg-blue-900/20' : 'bg-blue-50'
              }`}>
                <Text className={`text-sm ${
                  isDark ? 'text-blue-300' : 'text-blue-700'
                }`}>
                  {t('auth.forgotPassword.codeSentTo')} {emailAddress}
                </Text>
              </View>

              <Input
                placeholder={t('auth.forgotPassword.codePlaceholder')}
                value={code}
                onChangeText={setCode}
                leftIcon="key-outline"
                keyboardType="number-pad"
                editable={!isLoading}
                style={{ marginVertical: 8 }}
                maxLength={6}
              />

              <Input
                placeholder={t('auth.forgotPassword.newPasswordPlaceholder')}
                value={newPassword}
                onChangeText={setNewPassword}
                leftIcon="lock-closed-outline"
                secureTextEntry={true}
                editable={!isLoading}
                style={{ marginVertical: 8 }}
              />

              <Input
                placeholder={t('auth.forgotPassword.confirmPasswordPlaceholder')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                leftIcon="lock-closed-outline"
                secureTextEntry={true}
                editable={!isLoading}
                style={{ marginVertical: 8 }}
              />

              {/* Resend Code */}
              <View className="items-center mt-4">
                <TouchableOpacity onPress={onResendCode} disabled={isLoading}>
                  <Text className={`text-base ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {t('auth.forgotPassword.didntReceive')}{" "}
                    <Text className={`font-semibold ${
                      isDark ? 'text-orange-400' : 'text-orange-500'
                    }`}>
                      {t('auth.forgotPassword.resend')}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="mt-8">
                <Button
                  title={isLoading ? t('auth.forgotPassword.resetting') : t('auth.forgotPassword.resetButton')}
                  onPress={onResetPassword}
                  variant="primary"
                  disabled={isLoading}
                  loading={isLoading}
                  fullWidth={true}
                  style={{ marginTop: 16 }}
                />
              </View>
            </View>
          )}

          {/* Password Requirements */}
          {step === "reset" && (
            <View className={`mt-8 p-4 rounded-xl ${
              isDark ? 'bg-gray-800' : 'bg-gray-100'
            }`}>
              <Text className={`font-semibold mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {t('auth.forgotPassword.requirements.title')}
              </Text>
              <Text className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {t('auth.forgotPassword.requirements.minLength')}
              </Text>
              <Text className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {t('auth.forgotPassword.requirements.recommended')}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}