// components/page/message/media/AudioPlayer.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import Slider from '@react-native-community/slider';

interface AudioPlayerProps {
  audios: any[];
  isOwnMessage: boolean;
  isSending: boolean;
  isDark: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  audios, 
  isOwnMessage, 
  isSending, 
  isDark 
}) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);

  // ✅ Debug logging
  useEffect(() => {
    console.log('🔊 [AudioPlayer] Rendering with:', {
      audioCount: audios.length,
      isSending,
      audios: audios.map((a, idx) => ({
        index: idx,
        fileName: a.file_name,
        hasDecryptedUri: !!a.decryptedUri,
        hasUrl: !!a.url,
        decryptionError: a.decryption_error,
      })),
    });
  }, [audios, isSending]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // ✅ FIXED: Get audio URI with priority
  const getAudioUri = (attachment: any): string | null => {
    // 1st priority: decryptedUri
    if (attachment.decryptedUri) {
      console.log(`✅ [AudioPlayer] Using decryptedUri for ${attachment.file_name}`);
      return attachment.decryptedUri;
    }

    // 2nd priority: server URL
    if (attachment.url) {
      console.warn(`⚠️ [AudioPlayer] Using server URL for ${attachment.file_name}`);
      return attachment.url;
    }

    console.error(`❌ [AudioPlayer] No valid URI for ${attachment.file_name}`);
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
        setIsPlaying(false);
        setPosition(0);
        setCurrentAudioId(null);
      }
    }
  };

  const playAudio = async (audioId: string, uri: string) => {
    if (isSending || !uri) return;

    try {
      if (sound && currentAudioId !== audioId) {
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
      }

      if (currentAudioId === audioId && sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (isPlaying) {
            await sound.pauseAsync();
            setIsPlaying(false);
          } else {
            await sound.playAsync();
            setIsPlaying(true);
          }
        }
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 100 },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setCurrentAudioId(audioId);
      setIsPlaying(true);
      console.log(`✅ [AudioPlayer] Playing audio: ${audioId}`);
    } catch (error) {
      console.error('❌ [AudioPlayer] Error playing audio:', error);
      Alert.alert('Error', 'Cannot play audio');
    }
  };

  const onSliderValueChange = async (value: number) => {
    if (sound) {
      await sound.setPositionAsync(value);
    }
  };

  return (
    <View className="py-2">
      {audios.map((att: any, index: number) => {
        const audioUri = getAudioUri(att);
        const isThisPlaying = currentAudioId === att._id && isPlaying;
        const progress = currentAudioId === att._id ? position : 0;
        const audioDuration = currentAudioId === att._id ? duration : 0;
        const hasError = att.decryption_error;

        return (
          <View 
            key={att._id || index} 
            className={`flex-row items-center px-3 py-2.5 min-h-[56px] w-[280px] ${
              (isSending || !audioUri) && 'opacity-60'
            }`}
          >
            <TouchableOpacity
              onPress={() => audioUri && !isSending && playAudio(att._id, audioUri)}
              disabled={isSending || !audioUri || hasError}
              className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${
                isOwnMessage ? 'bg-white/30' : hasError ? 'bg-red-500' : 'bg-orange-500'
              }`}
            >
              {isSending || !audioUri ? (
                <ActivityIndicator size="small" color="white" />
              ) : hasError ? (
                <Ionicons name="alert-circle" size={20} color="white" />
              ) : (
                <Ionicons name={isThisPlaying ? 'pause' : 'play'} size={20} color="white" />
              )}
            </TouchableOpacity>

            <View className="flex-1 relative">
              <View className="flex-row items-center h-8 gap-0.5">
                {[...Array(40)].map((_, i) => {
                  const heights = [12, 20, 16, 24, 18, 22, 14, 26, 20, 16, 18, 24, 15, 22, 19, 25, 17, 21, 16, 23];
                  const height = heights[i % heights.length];
                  const progressPercent = audioDuration > 0 ? (progress / audioDuration) : 0;
                  const isActive = progressPercent >= (i / 40);
                  
                  return (
                    <View
                      key={i}
                      className="w-[3px] rounded-full"
                      style={{
                        height,
                        backgroundColor: isActive 
                          ? (isOwnMessage ? 'white' : '#f97316') 
                          : (isOwnMessage ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)'),
                        opacity: (isSending || !audioUri) ? 0.5 : (isActive ? 1 : 0.5),
                      }}
                    />
                  );
                })}
              </View>

              {!isSending && audioUri && !hasError && (
                <Slider
                  style={{ position: 'absolute', width: '100%', height: 40, top: -4 }}
                  minimumValue={0}
                  maximumValue={audioDuration || 1}
                  value={progress}
                  onSlidingComplete={onSliderValueChange}
                  minimumTrackTintColor="transparent"
                  maximumTrackTintColor="transparent"
                  thumbTintColor="transparent"
                />
              )}

              <View className="flex-row justify-between mt-1">
                <Text className={`text-[11px] font-medium ${
                  isOwnMessage ? 'text-white/80' : 'text-gray-600'
                }`}>
                  {isSending 
                    ? 'Uploading...' 
                    : !audioUri 
                    ? 'Decrypting...'
                    : hasError
                    ? 'Failed'
                    : formatTime(progress || 0)
                  }
                </Text>
                {!isSending && audioUri && !hasError && audioDuration > 0 && (
                  <Text className={`text-[11px] font-medium ${
                    isOwnMessage ? 'text-white/80' : 'text-gray-600'
                  }`}>
                    {formatTime(audioDuration)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};