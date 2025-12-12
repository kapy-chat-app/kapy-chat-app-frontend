/* eslint-disable react/no-unescaped-entities */
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import * as React from "react";
import { Alert, Text, TouchableOpacity, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const { t } = useLanguage();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  // Handle Clerk sign-up
  const onSignUpPress = async () => {
    if (!isLoaded) return;

    if (!emailAddress.trim()) {
      Alert.alert(t('error'), t('auth.signUp.errors.emailRequired'));
      return;
    }

    if (!password.trim()) {
      Alert.alert(t('error'), t('auth.signUp.errors.passwordRequired'));
      return;
    }

    if (password.length < 8) {
      Alert.alert(t('error'), t('auth.signUp.errors.passwordLength'));
      return;
    }

    setIsLoading(true);

    try {
      await signUp.create({
        emailAddress: emailAddress.trim(),
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].longMessage || err.errors[0].message;
        Alert.alert(t('auth.signUp.errors.signUpFailed'), errorMessage);
      } else {
        Alert.alert(t('error'), t('auth.signUp.errors.generic'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle email verification
  const onVerifyPress = async () => {
    if (!isLoaded) return;

    if (!code.trim()) {
      Alert.alert(t('error'), t('auth.signUp.errors.codeRequired'));
      return;
    }

    setIsLoading(true);

    try {
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });

      if (signUpAttempt.status === "complete") {
        await setActive?.({ session: signUpAttempt.createdSessionId });
        router.push("/complete-profile");
      } else {
        console.error(JSON.stringify(signUpAttempt, null, 2));
        Alert.alert(
          t('auth.signUp.errors.verifyFailed'),
          t('auth.signUp.errors.incomplete')
        );
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].longMessage || err.errors[0].message;
        Alert.alert(t('auth.signUp.errors.verifyFailed'), errorMessage);
      } else {
        Alert.alert(t('error'), t('auth.signUp.errors.generic'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Verification Screen
  if (pendingVerification) {
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
            <Text className={`text-4xl font-bold text-center mb-4 ${
              isDark ? 'text-orange-400' : 'text-orange-500'
            }`}>
              {t('auth.signUp.verifyEmail.title')}
            </Text>
            
            {/* Description */}
            <Text className={`text-base text-center mb-12 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {t('auth.signUp.verifyEmail.description')} {emailAddress}
            </Text>

            {/* Verification Code Input */}
            <Input
              placeholder={t('auth.signUp.verifyEmail.codePlaceholder')}
              value={code}
              onChangeText={setCode}
              leftIcon="mail-outline"
              keyboardType="number-pad"
              maxLength={6}
              editable={!isLoading}
              style={{ marginBottom: 24 }}
              inputStyle={{ textAlign: "center" }}
            />

            {/* Verify Button */}
            <Button
              title={isLoading ? t('auth.signUp.verifyEmail.verifying') : t('auth.signUp.verifyEmail.verifyButton')}
              onPress={onVerifyPress}
              variant="primary"
              disabled={isLoading}
              loading={isLoading}
              fullWidth={true}
              style={{ marginBottom: 24 }}
            />

            {/* Go Back Link */}
            <View className="items-center">
              <TouchableOpacity onPress={() => setPendingVerification(false)}>
                <Text className={`text-base ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {t('auth.signUp.verifyEmail.didntReceive')}{" "}
                  <Text className={`font-semibold ${
                    isDark ? 'text-orange-400' : 'text-orange-500'
                  }`}>
                    {t('auth.signUp.verifyEmail.goBack')}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Initial Sign Up Screen
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
            {t('auth.signUp.title')}
          </Text>

          {/* Form */}
          <View className="space-y-4">
            <Input
              placeholder={t('auth.signUp.emailPlaceholder')}
              value={emailAddress}
              onChangeText={setEmailAddress}
              leftIcon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
              style={{ marginVertical: 8 }}
            />

            <Input
              placeholder={t('auth.signUp.passwordPlaceholder')}
              value={password}
              onChangeText={setPassword}
              leftIcon="lock-closed-outline"
              secureTextEntry={true}
              editable={!isLoading}
              style={{ marginVertical: 8 }}
            />

            {/* Password Requirement */}
            <View className="px-4 mt-2">
              <Text className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {t('auth.signUp.passwordRequirement')}
              </Text>
            </View>

            {/* Continue Button */}
            <View className="mt-8">
              <Button
                title={isLoading ? t('auth.signUp.creatingAccount') : t('auth.signUp.continueButton')}
                onPress={onSignUpPress}
                variant="primary"
                disabled={isLoading}
                loading={isLoading}
                fullWidth={true}
                style={{ marginTop: 16 }}
              />
            </View>
          </View>

          {/* Sign In Link */}
          <View className="items-center mt-8">
            <Text className={`text-base ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {t('auth.signUp.haveAccount')}
            </Text>
            <Link href="/sign-in" asChild>
              <TouchableOpacity className="mt-2">
                <Text className={`font-semibold text-base ${
                  isDark ? 'text-orange-400' : 'text-orange-500'
                }`}>
                  {t('auth.signUp.signInLink')}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}