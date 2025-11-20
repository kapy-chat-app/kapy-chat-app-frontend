// components/page/message/media/AudioPlayer.tsx
// Redesigned with cleaner minimal waveform style

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';

const GALLERY_WIDTH = 260;

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

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync();
    };
  }, [sound]);

  const getAudioUri = (attachment: any): string | null => {
    if (attachment.decryptedUri) return attachment.decryptedUri;
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
    } catch (error) {
      Alert.alert('Error', 'Cannot play audio');
    }
  };

  return (
    <View>
      {audios.map((att: any, index: number) => {
        const audioUri = getAudioUri(att);
        const isThisPlaying = currentAudioId === att._id && isPlaying;
        const progress = currentAudioId === att._id ? position : 0;
        const audioDuration = currentAudioId === att._id ? duration : 0;
        const hasError = att.decryption_error;
        const progressPercent = audioDuration > 0 ? (progress / audioDuration) : 0;

        return (
          <View 
            key={att._id || index} 
            style={{ width: GALLERY_WIDTH }}
            className={`flex-row items-center p-3 ${index > 0 ? 'mt-1' : ''} ${
              (isSending || !audioUri) && 'opacity-60'
            }`}
          >
            {/* Play button */}
            <TouchableOpacity
              onPress={() => audioUri && !isSending && playAudio(att._id, audioUri)}
              disabled={isSending || !audioUri || hasError}
              className={`w-10 h-10 rounded-full items-center justify-center ${
                isOwnMessage 
                  ? 'bg-white/25' 
                  : hasError 
                  ? 'bg-red-100' 
                  : 'bg-orange-100'
              }`}
            >
              {isSending || !audioUri ? (
                <ActivityIndicator size="small" color={isOwnMessage ? 'white' : '#f97316'} />
              ) : hasError ? (
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
              ) : (
                <Ionicons 
                  name={isThisPlaying ? 'pause' : 'play'} 
                  size={18} 
                  color={isOwnMessage ? 'white' : '#f97316'} 
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
                          : (isOwnMessage ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.12)'),
                      }}
                    />
                  );
                })}
              </View>

              {/* Time display */}
              <View className="flex-row justify-between mt-1">
                <Text className={`text-[10px] ${
                  isOwnMessage ? 'text-white/70' : 'text-gray-500'
                }`}>
                  {isSending 
                    ? 'Sending...' 
                    : !audioUri 
                    ? 'Loading...'
                    : hasError
                    ? 'Failed'
                    : formatTime(progress)
                  }
                </Text>
                {!isSending && audioUri && !hasError && audioDuration > 0 && (
                  <Text className={`text-[10px] ${
                    isOwnMessage ? 'text-white/70' : 'text-gray-500'
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