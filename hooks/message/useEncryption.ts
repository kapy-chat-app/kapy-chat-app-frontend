// hooks/message/useEncryption.ts - WITH GROUP SUPPORT
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

  useEffect(() => {
    const checkInitialization = async () => {
      if (initCheckRef.current) return;
      
      if (globalReady && userId) {
        try {
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

  const prefetchConversationKeys = useCallback(
    async (participantIds: string[]) => {
      console.log(`🔄 [useEncryption] Prefetching keys for conversation...`);
      
      if (!isInitialized) {
        console.warn('⚠️ [useEncryption] Not initialized, skipping prefetch');
        return;
      }

      try {
        const otherParticipants = participantIds.filter(id => id !== userId);
        
        if (otherParticipants.length === 0) {
          console.log('⚠️ [useEncryption] No other participants to prefetch');
          return;
        }

        await KeyCacheService.prefetchKeys(otherParticipants, getToken, API_BASE_URL);
        console.log('✅ [useEncryption] Prefetch complete');
      } catch (error: any) {
        console.error('❌ [useEncryption] Prefetch failed:', error);
      }
    },
    [isInitialized, userId, getToken]
  );

  /**
   * ✅ Encrypt message for 1-1 chat (EXISTING LOGIC - NO CHANGES)
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

        const [recipientKey, myKey] = await Promise.all([
          KeyCacheService.getKey(recipientUserId),
          KeyCacheService.getMyKey(),
        ]);

        if (!recipientKey) {
          console.error('❌ [useEncryption] Recipient key not in cache');
          
          console.log('🔄 [useEncryption] Fetching missing recipient key...');
          await KeyCacheService.prefetchKeys([recipientUserId], getToken, API_BASE_URL);
          
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
   * 🆕 Encrypt message for GROUP CHAT
   * Fetches participants from server, encrypts for each
   */
  const encryptMessageForGroup = useCallback(
    async (conversationId: string, message: string) => {
      console.log(`👥 [useEncryption] Encrypting GROUP message for conversation ${conversationId}...`);

      if (!isInitialized) {
        throw new Error("Encryption not ready - please wait");
      }

      if (!userId) {
        throw new Error("User ID not available");
      }

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("No authentication token");
        }

        // 1️⃣ Fetch conversation participants
        console.log("👥 [useEncryption] Fetching conversation participants...");
        
        const convResponse = await fetch(
          `${API_BASE_URL}/api/conversations/${conversationId}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!convResponse.ok) {
          throw new Error(`Failed to fetch conversation: ${convResponse.status}`);
        }

        const convResult = await convResponse.json();
        const participants = convResult.data.participants || [];
        
        // Extract participant IDs (excluding myself)
        const participantIds = participants
          .map((p: any) => p.clerkId)
          .filter((id: string) => id !== userId);

        if (participantIds.length === 0) {
          throw new Error("No participants found in group");
        }

        console.log(`✅ [useEncryption] Found ${participantIds.length} participants (excluding self)`);

        // 2️⃣ Prefetch all participant keys
        await prefetchConversationKeys(participantIds);

        // 3️⃣ Get my key
        const myKey = await KeyCacheService.getMyKey();
        if (!myKey) {
          throw new Error("Your encryption key not available");
        }

        // 4️⃣ Encrypt for each participant
        console.log(`🔐 [useEncryption] Encrypting for ${participantIds.length} participants...`);

        const recipientEncryptions = await Promise.all(
          participantIds.map(async (participantId: string) => {
            const participantKey = await KeyCacheService.getKey(participantId);
            
            if (!participantKey) {
              console.warn(`⚠️ [useEncryption] No key for ${participantId}, skipping`);
              return null;
            }

            const encrypted = await UnifiedEncryptionService.encryptMessage(message, participantKey);
            
            return {
              userId: participantId,
              encrypted: JSON.parse(encrypted.encryptedContent),
            };
          })
        );

        // Filter out failed encryptions
        const validEncryptions = recipientEncryptions.filter((e) => e !== null);

        if (validEncryptions.length === 0) {
          throw new Error("Failed to encrypt for any participant");
        }

        console.log(`✅ [useEncryption] Successfully encrypted for ${validEncryptions.length}/${participantIds.length} participants`);

        // 5️⃣ Encrypt for myself
        const myEncryption = await UnifiedEncryptionService.encryptMessage(message, myKey);
        const senderEncrypted = JSON.parse(myEncryption.encryptedContent);

        // 6️⃣ Format result
        return {
          encryptedContent: JSON.stringify({
            type: "group",
            recipients: validEncryptions,
            sender_encrypted: senderEncrypted,
          }),
          encryptionMetadata: {
            type: "PreKeyWhisperMessage" as const,
          },
        };
      } catch (error: any) {
        console.error('❌ [useEncryption] Group encryption failed:', error.message);
        throw new Error(`Failed to encrypt for group: ${error.message}`);
      }
    },
    [isInitialized, userId, getToken, prefetchConversationKeys]
  );

  /**
   * ✅ Decrypt message (EXISTING LOGIC - NO CHANGES)
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

        let dataToDecrypt;
        
        // 🆕 Handle group messages
        if (parsed.type === "group") {
          console.log("👥 [useEncryption] Decrypting GROUP message");
          
          if (senderId === userId) {
            // I'm the sender, use sender_encrypted
            dataToDecrypt = parsed.sender_encrypted;
          } else {
            // I'm a recipient, find my encryption
            const myEncryption = parsed.recipients?.find(
              (r: any) => r.userId === userId
            );
            
            if (!myEncryption) {
              throw new Error("No encryption found for current user in group message");
            }
            
            dataToDecrypt = myEncryption.encrypted;
          }
        } else {
          // 🔄 Handle 1-1 messages (EXISTING LOGIC)
          if (senderId === userId) {
            dataToDecrypt = parsed.sender_encrypted;
          } else {
            dataToDecrypt = parsed.recipient_encrypted;
          }
        }

        if (!dataToDecrypt?.iv || !dataToDecrypt?.authTag || !dataToDecrypt?.data) {
          throw new Error("Invalid encrypted content");
        }

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
    encryptMessageForGroup, // 🆕 Export new function
    decryptMessage,
    prefetchConversationKeys,
    loading: globalLoading,
    error: globalError,
  };
};