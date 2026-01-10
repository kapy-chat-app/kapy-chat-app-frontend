// hooks/call/useOptimizedCallInit.ts
// ⚡ Optimized call initialization with preloading
import { useAuth } from "@clerk/clerk-expo";
import { IRtcEngine, createAgoraRtcEngine } from "react-native-agora";
import { useRef, useEffect, useState } from "react";
import axios from "axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface CallInitResult {
  engine: IRtcEngine | null;
  isReady: boolean;
  token: string | null;
  uid: number;
  error: string | null;
}

/**
 * ⚡ Pre-initialize Agora engine for faster call joins
 * This hook keeps an engine instance ready in the background
 */
export function useOptimizedCallInit() {
  const { getToken, userId } = useAuth();
  const engineRef = useRef<IRtcEngine | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ⚡ Pre-initialize engine on app start
  useEffect(() => {
    const initEngine = async () => {
      try {
        if (!engineRef.current) {
          const authToken = await getToken();
          const response = await axios.get(`${API_URL}/api/agora/app-id`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });

          const { appId } = response.data;
          
          const engine = createAgoraRtcEngine();
          engine.initialize({ appId });
          
          engineRef.current = engine;
          setIsReady(true);
          console.log("⚡ Agora engine pre-initialized");
        }
      } catch (err: any) {
        console.error("❌ Engine pre-init failed:", err);
        setError(err.message);
      }
    };

    initEngine();

    return () => {
      // Don't destroy on unmount - keep engine alive for faster joins
    };
  }, []);

  /**
   * ⚡ Quick join with pre-initialized engine
   */
  const quickJoin = async (channelName: string): Promise<CallInitResult> => {
    try {
      if (!engineRef.current) {
        throw new Error("Engine not initialized");
      }

      const authToken = await getToken();
      
      // ⚡ Parallel token fetch (don't wait)
      const tokenPromise = axios.post(
        `${API_URL}/api/agora/token`,
        { channelName, role: "publisher" },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      // ⚡ Start configuring engine immediately
      const engine = engineRef.current;
      await engine.enableAudio();
      await engine.enableVideo();
      await engine.startPreview();

      // ⚡ Now wait for token
      const tokenResponse = await tokenPromise;
      const { token, uid } = tokenResponse.data;

      return {
        engine,
        isReady: true,
        token,
        uid,
        error: null,
      };
    } catch (err: any) {
      console.error("❌ Quick join failed:", err);
      return {
        engine: null,
        isReady: false,
        token: null,
        uid: 0,
        error: err.message,
      };
    }
  };

  return {
    engine: engineRef.current,
    isReady,
    error,
    quickJoin,
  };
}