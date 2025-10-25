// hooks/call/useCallRecording.ts - FIXED with legacy API
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
// ⭐ FIX: Import from legacy API
import * as FileSystem from "expo-file-system/legacy";
import { ConnectionStateType, IRtcEngine } from "react-native-agora";

interface RecordingState {
  isRecording: boolean;
  recordingDuration: number;
  audioUri: string | null;
  videoUri: string | null;
}

interface UseCallRecordingOptions {
  callId: string;
  userId: string;
  callType: "audio" | "video";
  onRecordingComplete?: (data: {
    audioUri: string | null;
    videoUri: string | null;
    duration: number;
  }) => void;
  onError?: (error: Error) => void;
}

/**
 * Get the best available directory for file storage
 */
const getStorageDirectory = (): string => {
  // Try different directories in order of preference
  const directories = [FileSystem.documentDirectory, FileSystem.cacheDirectory];

  console.log("📁 Checking available directories:");
  console.log("  - documentDirectory:", FileSystem.documentDirectory);
  console.log("  - cacheDirectory:", FileSystem.cacheDirectory);

  for (const dir of directories) {
    if (dir) {
      console.log("✅ Using directory:", dir);
      return dir;
    }
  }

  // Fallback: construct path manually based on platform
  if (Platform.OS === "ios") {
    return "file:///var/mobile/Containers/Data/Application/";
  } else {
    // Android fallback
    return "file:///data/user/0/";
  }
};

