// hooks/message/useEncryption.ts - OPTIMIZED VERSION
import { useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { UnifiedEncryptionService } from "@/lib/encryption/UnifiedEncryptionService";
import { useEncryptionContext } from "@/components/page/message/EncryptionInitProvider";
import { KeyCacheService } from "@/lib/encryption/KeyCacheService";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const useEncryption = () => {
  const { isReady: globalReady, loading: globalLoading, error: globalError } = useEncryptionContext();
  const [isInitialized, setIsInitialized] = useState(false);
  const { getToken, userId } = useAuth();
  
  const initCheckRef = useRef(false);

  // ✅ Initialize and verify keys on mount
  useEffect(() => {
    const checkInitialization = async () => {
      if (initCheckRef.current) return;
      
      if (globalReady && userId) {
        try {
          // Verify my key exists
          const myKey = await KeyCacheService.getMyKey();
          if (myKey && myKey.length > 0) {
            console.log('✅ [useEncryption] Initialized - my key available');
            setIsInitialized(true);
            initCheckRef.current = true;
          } else {
            console.error('❌ [useEncryption] No key found');
            setIsInitialized(false);
          }
        } catch (error) {
          console.error('❌ [useEncryption] Initialization failed:', error);
          setIsInitialized(false);
        }
      } else {
        setIsInitialized(false);
      }
    };

    checkInitialization();
  }, [globalReady, userId]);

  /**
   * ✅ Prefetch keys for conversation participants
   * Call this when opening a conversation
   */
  const prefetchConversationKeys = useCallback(
    async (participantIds: string[]) => {
      console.log(`🔄 [useEncryption] Prefetching keys for conversation...`);
      
      if (!isInitialized) {
        console.warn('⚠️ [useEncryption] Not initialized, skipping prefetch');
        return;
      }

      try {
        // Filter out my own ID
        const otherParticipants = participantIds.filter(id => id !== userId);
        
        if (otherParticipants.length === 0) {
          console.log('⚠️ [useEncryption] No other participants to prefetch');
          return;
        }

        await KeyCacheService.prefetchKeys(otherParticipants, getToken, API_BASE_URL);
        console.log('✅ [useEncryption] Prefetch complete');
      } catch (error: any) {
        console.error('❌ [useEncryption] Prefetch failed:', error);
        // Don't throw - prefetch failure shouldn't block the app
      }
    },
    [isInitialized, userId, getToken]
  );

  /**
   * ✅ Encrypt message using cached keys (NO NETWORK CALL)
   */
  const encryptMessage = useCallback(
    async (recipientUserId: string, message: string) => {
      console.log(`🔐 [useEncryption] Encrypting message for ${recipientUserId}...`);

      if (!isInitialized) {
        throw new Error("Encryption not ready - please wait");
      }

      if (!userId) {
        throw new Error("User ID not available");
      }

      try {
        const startTime = Date.now();

        // ✅ Get keys from cache (FAST - no network)
        const [recipientKey, myKey] = await Promise.all([
          KeyCacheService.getKey(recipientUserId),
          KeyCacheService.getMyKey(),
        ]);

        if (!recipientKey) {
          console.error('❌ [useEncryption] Recipient key not in cache');
          
          // ✅ Try to fetch it now
          console.log('🔄 [useEncryption] Fetching missing recipient key...');
          await KeyCacheService.prefetchKeys([recipientUserId], getToken, API_BASE_URL);
          
          // Try again
          const fetchedKey = await KeyCacheService.getKey(recipientUserId);
          if (!fetchedKey) {
            throw new Error("Recipient encryption key not available");
          }
        }

        if (!myKey) {
          throw new Error("Your encryption key not available");
        }

        const fetchDuration = Date.now() - startTime;
        console.log(`✅ [useEncryption] Keys retrieved from cache in ${fetchDuration}ms`);

        // ✅ Encrypt
        console.log(`🔐 [useEncryption] Encrypting...`);
        const encryptStart = Date.now();
        
        const [forRecipient, forSelf] = await Promise.all([
          UnifiedEncryptionService.encryptMessage(message, recipientKey!),
          UnifiedEncryptionService.encryptMessage(message, myKey),
        ]);

        const encryptDuration = Date.now() - encryptStart;
        console.log(`✅ [useEncryption] Encrypted in ${encryptDuration}ms`);

        return {
          encryptedContent: JSON.stringify({
            recipient_encrypted: JSON.parse(forRecipient.encryptedContent),
            sender_encrypted: JSON.parse(forSelf.encryptedContent),
          }),
          encryptionMetadata: {
            type: "PreKeyWhisperMessage" as const,
          },
        };
      } catch (error: any) {
        console.error('❌ [useEncryption] Encryption failed:', error.message);
        throw new Error(`Failed to encrypt: ${error.message}`);
      }
    },
    [isInitialized, userId, getToken]
  );

  /**
   * ✅ Decrypt message using cached keys (NO NETWORK CALL)
   */
  const decryptMessage = useCallback(
    async (senderId: string, encryptedContent: string) => {
      console.log(`🔓 [useEncryption] Decrypting message from ${senderId}...`);

      if (!isInitialized) {
        throw new Error("Encryption not ready");
      }

      if (!userId) {
        return "[🔒 Decryption failed - No user ID]";
      }

      try {
        const parsed = JSON.parse(encryptedContent);

        // Determine which encrypted version to use
        let dataToDecrypt;
        if (senderId === userId) {
          dataToDecrypt = parsed.sender_encrypted;
        } else {
          dataToDecrypt = parsed.recipient_encrypted;
        }

        if (!dataToDecrypt?.iv || !dataToDecrypt?.authTag || !dataToDecrypt?.data) {
          throw new Error("Invalid encrypted content");
        }

        // ✅ Get key from cache (FAST)
        const myKey = await KeyCacheService.getMyKey();
        if (!myKey) {
          throw new Error("Decryption key not available");
        }

        console.log(`🔓 [useEncryption] Decrypting...`);
        
        const decrypted = await UnifiedEncryptionService.decryptMessage(
          dataToDecrypt.data,
          dataToDecrypt.iv,
          dataToDecrypt.authTag,
          myKey
        );

        console.log(`✅ [useEncryption] Decrypted successfully`);
        return decrypted;
      } catch (error: any) {
        console.error("❌ [useEncryption] Decryption failed:", error.message);
        return "[🔒 Decryption failed]";
      }
    },
    [isInitialized, userId]
  );

  return {
    isInitialized,
    encryptMessage,
    decryptMessage,
    prefetchConversationKeys, // ✅ NEW: Expose prefetch function
    loading: globalLoading,
    error: globalError,
  };
};