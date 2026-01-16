// contexts/PiPCallContext.tsx
// 🎬 Global Picture-in-Picture call state
import React, { createContext, useContext, useState, ReactNode } from "react";
import { IRtcEngine } from "react-native-agora";

interface PiPCallState {
  isMinimized: boolean;
  callId: string | null;
  channelName: string | null;
  conversationId: string | null;
  callType: "audio" | "video" | null;
  localUid: number;
  remoteUid: number | null;
  isMuted: boolean;
  isVideoOff: boolean;
  callDuration: number;
  engine: IRtcEngine | null;
}

interface PiPCallContextType {
  pipState: PiPCallState;
  minimizeCall: (data: Omit<PiPCallState, "isMinimized">) => void;
  maximizeCall: () => void;
  updatePipState: (updates: Partial<PiPCallState>) => void;
  endPipCall: () => void;
}

const PiPCallContext = createContext<PiPCallContextType | undefined>(undefined);

export function PiPCallProvider({ children }: { children: ReactNode }) {
  const [pipState, setPipState] = useState<PiPCallState>({
    isMinimized: false,
    callId: null,
    channelName: null,
    conversationId: null,
    callType: null,
    localUid: 0,
    remoteUid: null,
    isMuted: false,
    isVideoOff: false,
    callDuration: 0,
    engine: null,
  });

  const minimizeCall = (data: Omit<PiPCallState, "isMinimized">) => {
    console.log("🎬 Minimizing call to PiP");
    setPipState({
      ...data,
      isMinimized: true,
    });
  };

  const maximizeCall = () => {
    console.log("🎬 Maximizing call from PiP");
    setPipState((prev) => ({
      ...prev,
      isMinimized: false,
    }));
  };

  const updatePipState = (updates: Partial<PiPCallState>) => {
    setPipState((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const endPipCall = () => {
    console.log("🎬 Ending PiP call");
    setPipState({
      isMinimized: false,
      callId: null,
      channelName: null,
      conversationId: null,
      callType: null,
      localUid: 0,
      remoteUid: null,
      isMuted: false,
      isVideoOff: false,
      callDuration: 0,
      engine: null,
    });
  };

  return (
    <PiPCallContext.Provider
      value={{
        pipState,
        minimizeCall,
        maximizeCall,
        updatePipState,
        endPipCall,
      }}
    >
      {children}
    </PiPCallContext.Provider>
  );
}

export function usePiPCall() {
  const context = useContext(PiPCallContext);
  if (!context) {
    throw new Error("usePiPCall must be used within PiPCallProvider");
  }
  return context;
}