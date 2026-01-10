// app/_layout.tsx - COMPLETE FINAL VERSION WITH PiP
import IncomingCallModal from "@/components/page/call/IncomingCallModal";
import PiPCallOverlay from "@/components/page/call/PiPCallOverlay";
import { EncryptionInitProvider } from "@/components/page/message/EncryptionInitProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { PiPCallProvider, usePiPCall } from "@/contexts/PiPCallContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useIncomingCalls } from "@/hooks/call/useIncomingCalls";
import { useOptimizedCallInit } from "@/hooks/call/useOptimizedCallInit";
import { useNotificationHandler } from "@/hooks/notification/useNotificationHandler";
import { useProfileCheck } from "@/hooks/user/useProfileCheck";
import { UnifiedEncryptionService } from "@/lib/encryption/UnifiedEncryptionService";
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { Buffer } from "buffer";
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import "react-native-get-random-values";
import { TextDecoder, TextEncoder } from "text-encoding";
import "../polyfills/text-encoding";
import "./global.css";

global.Buffer = Buffer;
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// ⭐ NEW: PiP Overlay Manager Component
function PiPOverlayManager() {
  const router = useRouter();
  const { pipState, maximizeCall, updatePipState, endPipCall } = usePiPCall();

  const handleExpand = () => {
    if (!pipState.callId) return;

    console.log("🎬 Expanding PiP to full screen");
    maximizeCall();
    
    router.push({
      pathname: "/call/[id]" as any,
      params: {
        id: pipState.callId,
        channelName: pipState.channelName,
        conversationId: pipState.conversationId,
        callType: pipState.callType,
        fromPiP: "true", // Flag to restore state
      },
    });
  };

  const handleEndCall = async () => {
    console.log("🎬 Ending call from PiP");
    if (pipState.engine) {
      try {
        await pipState.engine.leaveChannel();
        await pipState.engine.release();
      } catch (error) {
        console.error("❌ Error ending call from PiP:", error);
      }
    }
    endPipCall();
  };

  const handleToggleMute = async () => {
    if (pipState.engine) {
      try {
        await pipState.engine.muteLocalAudioStream(!pipState.isMuted);
        updatePipState({ isMuted: !pipState.isMuted });
      } catch (error) {
        console.error("❌ Error toggling mute in PiP:", error);
      }
    }
  };

  const handleToggleVideo = async () => {
    if (pipState.engine) {
      try {
        await pipState.engine.muteLocalVideoStream(!pipState.isVideoOff);
        updatePipState({ isVideoOff: !pipState.isVideoOff });
      } catch (error) {
        console.error("❌ Error toggling video in PiP:", error);
      }
    }
  };

  return (
    <PiPCallOverlay
      visible={pipState.isMinimized}
      localUid={pipState.localUid}
      remoteUid={pipState.remoteUid || undefined}
      isMuted={pipState.isMuted}
      isVideoOff={pipState.isVideoOff}
      callDuration={pipState.callDuration}
      onExpand={handleExpand}
      onEndCall={handleEndCall}
      onToggleMute={handleToggleMute}
      onToggleVideo={handleToggleVideo}
    />
  );
}

function ProtectedLayout() {
  const { isCheckingProfile } = useProfileCheck();
  const {
    incomingCall,
    showIncomingCall,
    answerCall,
    rejectCall,
    handleIncomingCallFromNotification,
  } = useIncomingCalls();

  // ⚡ NEW: Pre-initialize Agora engine for faster calls
  const { isReady: agoraReady } = useOptimizedCallInit();

  useNotificationHandler({
    onIncomingCall: handleIncomingCallFromNotification,
  });

  // ⚡ NEW: Log when Agora is ready
  useEffect(() => {
    if (agoraReady) {
      console.log("⚡ Agora engine pre-initialized - ready for instant calls");
    }
  }, [agoraReady]);

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

      {/* Incoming Call Modal */}
      <IncomingCallModal
        visible={showIncomingCall}
        callData={incomingCall}
        onAnswer={answerCall}
        onReject={rejectCall}
      />

      {/* 🎬 NEW: Picture-in-Picture Overlay */}
      <PiPOverlayManager />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Initialize encryption on app start
    UnifiedEncryptionService.initialize().then(() => {
      const info = UnifiedEncryptionService.getPerformanceInfo();
      console.log("🚀 Encryption initialized:", info);
      // Example output:
      // { platform: 'android', useNative: true, speedMultiplier: 7 }
    });
  }, []);

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
      telemetry={false}
    >
      <NotificationProvider>
        <ThemeProvider>
          <LanguageProvider>
            {/* ⭐ NEW: Wrap with PiPCallProvider */}
            <PiPCallProvider>
              <EncryptionInitProvider>
                <ProtectedLayout />
              </EncryptionInitProvider>
            </PiPCallProvider>
          </LanguageProvider>
        </ThemeProvider>
      </NotificationProvider>
    </ClerkProvider>
  );
}