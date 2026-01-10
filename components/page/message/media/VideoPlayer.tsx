// components/page/message/media/VideoPlayer.tsx
// ✅ UPDATED: Support optimistic messages with local URIs (decryptedUri priority)

import { Ionicons } from "@expo/vector-icons";
import { AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

const GALLERY_WIDTH = 260;

interface VideoPlayerProps {
  videos: any[];
  isSending: boolean;
  onLongPress?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videos,
  isSending,
  onLongPress,
}) => {
  const [videoLoadStates, setVideoLoadStates] = useState<{
    [key: string]: "loading" | "ready" | "error";
  }>({});
  
  const [validatedUris, setValidatedUris] = useState<{
    [key: string]: { uri: string | null; valid: boolean; checked: boolean };
  }>({});

  /**
   * ✅ PRIORITY: decryptedUri (local OR decrypted) > url
   * For optimistic messages: decryptedUri = local file://
   * For encrypted messages: decryptedUri = decrypted file://
   * For regular messages: url = server URL
   */
  const getVideoUri = useCallback((attachment: any): string | null => {
    console.log('🎥 [VIDEO] getVideoUri:', {
      id: attachment._id,
      hasDecryptedUri: !!attachment.decryptedUri,
      hasUrl: !!attachment.url,
      decryptedUriType: attachment.decryptedUri?.substring(0, 10),
    });
    
    // Priority 1: decryptedUri (for both optimistic and decrypted)
    if (attachment.decryptedUri) return attachment.decryptedUri;
    
    // Priority 2: url (for non-encrypted server files)
    if (attachment.url) return attachment.url;
    
    return null;
  }, []);

  /**
   * ✅ CRITICAL: Validate file URI before rendering
   */
  const validateVideoUri = useCallback(async (
    attachmentId: string,
    uri: string | null
  ): Promise<{ uri: string | null; valid: boolean }> => {
    if (!uri) {
      console.warn(`⚠️ [VIDEO] Missing URI for ${attachmentId}`);
      return { uri: null, valid: false };
    }

    // ✅ Validate URI format
    if (uri.startsWith('file://')) {
      // Check minimum length
      if (uri.length < 20) {
        console.warn(`⚠️ [VIDEO] URI too short: ${uri}`);
        return { uri: null, valid: false };
      }

      // ✅ CRITICAL: Verify file exists
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        
        if (!fileInfo.exists) {
          console.error(`❌ [VIDEO] File not found: ${uri}`);
          return { uri: null, valid: false };
        }

        const fileSize = (fileInfo as any).size || 0;
        
        if (fileSize === 0) {
          console.error(`❌ [VIDEO] File is empty: ${uri}`);
          return { uri: null, valid: false };
        }

        console.log(`✅ [VIDEO] Valid file: ${attachmentId}`, {
          uri: uri.substring(0, 50),
          size: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
        });

        return { uri, valid: true };
      } catch (error) {
        console.error(`❌ [VIDEO] Failed to validate file: ${uri}`, error);
        return { uri: null, valid: false };
      }
    } else if (uri.startsWith('data:')) {
      // Data URI validation
      if (uri.length < 100) {
        console.warn(`⚠️ [VIDEO] Data URI too short: ${uri.substring(0, 50)}`);
        return { uri: null, valid: false };
      }

      console.log(`✅ [VIDEO] Valid data URI: ${attachmentId}`);
      return { uri, valid: true };
    } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
      // HTTP URI validation
      console.log(`✅ [VIDEO] Valid HTTP URI: ${attachmentId}`);
      return { uri, valid: true };
    } else {
      console.warn(`⚠️ [VIDEO] Unknown URI format: ${uri.substring(0, 50)}`);
      return { uri: null, valid: false };
    }
  }, []);

  /**
   * ✅ Validate URIs on mount and when they change
   */
  useEffect(() => {
    const validateAllUris = async () => {
      const newValidatedUris: typeof validatedUris = {};

      for (let i = 0; i < videos.length; i++) {
        const att = videos[i];
        const uri = getVideoUri(att);
        
        if (uri) {
          const validation = await validateVideoUri(att._id, uri);
          newValidatedUris[att._id] = {
            ...validation,
            checked: true,
          };
        } else {
          newValidatedUris[att._id] = {
            uri: null,
            valid: false,
            checked: true,
          };
        }
      }

      setValidatedUris(newValidatedUris);
    };

    validateAllUris();
  }, [videos, validateVideoUri, getVideoUri]);

  const handleVideoError = useCallback((attachmentId: string, error?: any) => {
    console.error(`❌ [VIDEO] Load error: ${attachmentId}`, error);
    
    const att = videos.find(v => v._id === attachmentId);
    if (att) {
      const validation = validatedUris[attachmentId];
      console.error(`   URI: ${validation?.uri || 'N/A'}`);
      console.error(`   Valid: ${validation?.valid}`);
    }
    
    setVideoLoadStates((prev) => ({ ...prev, [attachmentId]: "error" }));
  }, [videos, validatedUris]);

  const handleVideoLoad = useCallback((attachmentId: string, status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      console.log(`✅ [VIDEO] Loaded successfully: ${attachmentId}`);
      setVideoLoadStates((prev) => ({ ...prev, [attachmentId]: "ready" }));
    }
  }, []);

  const handleVideoLoadStart = useCallback((attachmentId: string) => {
    console.log(`⏳ [VIDEO] Load started: ${attachmentId}`);
    setVideoLoadStates((prev) => ({ ...prev, [attachmentId]: "loading" }));
  }, []);

  return (
    <>
      {videos.map((att: any, index: number) => {
        const validation = validatedUris[att._id];
        const videoUri = validation?.uri;
        const isValidUri = validation?.valid;
        const isChecked = validation?.checked;
        
        const loadState = videoLoadStates[att._id] || "loading";
        const hasError = att.decryption_error || loadState === "error" || (isChecked && !isValidUri);

        return (
          <View key={att._id || index} className={index > 0 ? "mt-1" : ""}>
            {/* ❌ Error State */}
            {hasError && (
              <TouchableOpacity
                onLongPress={onLongPress}
                delayLongPress={300}
                activeOpacity={0.95}
                style={{ width: GALLERY_WIDTH, height: GALLERY_WIDTH * 0.6 }}
                className="rounded-xl bg-gray-800 items-center justify-center"
              >
                <Ionicons
                  name="videocam-off-outline"
                  size={32}
                  color="#ef4444"
                />
                <Text className="text-red-400 text-xs mt-2">
                  {att.decryption_error ? "Decryption failed" : "Failed to load"}
                </Text>
              </TouchableOpacity>
            )}

            {/* ⏳ Loading State - Validation in progress or no URI yet */}
            {!hasError && (!isChecked || !videoUri) && (
              <TouchableOpacity
                onLongPress={onLongPress}
                delayLongPress={300}
                activeOpacity={0.95}
                style={{ width: GALLERY_WIDTH, height: GALLERY_WIDTH * 0.6 }}
                className="rounded-xl bg-gray-900 items-center justify-center"
              >
                <ActivityIndicator size="small" color="#f97316" />
                <Text className="text-gray-400 text-xs mt-2">
                  {!isChecked ? "Validating..." : 
                   isSending ? "Encrypting..." : "Loading..."}
                </Text>
              </TouchableOpacity>
            )}

            {/* 📤 Sending State */}
            {!hasError && videoUri && isValidUri && isSending && (
              <TouchableOpacity
                onLongPress={onLongPress}
                delayLongPress={300}
                activeOpacity={0.95}
                style={{ width: GALLERY_WIDTH, height: GALLERY_WIDTH * 0.6 }}
                className="rounded-xl bg-black overflow-hidden"
              >
                <Video
                  source={{ uri: videoUri }}
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                  }}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                  isMuted={true}
                />
                <View className="absolute inset-0 bg-black/40 items-center justify-center">
                  <ActivityIndicator size="small" color="white" />
                  <Text className="text-white text-xs mt-2">Sending...</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* ✅ Ready to Play - VALIDATED VIDEO WITH LONG PRESS */}
            {!hasError && videoUri && isValidUri && !isSending && (
              <TouchableOpacity
                onLongPress={onLongPress}
                delayLongPress={300}
                activeOpacity={0.95}
                style={{ width: GALLERY_WIDTH, height: GALLERY_WIDTH * 0.6 }}
                className="rounded-xl overflow-hidden bg-black"
              >
                <Video
                  source={{ uri: videoUri }}
                  style={{ width: "100%", height: "100%" }}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping={false}
                  shouldPlay={false}
                  onLoadStart={() => handleVideoLoadStart(att._id)}
                  onLoad={(status) => handleVideoLoad(att._id, status)}
                  onError={(error) => handleVideoError(att._id, error)}
                  progressUpdateIntervalMillis={500}
                />

                {/* Loading overlay */}
                {loadState === "loading" && (
                  <View className="absolute inset-0 bg-black/60 items-center justify-center">
                    <ActivityIndicator size="small" color="white" />
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </>
  );
};