// app/(auth)/sign-in.tsx
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useUserApi } from "@/hooks/user/useUserApi";
import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SignInPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const { t } = useLanguage();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === "dark";
  const { getUserProfile } = useUserApi();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const completeSignIn = async (sessionId: string) => {
    try {
      await setActive?.({ session: sessionId });

      // đợi Clerk set session xong
      await new Promise((r) => setTimeout(r, 300));

      const profileResponse = await getUserProfile();

      if (profileResponse?.profileComplete === false || !profileResponse?.data) {
        router.replace("/complete-profile");
      } else {
        router.replace("/");
      }
    } catch (error) {
      console.error("Error completing sign in:", error);
      Alert.alert(
        t("error"),
        "Không thể hoàn tất đăng nhập. Vui lòng thử lại."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onSignInPress = async () => {
    if (!isLoaded) return;

    if (!emailAddress.trim() || !password.trim()) {
      Alert.alert(t("error"), "Vui lòng nhập email và mật khẩu");
      return;
    }

    setIsLoading(true);

    try {
      const attempt = await signIn.create({
        identifier: emailAddress.trim(),
        password,
      });

      console.log("SIGNIN STATUS:", attempt.status);

      if (attempt.status !== "complete") {
        // vì giờ bạn đã tắt Client Trust => đúng ra không bao giờ rơi vào đây
        Alert.alert(
          t("error"),
          `Đăng nhập chưa hoàn tất (status=${attempt.status}). Vui lòng kiểm tra lại cấu hình Clerk.`
        );
        setIsLoading(false);
        return;
      }

      await completeSignIn(attempt.createdSessionId!);
    } catch (err: any) {
      console.error("Sign in error:", err);
      setIsLoading(false);
      Alert.alert(t("error"), err?.errors?.[0]?.message || "Đăng nhập thất bại");
    }
  };

  return (
    <SafeAreaView className={`flex-1 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        className="flex-1"
      >
        <View className="flex-1 px-6 justify-center py-8">
          <Text
            className={`text-4xl font-bold text-center mb-12 ${
              isDark ? "text-orange-400" : "text-orange-500"
            }`}
          >
            {t("auth.signIn.title")}
          </Text>

          <View className="space-y-4">
            <Input
              placeholder={t("auth.signIn.emailPlaceholder")}
              value={emailAddress}
              onChangeText={setEmailAddress}
              leftIcon="person-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
              style={{ marginVertical: 8 }}
            />

            <Input
              placeholder={t("auth.signIn.passwordPlaceholder")}
              value={password}
              onChangeText={setPassword}
              leftIcon="lock-closed-outline"
              secureTextEntry
              editable={!isLoading}
              style={{ marginVertical: 8 }}
            />

            <View className="items-center mt-4">
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity disabled={isLoading}>
                  <Text
                    className={`text-base ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {t("auth.signIn.forgotPassword")}{" "}
                    <Text
                      className={`font-semibold ${
                        isDark ? "text-orange-400" : "text-orange-500"
                      }`}
                    >
                      {t("auth.signIn.resetNow")}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>

            <View className="mt-8">
              <Button
                title={
                  isLoading
                    ? t("auth.signIn.signingIn")
                    : t("auth.signIn.signInButton")
                }
                onPress={onSignInPress}
                variant="primary"
                disabled={isLoading}
                loading={isLoading}
                fullWidth
                style={{ marginTop: 16 }}
              />
            </View>
          </View>

          <View className="items-center mt-8">
            <Text
              className={`text-base ${
                isDark ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {t("auth.signIn.noAccount")}
            </Text>
            <Link href="/sign-up" asChild>
              <TouchableOpacity className="mt-2" disabled={isLoading}>
                <Text
                  className={`font-semibold text-base ${
                    isDark ? "text-orange-400" : "text-orange-500"
                  }`}
                >
                  {t("auth.signIn.signUpLink")}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
