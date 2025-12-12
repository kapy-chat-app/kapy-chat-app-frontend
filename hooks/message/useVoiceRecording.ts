// hooks/useVoiceRecording.ts
import { useState, useRef } from 'react';
import { Audio } from 'expo-av';
import { Platform, Alert } from 'react-native';

export interface VoiceRecording {
  uri: string;
  duration: number;
  size: number;
}

export interface PlaybackStatus {
  isPlaying: boolean;
  position: number;
  duration: number;
}

interface UseVoiceRecordingReturn {
  // Recording states
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  error: string | null;
  
  // Recording controls
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<VoiceRecording | null>;
  pauseRecording: () => Promise<boolean>;
  resumeRecording: () => Promise<boolean>;
  cancelRecording: () => Promise<boolean>;
  
  // Playback states
  isPlaying: boolean;
  playbackPosition: number;
  playbackDuration: number;
  
  // Playback controls
  playRecording: (uri: string) => Promise<boolean>;
  pausePlayback: () => Promise<boolean>;
  stopPlayback: () => Promise<boolean>;
  seekPlayback: (position: number) => Promise<boolean>;
  
  // Utilities
  clearError: () => void;
  formatDuration: (milliseconds: number) => string;
}

export const useVoiceRecording = (): UseVoiceRecordingReturn => {
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  
  // Refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearError = () => setError(null);

  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const requestAudioPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      
      if (status !== 'granted') {
        setError('Permission to access microphone is required');
        Alert.alert(
          'Permission Required',
          'Please grant microphone permission in Settings to record voice messages.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      return true;
    } catch (err) {
      setError('Failed to request microphone permission');
      return false;
    }
  };

  const startRecording = async (): Promise<boolean> => {
    try {
      setError(null);
      
      // Request permissions
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) return false;

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      });

      // Create recording
      const recording = new Audio.Recording();
      recordingRef.current = recording;

      // Recording options
      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      };

      await recording.prepareToRecordAsync(recordingOptions);
      await recording.startAsync();

      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 100);
      }, 100);

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      console.error('Recording start error:', err);
      return false;
    }
  };

  const stopRecording = async (): Promise<VoiceRecording | null> => {
    try {
      if (!recordingRef.current || !isRecording) {
        return null;
      }

      setIsRecording(false);
      setIsPaused(false);

      // Clear timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      if (!uri) {
        throw new Error('Recording failed - no URI');
      }

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      // Get file size (approximate)
      const fileSize = Math.round(duration * 16); // Rough estimation based on bitrate

      const voiceRecording: VoiceRecording = {
        uri,
        duration: Math.round(duration / 1000), // Convert to seconds
        size: fileSize,
      };

      recordingRef.current = null;
      setDuration(0);

      return voiceRecording;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop recording';
      setError(errorMessage);
      console.error('Recording stop error:', err);
      return null;
    }
  };

  const pauseRecording = async (): Promise<boolean> => {
    try {
      if (!recordingRef.current || !isRecording || isPaused) {
        return false;
      }

      await recordingRef.current.pauseAsync();
      setIsPaused(true);

      // Pause timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pause recording';
      setError(errorMessage);
      console.error('Recording pause error:', err);
      return false;
    }
  };

  const resumeRecording = async (): Promise<boolean> => {
    try {
      if (!recordingRef.current || !isRecording || !isPaused) {
        return false;
      }

      await recordingRef.current.startAsync();
      setIsPaused(false);

      // Resume timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 100);
      }, 100);

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resume recording';
      setError(errorMessage);
      console.error('Recording resume error:', err);
      return false;
    }
  };

  const cancelRecording = async (): Promise<boolean> => {
    try {
      if (!recordingRef.current) {
        return true;
      }

      setIsRecording(false);
      setIsPaused(false);
      setDuration(0);

      // Clear timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel recording';
      setError(errorMessage);
      console.error('Recording cancel error:', err);
      return false;
    }
  };

  const playRecording = async (uri: string): Promise<boolean> => {
    try {
      setError(null);
      
      // Stop current playback if any
      await stopPlayback();

      // Create and load sound
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, isLooping: false }
      );

      soundRef.current = sound;

      // Get duration
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        setPlaybackDuration(status.durationMillis);
      }

      // Set up playback status update
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPlaybackPosition(status.positionMillis || 0);
          
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPlaybackPosition(0);
            // Clean up
            sound.unloadAsync();
            soundRef.current = null;
            if (playbackIntervalRef.current) {
              clearInterval(playbackIntervalRef.current);
              playbackIntervalRef.current = null;
            }
          }
        }
      });

      // Start playing
      await sound.playAsync();
      setIsPlaying(true);

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to play recording';
      setError(errorMessage);
      console.error('Playback start error:', err);
      return false;
    }
  };

  const pausePlayback = async (): Promise<boolean> => {
    try {
      if (!soundRef.current) return false;

      await soundRef.current.pauseAsync();
      setIsPlaying(false);

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pause playback';
      setError(errorMessage);
      console.error('Playback pause error:', err);
      return false;
    }
  };

  const stopPlayback = async (): Promise<boolean> => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      setIsPlaying(false);
      setPlaybackPosition(0);
      setPlaybackDuration(0);

      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop playback';
      setError(errorMessage);
      console.error('Playback stop error:', err);
      return false;
    }
  };

  const seekPlayback = async (position: number): Promise<boolean> => {
    try {
      if (!soundRef.current) return false;

      await soundRef.current.setPositionAsync(position);
      setPlaybackPosition(position);

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to seek playback';
      setError(errorMessage);
      console.error('Playback seek error:', err);
      return false;
    }
  };

  return {
    // Recording states
    isRecording,
    isPaused,
    duration: Math.round(duration / 1000), // Return in seconds
    error,
    
    // Recording controls
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    
    // Playback states
    isPlaying,
    playbackPosition,
    playbackDuration,
    
    // Playback controls
    playRecording,
    pausePlayback,
    stopPlayback,
    seekPlayback,
    
    // Utilities
    clearError,
    formatDuration,
  };
};