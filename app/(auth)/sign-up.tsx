/* eslint-disable react/no-unescaped-entities */
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import * as React from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  // Chỉ giữ Clerk verification states
  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  // Loại bỏ tất cả additional user info states
  // Loại bỏ showAdditionalInfo
  // Loại bỏ username checking logic

  // Handle Clerk sign-up
  const onSignUpPress = async () => {
    if (!isLoaded) return;

    if (!emailAddress.trim()) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Error", "Please enter your password");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
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
        Alert.alert("Sign Up Failed", errorMessage);
      } else {
        Alert.alert("Error", "Failed to sign up. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle email verification - SIMPLIFIED
  const onVerifyPress = async () => {
    if (!isLoaded) return;

    if (!code.trim()) {
      Alert.alert("Error", "Please enter the verification code");
      return;
    }

    setIsLoading(true);

    try {
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });

      if (signUpAttempt.status === "complete") {
        // Set active session ngay lập tức
        await setActive?.({ session: signUpAttempt.createdSessionId });
        
        // Navigate trực tiếp đến complete-profile page
        router.push("/complete-profile");
      } else {
        console.error(JSON.stringify(signUpAttempt, null, 2));
        Alert.alert(
          "Verification Incomplete",
          "Please complete additional steps required."
        );
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
      
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].longMessage || err.errors[0].message;
        Alert.alert("Verification Failed", errorMessage);
      } else {
        Alert.alert("Error", "Failed to verify. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Loại bỏ hoàn toàn onCompleteSignUp function
  // Loại bỏ showAdditionalInfo screen

  // Verification Screen
  if (pendingVerification) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-gray-900 px-6 justify-center">
        <Text className="text-4xl font-bold text-orange-500 dark:text-orange-400 text-center mb-4">
          Verify Email
        </Text>
        
        <Text className="text-base text-gray-600 dark:text-gray-400 text-center mb-12">
          We've sent a verification code to {emailAddress}
        </Text>

        <Input
          placeholder="Enter verification code"
          value={code}
          onChangeText={setCode}
          leftIcon="mail-outline"
          keyboardType="number-pad"
          maxLength={6}
          editable={!isLoading}
          style={{ marginBottom: 24 }}
          inputStyle={{ textAlign: "center" }}
        />

        <Button
          title={isLoading ? "Verifying..." : "Verify Email"}
          onPress={onVerifyPress}
          variant="primary"
          disabled={isLoading}
          loading={isLoading}
          fullWidth={true}
          style={{ marginBottom: 24 }}
        />

        <View className="items-center">
          <TouchableOpacity onPress={() => setPendingVerification(false)}>
            <Text className="text-gray-600 dark:text-gray-400 text-base">
              Didn't receive code?{" "}
              <Text className="text-orange-500 dark:text-orange-400 font-semibold">Go back</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Initial Sign Up Screen - KHÔNG THAY ĐỔI
  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900 px-6 justify-center">
      <Text className="text-4xl font-bold text-orange-500 dark:text-orange-400 text-center mb-12">
        Sign up
      </Text>

      <View className="space-y-4">
        <Input
          placeholder="Enter your email"
          value={emailAddress}
          onChangeText={setEmailAddress}
          leftIcon="mail-outline"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoading}
          style={{ marginVertical: 8 }}
        />

        <Input
          placeholder="Enter password"
          value={password}
          onChangeText={setPassword}
          leftIcon="lock-closed-outline"
          secureTextEntry={true}
          editable={!isLoading}
          style={{ marginVertical: 8 }}
        />

        <View className="px-4 mt-2">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            Password must be at least 8 characters
          </Text>
        </View>

        <View className="mt-8">
          <Button
            title={isLoading ? "Creating Account..." : "Continue"}
            onPress={onSignUpPress}
            variant="primary"
            disabled={isLoading}
            loading={isLoading}
            fullWidth={true}
            style={{ marginTop: 16 }}
          />
        </View>
      </View>

      <View className="items-center mt-8">
        <Text className="text-gray-600 dark:text-gray-400 text-base">
          Already have an account?{" "}
        </Text>
        <Link href="/sign-in" asChild>
          <TouchableOpacity className="mt-2">
            <Text className="text-orange-500 dark:text-orange-400 font-semibold text-base">
              Sign In
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}