export const useCallRecording = ({
  callId,
  userId,
  callType,
  onRecordingComplete,
  onError,
}: UseCallRecordingOptions) => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    recordingDuration: 0,
    audioUri: null,
    videoUri: null,
  });

  const recordingStartTime = useRef<number>(0);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const recordingFilePath = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true); // ⭐ FIX: Track mount status

  /**
   * Start recording using Agora's audio mixing
   * @param agoraEngine - Pass the engine instance when calling this function
   */
  const startRecording = useCallback(
    async (agoraEngine: IRtcEngine | null) => {
      try {
        console.log("🎬 Starting call recording with Agora audio mixing...");

        // Validation 1: Check engine
        if (!agoraEngine) {
          throw new Error("Agora engine is null - not initialized yet");
        }

        // Validation 2: Check connection state
        try {
          const connectionState = await agoraEngine.getConnectionState();
          console.log("🔗 Connection state:", connectionState);

          if (
            connectionState !== ConnectionStateType.ConnectionStateConnected
          ) {
            console.warn(
              `⚠️ Not fully connected yet. State: ${connectionState}`
            );
            // Don't throw - continue anyway as some versions might not support this check
          }
        } catch (err) {
          console.warn("⚠️ Could not check connection state:", err);
          // Continue anyway
        }

        // Validation 3: Get storage directory
        const directory = getStorageDirectory();

        console.log("📁 Using storage directory:", directory);

        // Generate unique recording file path
        const timestamp = Date.now();
        const fileName = `call_recording_${callId}_${userId}_${timestamp}.wav`;

        // CRITICAL FIX: For Agora, use absolute path without file:// prefix
        let filePath: string;

        if (Platform.OS === "ios") {
          // iOS: Remove file:// and use clean path
          filePath = directory.replace("file://", "") + fileName;
        } else {
          // Android: Use directory as-is
          filePath = directory.replace("file://", "") + fileName;
        }

        recordingFilePath.current = directory + fileName; // Keep original for FileSystem operations

        console.log("📁 Recording file path for Agora:", filePath);
        console.log(
          "📁 Recording file path for FileSystem:",
          recordingFilePath.current
        );

        // Start audio recording using Agora's startAudioRecording
        const recordingConfig = {
          filePath: filePath, // Clean path without file://
          sampleRate: 32000,
          quality: 2, // AUDIO_RECORDING_QUALITY_HIGH
          recordingChannel: 1, // Mono
        };

        console.log(
          "🔧 Starting Agora audio recording with config:",
          recordingConfig
        );

        try {
          await agoraEngine.startAudioRecording(recordingConfig);
          console.log("✅ Agora startAudioRecording called successfully");
        } catch (agoraError) {
          console.error("❌ Agora startAudioRecording failed:", agoraError);
          throw new Error(`Agora recording failed: ${agoraError}`);
        }

        recordingStartTime.current = Date.now();

        // Start duration counter
        durationInterval.current = setInterval(() => {
          if (!isMountedRef.current) {
            // ⭐ FIX: Stop interval if unmounted
            if (durationInterval.current) {
              clearInterval(durationInterval.current);
              durationInterval.current = null;
            }
            return;
          }

          const duration = Math.floor(
            (Date.now() - recordingStartTime.current) / 1000
          );
          setRecordingState((prev) => ({
            ...prev,
            recordingDuration: duration,
          }));
        }, 1000);

        if (isMountedRef.current) {
          setRecordingState((prev) => ({
            ...prev,
            isRecording: true,
            audioUri: recordingFilePath.current,
          }));
        }

        console.log("✅ Recording started successfully");
      } catch (error) {
        console.error("❌ Failed to start recording:", error);
        if (onError && isMountedRef.current) {
          onError(error as Error);
        }
        throw error;
      }
    },
    [callId, userId, onError]
  );

  /**
   * Stop recording and prepare files
   * @param agoraEngine - Pass the engine instance when calling this function
   */
  const stopRecording = useCallback(
    async (agoraEngine: IRtcEngine | null) => {
      try {
        console.log("⏹️ Stopping call recording...");

        if (!agoraEngine) {
          console.warn("⚠️ Agora engine not available");
          return null;
        }

        // Stop audio recording
        try {
          await agoraEngine.stopAudioRecording();
          console.log("✅ Agora stopAudioRecording called");
        } catch (err) {
          console.error("❌ Failed to stop Agora recording:", err);
        }

        // Stop duration counter
        if (durationInterval.current) {
          clearInterval(durationInterval.current);
          durationInterval.current = null;
        }

        const duration = Math.floor(
          (Date.now() - recordingStartTime.current) / 1000
        );
        const audioUri = recordingFilePath.current;

        // ⭐ FIX: Check if file exists using legacy API with error handling
        if (audioUri && isMountedRef.current) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(audioUri);
            if (!fileInfo.exists) {
              console.warn("⚠️ Recording file not found:", audioUri);
            } else {
              console.log(
                `✅ Recording saved: ${audioUri} (${fileInfo.size} bytes)`
              );
            }
          } catch (err) {
            console.warn("⚠️ Could not verify recording file:", err);
          }
        }

        if (isMountedRef.current) {
          setRecordingState({
            isRecording: false,
            recordingDuration: duration,
            audioUri,
            videoUri: null,
          });
        }

        console.log(`✅ Recording stopped. Duration: ${duration}s`);

        if (onRecordingComplete && isMountedRef.current) {
          onRecordingComplete({
            audioUri,
            videoUri: null,
            duration,
          });
        }

        return { audioUri, videoUri: null, duration };
      } catch (error) {
        console.error("❌ Failed to stop recording:", error);

        // Still try to return partial data
        const duration =
          recordingStartTime.current > 0
            ? Math.floor((Date.now() - recordingStartTime.current) / 1000)
            : 0;
        const audioUri = recordingFilePath.current;

        if (onError && isMountedRef.current) {
          onError(error as Error);
        }

        return { audioUri, videoUri: null, duration };
      }
    },
    [onRecordingComplete, onError]
  );

  /**
   * Capture video frame for emotion analysis
   */
  const captureVideoFrame = useCallback(async () => {
    try {
      console.log(
        "📸 Attempting to capture video frame for emotion analysis..."
      );
      console.warn("⚠️ Video frame capture not implemented for Agora streams");
      console.log("ℹ️ Using audio-only emotion analysis");

      return null;
    } catch (error) {
      console.error("❌ Failed to capture video frame:", error);
      return null;
    }
  }, []);

  /**
   * Upload recordings to server for emotion analysis
   */
  const uploadRecordings = useCallback(
    async (
      audioUri: string | null,
      videoFrameUri: string | null,
      duration: number
    ) => {
      // ⭐ FIX: Check if component is still mounted
      if (!isMountedRef.current) {
        console.warn("⚠️ Component unmounted, skipping upload");
        return null;
      }

      try {
        console.log("📤 Uploading recordings for emotion analysis...");

        if (!audioUri) {
          throw new Error("No audio recording available");
        }

        // ⭐ FIX: Verify file exists using legacy API with try-catch
        let fileInfo;
        try {
          fileInfo = await FileSystem.getInfoAsync(audioUri);
          if (!fileInfo.exists) {
            throw new Error(`Recording file not found at: ${audioUri}`);
          }
        } catch (error) {
          console.error("❌ Error checking file:", error);
          throw new Error(`Recording file not found at: ${audioUri}`);
        }

        console.log(`📁 Recording file size: ${fileInfo.size} bytes`);
        console.log(`⏱️ Recording duration: ${duration}s`);

        const formData = new FormData();
        formData.append("callId", callId);
        formData.append("userId", userId);
        formData.append("recordingDuration", duration.toString());

        // Add audio file with proper URI format
        const audioFileUri = audioUri.startsWith("file://")
          ? audioUri
          : `file://${audioUri}`;

        formData.append("audio", {
          uri: audioFileUri,
          type: "audio/wav",
          name: `call_audio_${callId}_${userId}.wav`,
        } as any);

        console.log("📤 Audio file URI:", audioFileUri);

        // Add video frame if available
        if (videoFrameUri && isMountedRef.current) {
          try {
            const videoInfo = await FileSystem.getInfoAsync(videoFrameUri);
            if (videoInfo.exists) {
              const videoFileUri = videoFrameUri.startsWith("file://")
                ? videoFrameUri
                : `file://${videoFrameUri}`;

              formData.append("video", {
                uri: videoFileUri,
                type: "image/jpeg",
                name: `call_frame_${callId}_${userId}.jpg`,
              } as any);

              console.log("📤 Video frame URI:", videoFileUri);
            }
          } catch (error) {
            console.warn("⚠️ Could not check video frame:", error);
          }
        }

        // ⭐ FIX: Check mounted before uploading
        if (!isMountedRef.current) {
          console.warn("⚠️ Component unmounted during upload preparation");
          return null;
        }

        console.log("📤 Uploading to server...");

        const apiUrl = `${process.env.EXPO_PUBLIC_API_URL}/api/calls/recording`;
        console.log("📤 API URL:", apiUrl);

        // Upload to server
        const response = await fetch(apiUrl, {
          method: "POST",
          body: formData,
        });

        console.log("📥 Server response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Upload failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        if (result.success) {
          console.log("✅ Recordings uploaded successfully");
          if (result.emotion) {
            console.log(
              `🎭 Emotion detected: ${result.emotion} (${(result.score * 100).toFixed(0)}%)`
            );
          }
          return result;
        } else {
          throw new Error(result.error || "Upload failed");
        }
      } catch (error) {
        console.error("❌ Failed to upload recordings:", error);
        if (onError && isMountedRef.current) {
          onError(error as Error);
        }
        throw error;
      }
    },
    [callId, userId, onError]
  );

  /**
   * Cleanup recordings from device
   */
  const cleanupRecordings = useCallback(async () => {
    try {
      if (recordingState.audioUri) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(
            recordingState.audioUri
          );
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(recordingState.audioUri, {
              idempotent: true,
            });
            console.log("🧹 Audio recording cleaned up");
          }
        } catch (error) {
          console.warn("⚠️ Could not cleanup audio recording:", error);
        }
      }
      if (recordingState.videoUri) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(
            recordingState.videoUri
          );
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(recordingState.videoUri, {
              idempotent: true,
            });
            console.log("🧹 Video frame cleaned up");
          }
        } catch (error) {
          console.warn("⚠️ Could not cleanup video frame:", error);
        }
      }
    } catch (error) {
      console.error("❌ Failed to cleanup recordings:", error);
    }
  }, [recordingState.audioUri, recordingState.videoUri]);

  // ⭐ FIX: Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      console.log("🧹 useCallRecording cleanup on unmount");
      isMountedRef.current = false;

      // Clear interval if exists
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
    };
  }, []);

  return {
    recordingState,
    startRecording,
    stopRecording,
    captureVideoFrame,
    uploadRecordings,
    cleanupRecordings,
  };
};

export default useCallRecording;
