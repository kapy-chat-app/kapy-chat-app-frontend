// components/page/message/media/VideoPlayer.tsx
// ✅ FIXED: Added onLongPress support for MessageActionsMenu

import React, { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const GALLERY_WIDTH = 260;

interface VideoPlayerProps {
  videos: any[];
  localUris?: string[];
  isSending: boolean;
  onLongPress?: () => void; // ✅ NEW: Receive onLongPress from parent
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videos, 
  localUris, 
  isSending,
  onLongPress, // ✅ NEW
}) => {
  const [videoLoadStates, setVideoLoadStates] = useState<{ 
    [key: string]: 'loading' | 'ready' | 'error' 
  }>({});

  const getVideoUri = (attachment: any, index: number): string | null => {
    if (attachment.decryptedUri) {
      return attachment.decryptedUri;
    }
    
    if (isSending && localUris && localUris[index]) {
      return localUris[index];
    }
    
    if (attachment.url) {
      return attachment.url;
    }
    
    return null;
  };

  const handleVideoError = (attachmentId: string) => {
    console.error(`❌ Video load error: ${attachmentId}`);
    setVideoLoadStates(prev => ({ ...prev, [attachmentId]: 'error' }));
  };

  const handleVideoLoad = (attachmentId: string, status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      console.log(`✅ Video loaded: ${attachmentId}`);
      setVideoLoadStates(prev => ({ ...prev, [attachmentId]: 'ready' }));
    }
  };

  const handleVideoLoadStart = (attachmentId: string) => {
    setVideoLoadStates(prev => ({ ...prev, [attachmentId]: 'loading' }));
  };

  return (
    <>
      {videos.map((att: any, index: number) => {
        const videoUri = getVideoUri(att, index);
        const loadState = videoLoadStates[att._id] || 'loading';
        const hasError = att.decryption_error || loadState === 'error';

        return (
          <View 
            key={att._id || index} 
            className={index > 0 ? 'mt-1' : ''}
          >
            {/* ❌ Error State */}
            {hasError && (
              <TouchableOpacity
                onLongPress={onLongPress} // ✅ FIXED: Add long press
                delayLongPress={300}
                activeOpacity={0.95}
                style={{ width: GALLERY_WIDTH, height: GALLERY_WIDTH * 0.6 }}
                className="rounded-xl bg-gray-800 items-center justify-center"
              >
                <Ionicons name="videocam-off-outline" size={32} color="#ef4444" />
                <Text className="text-red-400 text-xs mt-2">Failed to load</Text>
              </TouchableOpacity>
            )}

            {/* ⏳ Loading State - No URI yet */}
            {!hasError && !videoUri && (
              <TouchableOpacity
                onLongPress={onLongPress} // ✅ FIXED: Add long press
                delayLongPress={300}
                activeOpacity={0.95}
                style={{ width: GALLERY_WIDTH, height: GALLERY_WIDTH * 0.6 }}
                className="rounded-xl bg-gray-900 items-center justify-center"
              >
                <ActivityIndicator size="small" color="#f97316" />
                <Text className="text-gray-400 text-xs mt-2">
                  {isSending ? 'Encrypting...' : 'Decrypting...'}
                </Text>
              </TouchableOpacity>
            )}

            {/* 📤 Sending State */}
            {!hasError && videoUri && isSending && (
              <TouchableOpacity
                onLongPress={onLongPress} // ✅ FIXED: Add long press
                delayLongPress={300}
                activeOpacity={0.95}
                style={{ width: GALLERY_WIDTH, height: GALLERY_WIDTH * 0.6 }}
                className="rounded-xl bg-black overflow-hidden"
              >
                <Video
                  source={{ uri: videoUri }}
                  style={{ position: 'absolute', width: '100%', height: '100%' }}
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

            {/* ✅ Ready to Play - CLEAN VIDEO WITH LONG PRESS */}
            {!hasError && videoUri && !isSending && (
              <TouchableOpacity
                onLongPress={onLongPress} // ✅ FIXED: Add long press
                delayLongPress={300}
                activeOpacity={0.95}
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
                  onError={() => handleVideoError(att._id)}
                  progressUpdateIntervalMillis={500}
                />
                
                {/* Loading overlay */}
                {loadState === 'loading' && (
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