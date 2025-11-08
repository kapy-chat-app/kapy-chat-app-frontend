// components/page/message/media/VideoPlayer.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

interface VideoPlayerProps {
  videos: any[];
  localUris?: string[];
  isSending: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videos, 
  localUris, 
  isSending 
}) => {
  const [videoLoadErrors, setVideoLoadErrors] = useState<{ [key: string]: boolean }>({});

  // ✅ Debug logging
  useEffect(() => {
    console.log('🎥 [VideoPlayer] Rendering with:', {
      videoCount: videos.length,
      isSending,
      hasLocalUris: !!localUris,
      videos: videos.map((v, idx) => ({
        index: idx,
        fileName: v.file_name,
        hasDecryptedUri: !!v.decryptedUri,
        hasUrl: !!v.url,
        decryptedUriPreview: v.decryptedUri?.substring(0, 60),
      })),
    });
  }, [videos, localUris, isSending]);

  // ✅ FIXED: Get video URI with priority
  const getVideoUri = (attachment: any, index: number): string | null => {
    // 1st priority: decryptedUri
    if (attachment.decryptedUri) {
      console.log(`✅ [VideoPlayer] Using decryptedUri for ${attachment.file_name}`);
      return attachment.decryptedUri;
    }

    // 2nd priority: localUri (while sending)
    if (isSending && localUris && localUris[index]) {
      console.log(`⏳ [VideoPlayer] Using localUri for ${attachment.file_name}`);
      return localUris[index];
    }

    // 3rd priority: server URL
    if (attachment.url) {
      console.warn(`⚠️ [VideoPlayer] Using server URL for ${attachment.file_name}`);
      return attachment.url;
    }

    console.error(`❌ [VideoPlayer] No valid URI for ${attachment.file_name}`);
    return null;
  };

  const handleVideoError = (attachmentId: string, error: any) => {
    console.error(`❌ [VideoPlayer] Video load error for ${attachmentId}:`, error);
    setVideoLoadErrors(prev => ({ ...prev, [attachmentId]: true }));
  };

  return (
    <View>
      {videos.map((att: any, index: number) => {
        const videoUri = getVideoUri(att, index);
        const hasError = videoLoadErrors[att._id] || att.decryption_error;

        return (
          <View key={att._id || index} className="mb-2">
            {/* Error state */}
            {hasError && (
              <View className="w-[250px] h-[200px] rounded-2xl bg-red-100 items-center justify-center">
                <Ionicons name="alert-circle" size={48} color="#ef4444" />
                <Text className="text-red-600 mt-2 text-sm font-medium">
                  {att.decryption_error ? 'Decryption failed' : 'Load failed'}
                </Text>
                <Text className="text-red-500 text-xs mt-1">{att.file_name}</Text>
              </View>
            )}

            {/* Loading state (no URI yet) */}
            {!hasError && !videoUri && (
              <View className="w-[250px] h-[200px] rounded-2xl bg-gray-200 items-center justify-center">
                <ActivityIndicator size="large" color="#f97316" />
                <Text className="text-gray-600 mt-2 text-sm">
                  {isSending ? 'Uploading...' : 'Decrypting...'}
                </Text>
              </View>
            )}

            {/* Sending state with preview */}
            {!hasError && videoUri && isSending && (
              <View className="w-[250px] h-[200px] rounded-2xl bg-gray-800 items-center justify-center">
                <Image 
                  source={{ uri: videoUri }} 
                  className="absolute w-full h-full rounded-2xl" 
                  resizeMode="cover" 
                />
                <View className="absolute inset-0 bg-black/30 items-center justify-center rounded-2xl">
                  <ActivityIndicator size="large" color="white" />
                  <Text className="text-white mt-2 text-sm">Uploading...</Text>
                </View>
              </View>
            )}

            {/* Ready to play */}
            {!hasError && videoUri && !isSending && (
              <Video
                source={{ uri: videoUri }}
                className="w-[250px] h-[200px] rounded-2xl"
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                isLooping={false}
                onError={(error) => handleVideoError(att._id, error)}
                onLoad={() => console.log(`✅ [VideoPlayer] Video loaded: ${att.file_name}`)}
              />
            )}
          </View>
        );
      })}
    </View>
  );
};