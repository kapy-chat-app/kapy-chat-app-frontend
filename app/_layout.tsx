// app/_layout.tsx
import IncomingCallModal from "@/components/page/call/IncomingCallModal";
import { EncryptionInitProvider } from "@/components/page/message/EncryptionInitProvider";
import { useIncomingCalls } from "@/hooks/call/useIncomingCalls";
import { useProfileCheck } from "@/hooks/user/useProfileCheck";
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { Buffer } from "buffer";
import { Stack } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import "react-native-get-random-values";
import { TextDecoder, TextEncoder } from "text-encoding";
import "../polyfills/text-encoding";
import "./global.css";
global.Buffer = Buffer;
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

function ProtectedLayout() {
  const { isCheckingProfile } = useProfileCheck();
  const { incomingCall, showIncomingCall, answerCall, rejectCall } =
    useIncomingCalls();

  // Hiển thị loading khi đang check profile
  if (isCheckingProfile) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 dark:bg-gray-900">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="mt-4 text-gray-600 dark:text-gray-400">
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen
          name="complete-profile"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="message" options={{ headerShown: false }} />
        <Stack.Screen name="call/[id]" options={{ headerShown: false }} />
      </Stack>
      <IncomingCallModal
        visible={showIncomingCall}
        callData={incomingCall}
        onAnswer={answerCall}
        onReject={rejectCall}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
      telemetry={false}
    >
      <EncryptionInitProvider>
        <ProtectedLayout />
      </EncryptionInitProvider>
    </ClerkProvider>
  );
}
