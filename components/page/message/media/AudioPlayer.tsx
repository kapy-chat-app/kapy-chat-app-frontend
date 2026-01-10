// components/page/message/media/AudioPlayer.tsx
// ✅ UPDATED: Support optimistic messages with local URIs (decryptedUri priority)
// ✅ FIXED: Improved play button colors in dark mode

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const GALLERY_WIDTH = 260;

interface AudioPlayerProps {
  audios: any[];
  isOwnMessage: boolean;
  isSending: boolean;
  isDark: boolean;
  onLongPress?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  audios, 
  isOwnMessage, 
  isSending, 
  isDark,
  onLongPress,
}) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [audioErrors, setAudioErrors] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    return () => {
      if (sound) {
        console.log('🎵 [AudioPlayer] Unloading sound on unmount');
        sound.unloadAsync();
      }
    };
  }, [sound]);

  /**
   * ✅ PRIORITY: decryptedUri (local OR decrypted) > url
   * For optimistic messages: decryptedUri = local file://
   * For encrypted messages: decryptedUri = decrypted file://
   * For regular messages: url = server URL
   */
  const getAudioUri = (attachment: any): string | null => {
    console.log('🎵 [AudioPlayer] getAudioUri:', {
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
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis || 0);
      if (status.didJustFinish) {
        console.log('🎵 [AudioPlayer] Playback finished');
        setIsPlaying(false);
        setPosition(0);
        setCurrentAudioId(null);
      }
    } else if (status.error) {
      console.error('🎵 [AudioPlayer] Playback error:', status.error);
    }
  };

  const playAudio = async (audioId: string, uri: string) => {
    if (isSending || !uri) {
      console.log('🎵 [AudioPlayer] Cannot play - isSending or no URI');
      return;
    }

    console.log('🎵 [AudioPlayer] playAudio called:', {
      audioId,
      uri: uri.substring(0, 60) + '...',
    });

    try {
      setIsLoading(audioId);
      
      // Clear previous errors for this audio
      setAudioErrors(prev => {
        const newMap = new Map(prev);
        newMap.delete(audioId);
        return newMap;
      });

      // If switching to different audio, unload current
      if (sound && currentAudioId !== audioId) {
        console.log('🎵 [AudioPlayer] Unloading previous sound');
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
      }

      // Toggle play/pause for same audio
      if (currentAudioId === audioId && sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (isPlaying) {
            console.log('🎵 [AudioPlayer] Pausing');
            await sound.pauseAsync();
            setIsPlaying(false);
          } else {
            console.log('🎵 [AudioPlayer] Resuming');
            await sound.playAsync();
            setIsPlaying(true);
          }
        }
        setIsLoading(null);
        return;
      }

      // Set audio mode
      console.log('🎵 [AudioPlayer] Setting audio mode');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      // Create and play new sound
      console.log('🎵 [AudioPlayer] Creating new sound from:', uri);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 100 },
        onPlaybackStatusUpdate
      );

      console.log('🎵 [AudioPlayer] Sound created successfully');
      setSound(newSound);
      setCurrentAudioId(audioId);
      setIsPlaying(true);
      setIsLoading(null);

    } catch (error: any) {
      console.error('🎵 [AudioPlayer] Error playing audio:', error);
      setIsLoading(null);
      
      // Store error for this audio
      setAudioErrors(prev => {
        const newMap = new Map(prev);
        newMap.set(audioId, error.message || 'Cannot play audio');
        return newMap;
      });
      
      Alert.alert('Error', `Cannot play audio: ${error.message || 'Unknown error'}`);
    }
  };

  return (
    <View>
      {audios.map((att: any, index: number) => {
        const audioUri = getAudioUri(att);
        const isThisPlaying = currentAudioId === att._id && isPlaying;
        const isThisLoading = isLoading === att._id;
        const progress = currentAudioId === att._id ? position : 0;
        const audioDuration = currentAudioId === att._id ? duration : 0;
        const hasError = att.decryption_error || audioErrors.get(att._id);
        const progressPercent = audioDuration > 0 ? (progress / audioDuration) : 0;

        return (
          <TouchableOpacity
            key={att._id || index} 
            style={{ width: GALLERY_WIDTH }}
            onLongPress={onLongPress}
            delayLongPress={300}
            activeOpacity={0.8}
            className={`flex-row items-center p-3 rounded-2xl ${index > 0 ? 'mt-1' : ''} ${
              isOwnMessage 
                ? 'bg-orange-500' 
                : isDark 
                  ? 'bg-gray-700' 
                  : 'bg-gray-100'
            } ${(isSending || isThisLoading) && 'opacity-60'}`}
          >
            {/* ✅ FIXED: Improved play button colors */}
            <TouchableOpacity
              onPress={() => audioUri && !isSending && playAudio(att._id, audioUri)}
              disabled={isSending || !audioUri || !!hasError || isThisLoading}
              className={`w-10 h-10 rounded-full items-center justify-center ${
                isOwnMessage 
                  ? 'bg-white/20' 
                  : isDark
                    ? hasError 
                      ? 'bg-red-500/20'
                      : 'bg-orange-500/20'
                    : hasError 
                      ? 'bg-red-100' 
                      : 'bg-orange-100'
              }`}
            >
              {isSending || isThisLoading ? (
                <ActivityIndicator 
                  size="small" 
                  color={isOwnMessage ? 'white' : isDark ? '#f97316' : '#f97316'} 
                />
              ) : !audioUri ? (
                <ActivityIndicator 
                  size="small" 
                  color={isOwnMessage ? 'white' : isDark ? '#f97316' : '#f97316'} 
                />
              ) : hasError ? (
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
              ) : (
                <Ionicons 
                  name={isThisPlaying ? 'pause' : 'play'} 
                  size={18} 
                  color={isOwnMessage ? 'white' : isDark ? '#f97316' : '#f97316'} 
                />
              )}
            </TouchableOpacity>

            {/* Waveform visualization */}
            <View className="flex-1 ml-3">
              <View className="flex-row items-center h-6 gap-[2px]">
                {[...Array(32)].map((_, i) => {
                  const heights = [8, 14, 10, 18, 12, 16, 9, 20, 14, 11, 13, 17, 10, 15, 12, 19];
                  const height = heights[i % heights.length];
                  const isActive = progressPercent >= ((i + 1) / 32);
                  
                  return (
                    <View
                      key={i}
                      className="w-[3px] rounded-full"
                      style={{
                        height,
                        backgroundColor: isActive 
                          ? (isOwnMessage ? 'white' : '#f97316') 
                          : (isOwnMessage 
                              ? 'rgba(255,255,255,0.3)' 
                              : isDark 
                                ? 'rgba(249,115,22,0.2)' 
                                : 'rgba(0,0,0,0.12)'
                            ),
                      }}
                    />
                  );
                })}
              </View>

              {/* Time display */}
              <View className="flex-row justify-between mt-1">
                <Text className={`text-[10px] ${
                  isOwnMessage 
                    ? 'text-white/70' 
                    : isDark 
                      ? 'text-gray-300'
                      : 'text-gray-500'
                }`}>
                  {isSending 
                    ? 'Sending...' 
                    : isThisLoading
                      ? 'Loading...'
                      : !audioUri 
                        ? 'Decrypting...'
                        : hasError
                          ? 'Failed'
                          : formatTime(progress)
                  }
                </Text>
                {!isSending && !isThisLoading && audioUri && !hasError && audioDuration > 0 && (
                  <Text className={`text-[10px] ${
                    isOwnMessage 
                      ? 'text-white/70' 
                      : isDark 
                        ? 'text-gray-300'
                        : 'text-gray-500'
                  }`}>
                    {formatTime(audioDuration)}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};