// hooks/useCallEmotionCapture.ts - UPDATED FOR EXPO SDK 54
import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';

interface EmotionCaptureConfig {
  callId: string;
  enabled: boolean;
  intervalSeconds?: number; // Default: 10s
}

export function useCallEmotionCapture(config: EmotionCaptureConfig) {
  const { callId, enabled, intervalSeconds = 10 } = config;
  const [isCapturing, setIsCapturing] = useState(false);
  const captureTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Start capturing
  const startCapture = async () => {
    if (!enabled || isCapturing) return;

    console.log('🎬 Starting emotion capture...');
    setIsCapturing(true);

    captureTimerRef.current = setInterval(async () => {
      await captureAndSend();
    }, intervalSeconds * 1000);

    // Initial capture
    await captureAndSend();
  };

  // Stop capturing
  const stopCapture = () => {
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    setIsCapturing(false);
    console.log('🛑 Stopped emotion capture');
  };

  // Capture frame + audio and send to backend
  const captureAndSend = async () => {
    try {
      console.log('📸 Capturing frame and audio...');

      // 1. Capture video frame (from Agora local view)
      const videoBlob = await captureVideoFrame();

      // 2. Capture short audio snippet (2-3 seconds)
      const audioBlob = await captureAudioSnippet();

      // 3. Send to backend
      if (videoBlob || audioBlob) {
        await sendToBackend(videoBlob, audioBlob);
      }
    } catch (error) {
      console.error('❌ Error capturing:', error);
    }
  };

  // Capture video frame from Agora stream
  const captureVideoFrame = async (): Promise<Blob | null> => {
    try {
      // TODO: Implement Agora video frame capture
      // You might need to use Agora's `takeSnapshot` or similar API
      
      // Placeholder - implement based on your Agora setup
      console.log('📹 Video frame capture not implemented yet');
      return null;
    } catch (error) {
      console.error('Error capturing video frame:', error);
      return null;
    }
  };

  // ✅ UPDATED: Capture short audio snippet using SDK 54 API
  const captureAudioSnippet = async (): Promise<Blob | null> => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('⚠️ Audio permission not granted');
        return null;
      }

      // Record 2 seconds of audio
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      await recording.startAsync();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Record 2s
      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();
      if (!uri) {
        console.log('⚠️ No audio URI');
        return null;
      }

      // ✅ NEW SDK 54 WAY: Use File API
      const response = await fetch(uri);
      const blob = await response.blob();
      
      console.log('✅ Audio captured:', blob.size, 'bytes');
      return blob;
    } catch (error) {
      console.error('❌ Error capturing audio:', error);
      return null;
    }
  };

  // Send to backend
  const sendToBackend = async (videoBlob: Blob | null, audioBlob: Blob | null) => {
    try {
      const formData = new FormData();
      formData.append('callId', callId);
      formData.append('timestamp', new Date().toISOString());

      if (videoBlob) {
        // @ts-ignore - FormData accepts Blob in React Native
        formData.append('video', videoBlob, 'frame.jpg');
      }
      if (audioBlob) {
        // @ts-ignore - FormData accepts Blob in React Native
        formData.append('audio', audioBlob, 'audio.wav');
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/call/analyze-emotion`, {
        method: 'POST',
        body: formData,
        headers: {
          // Add auth token if needed
          // 'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Emotion analyzed:', result.data);
      } else {
        const errorText = await response.text();
        console.error('❌ Backend error:', errorText);
      }
    } catch (error) {
      console.error('❌ Error sending to backend:', error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    if (enabled) {
      startCapture();
    }

    return () => {
      stopCapture();
    };
  }, [enabled, callId]);

  return {
    isCapturing,
    startCapture,
    stopCapture,
  };
}