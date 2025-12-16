import {
  registerAgoraEngine,
  unregisterAgoraEngine,
} from "@/lib/agora/AgoraSnapshot";
import { useEffect, useRef, useState } from "react";
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  IRtcEngine,
} from "react-native-agora";

export function useAgoraEngine(appId: string) {
  const [engine, setEngine] = useState<IRtcEngine | null>(null);
  const engineRef = useRef<IRtcEngine | null>(null);

  useEffect(() => {
    const initEngine = async () => {
      try {
        console.log("🎥 Initializing Agora with appId:", appId);

        const agoraEngine = createAgoraRtcEngine();

        agoraEngine.initialize({
          appId,
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
        });

        agoraEngine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
        agoraEngine.enableVideo();
        agoraEngine.enableAudio();

        engineRef.current = agoraEngine;
        setEngine(agoraEngine);

        // ⭐⭐⭐ REGISTER ENGINE WITH NATIVE MODULE ⭐⭐⭐
        await registerAgoraEngine(agoraEngine);

        console.log("✅ Agora engine initialized and registered");
      } catch (error) {
        console.error("❌ Failed to initialize Agora:", error);
      }
    };

    initEngine();

    return () => {
      console.log("🧹 Cleaning up Agora engine");

      // ⭐ Unregister before destroying
      unregisterAgoraEngine();

      if (engineRef.current) {
        engineRef.current.release();
        engineRef.current = null;
      }
    };
  }, [appId]);

  return engine;
}
