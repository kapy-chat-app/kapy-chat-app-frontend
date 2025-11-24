// hooks/message/useEncryption.ts - USE GLOBAL STATE
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { nativeEncryptionService } from "@/lib/encryption/NativeEncryptionService";
import { useEncryptionContext } from "@/components/page/message/EncryptionInitProvider";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export interface EncryptionResult {
  encryptedContent: string;
  encryptionMetadata: {
    type: "PreKeyWhisperMessage" | "WhisperMessage";
    registration_id?: number;
    pre_key_id?: number;
    signed_pre_key_id?: number;
    iv?: string;
    authTag?: string;
  };
}

export const useEncryption = () => {
  // ✅ USE GLOBAL STATE
  const { isReady: globalReady, loading: globalLoading, error: globalError } = useEncryptionContext();
  
  const [isInitialized, setIsInitialized] = useState(globalReady);
  const [loading, setLoading] = useState(globalLoading);
  const [error, setError] = useState<string | null>(globalError);
  
  const { getToken, userId } = useAuth();

  // ✅ Sync with global state
  useEffect(() => {
    setIsInitialized(globalReady);
    setLoading(globalLoading);
    setError(globalError);
  }, [globalReady, globalLoading, globalError]);

  // ✅ Log when ready
  useEffect(() => {
    if (globalReady) {
      console.log('✅ [useEncryption] E2EE ready (from global state)');
    }
  }, [globalReady]);

  // ✅ NO AUTO INIT - Already done globally
  const initializeEncryption = useCallback(async () => {
    if (globalReady) {
      console.log('✅ [useEncryption] Already initialized globally');
      return;
    }

    console.warn('⚠️ [useEncryption] Global init not ready, force init...');
    
    try {
      setLoading(true);
      setError(null);

      const keys = await nativeEncryptionService.initializeKeys();
      const token = await getToken();
      if (!token) throw new Error("Authentication token not available");

      const response = await fetch(`${API_BASE_URL}/api/keys/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ publicKey: keys.publicKey }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to upload key");
      }

      setIsInitialized(true);
      console.log("✅ [useEncryption] Force init complete");
    } catch (err: any) {
      console.error("❌ [useEncryption] Force init failed:", err);
      setError(err.message);
      setIsInitialized(false);
    } finally {
      setLoading(false);
    }
  }, [globalReady, userId, getToken]);

  const encryptMessage = useCallback(
    async (recipientUserId: string, message: string): Promise<EncryptionResult> => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      try {
        const result = await nativeEncryptionService.encryptMessage(message);

        console.log('✅ Native encryption result:', {
          hasEncryptedContent: !!result.encryptedContent,
          hasIv: !!result.encryptionMetadata.iv,
          hasAuthTag: !!result.encryptionMetadata.authTag,
        });

        return {
          encryptedContent: result.encryptedContent,
          encryptionMetadata: {
            type: "WhisperMessage",
            iv: result.encryptionMetadata.iv,
            authTag: result.encryptionMetadata.authTag,
          },
        };
      } catch (err: any) {
        console.error("❌ Native encryption failed:", err);
        throw err;
      }
    },
    [isInitialized]
  );

  const decryptMessage = useCallback(
    async (senderId: string, encryptedContent: string): Promise<string> => {
      if (!isInitialized) {
        throw new Error("E2EE not initialized");
      }

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Authentication token not available");
        }

        let iv: string;
        let authTag: string;
        let data: string;

        try {
          const parsed = JSON.parse(encryptedContent);
          iv = parsed.iv;
          authTag = parsed.authTag || parsed.data;
          data = parsed.data || parsed.encryptedContent;
          
          if (!parsed.authTag && parsed.data) {
            console.log("⚠️ Detected old encryption format, attempting compatibility decrypt");
            
            const response = await fetch(`${API_BASE_URL}/api/keys/${senderId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const result = await response.json();
            if (!result.success) {
              throw new Error(result.error || "Failed to get sender key");
            }
            
            const { simpleEncryptionService } = await import("@/lib/encryption/EncryptionService");
            return await simpleEncryptionService.decryptMessage(
              encryptedContent,
              senderId,
              API_BASE_URL,
              token
            );
          }
        } catch (parseError) {
          console.error("❌ Failed to parse encrypted content:", parseError);
          throw new Error("Invalid encrypted content format");
        }

        console.log("🔄 Fetching sender key for decryption:", senderId);
        const response = await fetch(`${API_BASE_URL}/api/keys/${senderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "Failed to get sender key");
        }

        const senderKeyBase64 = result.data.publicKey;

        const decrypted = await nativeEncryptionService.decryptMessage(
          data,
          iv,
          authTag,
          senderKeyBase64
        );

        console.log("✅ Native decryption successful");
        return decrypted;
      } catch (err: any) {
        console.error("❌ Native decryption failed:", err);
        throw err;
      }
    },
    [isInitialized, getToken]
  );

  const clearEncryption = useCallback(async () => {
    await nativeEncryptionService.clearKeys();
    nativeEncryptionService.clearCache();
    setIsInitialized(false);
  }, []);

  return {
    isInitialized,
    initializeEncryption,
    encryptMessage,
    decryptMessage,
    clearEncryption,
    loading,
    error,
  };
};