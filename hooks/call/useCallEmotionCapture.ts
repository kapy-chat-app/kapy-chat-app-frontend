// hooks/useCallEmotionCapture.ts
import { useAuth } from "@clerk/clerk-expo";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy"; // ⭐ CHANGE 1: Dùng legacy API
import { useCallback, useEffect, useRef, useState } from "react";
import { IRtcEngine } from "react-native-agora";

interface EmotionCaptureConfig {
  callId: string;
  enabled: boolean;
  intervalSeconds?: number;
  agoraEngine: IRtcEngine | null;
  mainParticipantUid?: number;
}

export function useCallEmotionCapture(config: EmotionCaptureConfig) {
  const {
    callId,
    enabled,
    intervalSeconds = 10,
    agoraEngine,
    mainParticipantUid,
  } = config;

  const { getToken } = useAuth();
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastEmotion, setLastEmotion] = useState<string | null>(null);
  const captureTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const currentRecordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (captureTimerRef.current) {
        clearInterval(captureTimerRef.current);
        captureTimerRef.current = null;
      }
      cleanupRecording();
    };
  }, []);

  useEffect(() => {
    if (enabled && agoraEngine && mainParticipantUid !== undefined) {
      startCapture();
    } else {
      stopCapture();
    }

    return () => {
      stopCapture();
    };
  }, [enabled, callId, agoraEngine, mainParticipantUid]);

  const cleanupRecording = useCallback(async () => {
    if (currentRecordingRef.current) {
      try {
        const status = await currentRecordingRef.current.getStatusAsync();
        if (status.isRecording || status.canRecord) {
          await currentRecordingRef.current.stopAndUnloadAsync();
        }
      } catch (err) {
        console.log("⚠️ Error cleaning up recording:", err);
      }
      currentRecordingRef.current = null;
    }
  }, []);

  const startCapture = useCallback(async () => {
    if (!enabled || isCapturing || !agoraEngine) return;

    if (mainParticipantUid === undefined) {
      console.warn("⚠️ No main participant UID, cannot capture");
      return;
    }

    // ⭐ CHANGE 2: Check cacheDirectory availability
    if (!FileSystem.cacheDirectory) {
      console.error("❌ FileSystem.cacheDirectory is not available!");
      return;
    }

    console.log("🎬 Starting real-time emotion capture...");
    console.log("🎯 Main participant UID:", mainParticipantUid);
    console.log("📂 Cache directory:", FileSystem.cacheDirectory);
    setIsCapturing(true);

    // ⏳ Đợi Agora render frame ổn định
    console.log("⏳ Waiting 5s for Agora video to stabilize...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // ✅ Kiểm tra connection state
    try {
      const connectionState = await agoraEngine.getConnectionState();
      console.log("🔗 Connection state:", connectionState);

      if (connectionState !== 3) {
        console.warn(
          "⚠️ Agora not fully connected yet, state:",
          connectionState
        );
      }
    } catch (e) {
      console.error("❌ Failed to get connection state:", e);
    }

    await captureAndSend();

    captureTimerRef.current = setInterval(async () => {
      if (isMountedRef.current) {
        await captureAndSend();
      }
    }, intervalSeconds * 1000);
  }, [enabled, isCapturing, agoraEngine, intervalSeconds, mainParticipantUid]);

  const stopCapture = useCallback(() => {
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    cleanupRecording();
    setIsCapturing(false);
    console.log("🛑 Stopped emotion capture");
  }, [cleanupRecording]);

  const captureAndSend = useCallback(async () => {
    try {
      console.log("📸 Capturing frame and audio for emotion analysis...");

      const videoUri = await captureVideoFrame();
      const audioUri = await captureAudioSnippet();

      if (videoUri || audioUri) {
        const result = await sendToBackend(videoUri, audioUri);

        if (result?.emotion && isMountedRef.current) {
          setLastEmotion(result.emotion);
          console.log(
            `🎭 Emotion detected: ${result.emotion} (${(
              result.confidence * 100
            ).toFixed(0)}%)`
          );
        }
      }

      // Cleanup files
      if (videoUri) {
        await FileSystem.deleteAsync(videoUri, { idempotent: true }).catch(
          () => {}
        );
      }
      if (audioUri) {
        await FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(
          () => {}
        );
      }
    } catch (error) {
      console.error("❌ Error in capture cycle:", error);
    }
  }, [callId, getToken, mainParticipantUid, agoraEngine]);

  /**
   * ✅ CAPTURE VIDEO
   */
  const captureVideoFrame = useCallback(async (): Promise<string | null> => {
    if (!agoraEngine || mainParticipantUid === undefined) {
      console.warn("⚠️ No engine or main participant UID");
      return null;
    }

    if (!FileSystem.cacheDirectory) {
      console.error("❌ FileSystem.cacheDirectory is undefined");
      return null;
    }

    try {
      const fileName = `snapshot_${Date.now()}.jpg`;

      // ⭐ FIX 1: Sử dụng absolute path (bỏ file:// prefix)
      let snapshotPath = `${FileSystem.cacheDirectory}${fileName}`;

      // Remove file:// prefix if present (Agora doesn't like it)
      if (snapshotPath.startsWith("file://")) {
        snapshotPath = snapshotPath.replace("file://", "");
      }

      console.log(`📸 Taking snapshot (uid=${mainParticipantUid})`);
      console.log(`📂 Original path: ${FileSystem.cacheDirectory}${fileName}`);
      console.log(`📂 Cleaned path: ${snapshotPath}`);

      const result = await agoraEngine.takeSnapshot(
        mainParticipantUid,
        snapshotPath
      );

      console.log(`📸 takeSnapshot result code: ${result}`);

      if (result !== 0) {
        console.error(`❌ takeSnapshot failed with code: ${result}`);
        console.error(
          "Error codes: -1=invalid param, -2=not ready, -7=engine not ready"
        );
        return null;
      }

      // ⭐ FIX 2: Check multiple possible paths
      const pathsToCheck = [
        snapshotPath,
        `file://${snapshotPath}`,
        `/storage/emulated/0/Android/data/com.hoanglam21.kapychatappfrontend/cache/${fileName}`,
        `/data/data/com.hoanglam21.kapychatappfrontend/cache/${fileName}`,
      ];

      console.log("🔍 Checking multiple paths...");

      // ⭐ FIX 3: Longer timeout with progress logging
      let retries = 0;
      const maxRetries = 50; // 5 seconds

      while (retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 100));

        for (const pathToCheck of pathsToCheck) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(pathToCheck);

            if (fileInfo.exists && fileInfo.size && fileInfo.size > 5000) {
              console.log(`✅ Snapshot found at: ${pathToCheck}`);
              console.log(`✅ Size: ${fileInfo.size} bytes`);
              return pathToCheck;
            } else if (fileInfo.exists) {
              console.log(
                `⏳ File exists but too small: ${fileInfo.size} bytes at ${pathToCheck}`
              );
            }
          } catch (err) {
            // Path doesn't exist, continue
          }
        }

        retries++;

        // Log progress every 10 retries
        if (retries % 10 === 0) {
          console.log(`⏳ Still waiting... (${retries}/${maxRetries})`);
        }
      }

      console.error("❌ Snapshot timeout: file not created after 5s");
      console.error("📂 Checked paths:");
      pathsToCheck.forEach((p) => console.error(`  - ${p}`));

      return null;
    } catch (error) {
      console.error("❌ Error capturing snapshot:", error);
      return null;
    }
  }, [agoraEngine, mainParticipantUid]);

  const captureAudioSnippet = useCallback(async (): Promise<string | null> => {
    try {
      await cleanupRecording();

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        console.warn("⚠️ Audio permission not granted");
        return null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const recording = new Audio.Recording();
      currentRecordingRef.current = recording;

      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      await recording.startAsync();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();
      currentRecordingRef.current = null;

      if (!uri) {
        console.warn("⚠️ Audio URI is null");
        return null;
      }

      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists || !fileInfo.size) {
          console.warn("⚠️ Audio file invalid");
          return null;
        }

        console.log(`🎤 Audio captured: ${fileInfo.size} bytes`);
        return uri;
      } catch (err) {
        console.error("❌ Error checking audio file:", err);
        return null;
      }
    } catch (error) {
      console.error("❌ Error capturing audio:", error);
      await cleanupRecording();
      return null;
    }
  }, [cleanupRecording]);

  const sendToBackend = useCallback(
    async (videoUri: string | null, audioUri: string | null): Promise<any> => {
      try {
        const token = await getToken();
        if (!token || (!videoUri && !audioUri)) return null;

        const formData = new FormData();
        formData.append("callId", callId);
        formData.append("timestamp", new Date().toISOString());

        if (videoUri) {
          formData.append("video", {
            uri: videoUri,
            type: "image/jpeg",
            name: `frame_${Date.now()}.jpg`,
          } as any);
        }

        if (audioUri) {
          formData.append("audio", {
            uri: audioUri,
            type: "audio/m4a",
            name: `audio_${Date.now()}.m4a`,
          } as any);
        }

        console.log("📤 Sending to backend...");

        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/api/calls/analyze-emotion`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          }
        );

        if (!response.ok) {
          console.error(`❌ Backend error: ${response.status}`);
          return null;
        }

        const result = await response.json();
        console.log("✅ Backend response:", result);

        return result.success ? result.data : null;
      } catch (error) {
        console.error("❌ Error sending to backend:", error);
        return null;
      }
    },
    [callId, getToken]
  );

  return {
    isCapturing,
    lastEmotion,
    startCapture,
    stopCapture,
  };
}
