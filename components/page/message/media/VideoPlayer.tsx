// components/page/message/media/VideoPlayer.tsx
// FIXED: Better handling of data URIs for encrypted videos

import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Image, Text, View, Dimensions } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const GALLERY_WIDTH = 260;

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
  const [videoLoadStates, setVideoLoadStates] = useState<{ [key: string]: 'loading' | 'ready' | 'error' }>({});

  const getVideoUri = (attachment: any, index: number): string | null => {
    // Priority: decryptedUri > localUri (when sending) > url
    if (attachment.decryptedUri) {
      console.log(`🎬 Video ${index}: Using decryptedUri`);
      console.log(`   URI type: ${attachment.decryptedUri.substring(0, 50)}...`);
      console.log(`   Is data URI: ${attachment.decryptedUri.startsWith('data:')}`);
      return attachment.decryptedUri;
    }
    
    if (isSending && localUris && localUris[index]) {
      console.log(`🎬 Video ${index}: Using localUri (sending)`);
      return localUris[index];
    }
    
    if (attachment.url) {
      console.log(`🎬 Video ${index}: Using server URL`);
      return attachment.url;
    }
    
    console.log(`⚠️ Video ${index}: No URI available`);
    return null;
  };

  const handleVideoError = (attachmentId: string, error: any) => {
    console.error(`❌ Video load error for ${attachmentId}:`, error);
    setVideoLoadErrors(prev => ({ ...prev, [attachmentId]: true }));
    setVideoLoadStates(prev => ({ ...prev, [attachmentId]: 'error' }));
  };

  const handleVideoLoad = (attachmentId: string, status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      console.log(`✅ Video loaded successfully: ${attachmentId}`);
      console.log(`   Duration: ${status.durationMillis}ms`);
      setVideoLoadStates(prev => ({ ...prev, [attachmentId]: 'ready' }));
    }
  };

  const handleVideoLoadStart = (attachmentId: string) => {
    console.log(`🔄 Video loading started: ${attachmentId}`);
    setVideoLoadStates(prev => ({ ...prev, [attachmentId]: 'loading' }));
  };

  return (
    <View>
      {videos.map((att: any, index: number) => {
        const videoUri = getVideoUri(att, index);
        const hasError = videoLoadErrors[att._id] || att.decryption_error;
        const loadState = videoLoadStates[att._id] || 'loading';

        // Log attachment info for debugging
        useEffect(() => {
          console.log(`📹 Video attachment ${index}:`, {
            id: att._id,
            file_name: att.file_name,
            file_type: att.file_type,
            is_encrypted: att.is_encrypted,
            has_decryptedUri: !!att.decryptedUri,
            decryption_error: att.decryption_error,
          });
        }, [att]);

        return (
          <View 
            key={att._id || index} 
            className={index > 0 ? 'mt-1' : ''}
          >
            {/* Error state */}
            {hasError && (
              <View 
                style={{ width: GALLERY_WIDTH, height: GALLERY_WIDTH * 0.6 }}
                className="rounded-xl bg-gray-100 items-center justify-center"
              >
                <Ionicons name="videocam-off-outline" size={32} color="#d1d5db" />
                <Text className="text-gray-400 text-xs mt-2">Failed to load video</Text>
                {att.decryption_error && (
                  <Text className="text-red-400 text-xs mt-1">Decryption failed</Text>
                )}
              </View>
            )}

            {/* Loading state - No URI yet */}
            {!hasError && !videoUri && (
              <View 
                style={{ width: GALLERY_WIDTH, height: GALLERY_WIDTH * 0.6 }}
                className="rounded-xl bg-gray-100 items-center justify-center"
              >
                <ActivityIndicator size="small" color="#f97316" />
                <Text className="text-gray-400 text-xs mt-2">
                  {isSending ? 'Encrypting...' : 'Decrypting...'}
                </Text>
              </View>
            )}

            {/* Sending state with preview */}
            {!hasError && videoUri && isSending && (
              <View 
                style={{ width: GALLERY_WIDTH, height: GALLERY_WIDTH * 0.6 }}
                className="rounded-xl bg-gray-900 overflow-hidden"
              >
                {/* Try to show first frame as preview */}
                <Video
                  source={{ uri: videoUri }}
                  style={{ position: 'absolute', width: '100%', height: '100%' }}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                  isMuted={true}
                />
                <View className="absolute inset-0 bg-black/40 items-center justify-center">
                  <View className="bg-black/60 rounded-full p-3">
                    <ActivityIndicator size="small" color="white" />
                  </View>
                  <Text className="text-white text-xs mt-2">Sending...</Text>
                </View>
              </View>
            )}

            {/* Ready to play - Decrypted video */}
            {!hasError && videoUri && !isSending && (
              <View 
                style={{ width: GALLERY_WIDTH, height: GALLERY_WIDTH * 0.6 }}
                className="rounded-xl overflow-hidden bg-black"
              >
                <Video
                  source={{ uri: videoUri }}
                  style={{ width: '100%', height: '100%' }}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping={false}
                  shouldPlay={false}
                  onLoadStart={() => handleVideoLoadStart(att._id)}
                  onLoad={(status) => handleVideoLoad(att._id, status)}
                  onError={(error) => handleVideoError(att._id, error)}
                  // Important for data URIs
                  progressUpdateIntervalMillis={500}
                />
                
                {/* Loading overlay while video is loading */}
                {loadState === 'loading' && (
                  <View className="absolute inset-0 bg-black/30 items-center justify-center">
                    <ActivityIndicator size="small" color="white" />
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};