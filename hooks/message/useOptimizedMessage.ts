// hooks/message/useOptimizedMessages.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { messageCacheService } from '@/lib/cache/MessageCacheService';
import { useEncryption } from './useEncryption';

interface DecryptionQueue {
  messageId: string;
  priority: 'high' | 'normal' | 'low';
  hasAttachments: boolean;
}

export const useOptimizedMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [decryptionProgress, setDecryptionProgress] = useState<Set<string>>(new Set());
  const { decryptMessage, isInitialized } = useEncryption();
  
  // ✅ Track which messages are already decrypted
  const decryptedCache = useRef<Set<string>>(new Set());
  
  // ✅ Queue for background decryption
  const decryptionQueue = useRef<DecryptionQueue[]>([]);
  const isProcessingQueue = useRef(false);

  // ✅ STEP 1: Load from cache immediately (NO decryption)
  const loadFromCache = useCallback(async () => {
    if (!conversationId) return;
    
    console.log('📦 [OPTIMIZED] Loading from cache...');
    
    const cached = await messageCacheService.getMessages(conversationId, 50);
    
    if (cached.length > 0) {
      // ✅ Convert to messages but keep encrypted content
      const rawMessages = cached.map(c => ({
        ...fromCachedMessage(c),
        _isFromCache: true,
        _needsDecryption: !!c.content && c.content.includes('encrypted'),
      }));
      
      setMessages(rawMessages);
      console.log(`✅ [OPTIMIZED] Loaded ${rawMessages.length} cached messages (NOT decrypted yet)`);
      
      // ✅ Queue for background decryption
      rawMessages.forEach(msg => {
        if (msg._needsDecryption && !decryptedCache.current.has(msg._id)) {
          decryptionQueue.current.push({
            messageId: msg._id,
            priority: msg.attachments?.length > 0 ? 'low' : 'high',
            hasAttachments: msg.attachments?.length > 0,
          });
        }
      });
      
      // ✅ Start background decryption
      processDecryptionQueue();
    }
  }, [conversationId]);

  // ✅ STEP 2: Background decryption (non-blocking)
  const processDecryptionQueue = useCallback(async () => {
    if (isProcessingQueue.current || !isInitialized) return;
    
    isProcessingQueue.current = true;
    
    while (decryptionQueue.current.length > 0) {
      // ✅ Sort by priority (text messages first, attachments later)
      decryptionQueue.current.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
      
      const batch = decryptionQueue.current.splice(0, 3); // Process 3 at a time
      
      await Promise.all(
        batch.map(async ({ messageId }) => {
          try {
            setDecryptionProgress(prev => new Set(prev).add(messageId));
            
            // ✅ Decrypt single message
            await decryptSingleMessage(messageId);
            
            decryptedCache.current.add(messageId);
            setDecryptionProgress(prev => {
              const next = new Set(prev);
              next.delete(messageId);
              return next;
            });
          } catch (error) {
            console.error(`❌ [DECRYPT] Failed for ${messageId}:`, error);
          }
        })
      );
      
      // ✅ Small delay to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    isProcessingQueue.current = false;
  }, [isInitialized]);

  // ✅ STEP 3: Decrypt single message (update in-place)
  const decryptSingleMessage = useCallback(async (messageId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg._id !== messageId) return msg;
      
      // ✅ Skip if already decrypted
      if (!msg._needsDecryption || decryptedCache.current.has(msg._id)) {
        return msg;
      }
      
      // ✅ Decrypt text content
      const decryptedContent = await decryptMessage(msg.sender.clerkId, msg.encrypted_content);
      
      // ✅ Return updated message
      return {
        ...msg,
        content: decryptedContent,
        _needsDecryption: false,
        _isDecrypted: true,
      };
    }));
    
    // ✅ Update cache with decrypted content
    await messageCacheService.updateMessageContent(messageId, decryptedContent);
  }, [decryptMessage]);

  // ✅ STEP 4: Fetch new messages from server
  const fetchNewMessages = useCallback(async () => {
    if (!conversationId) return;
    
    const token = await getToken();
    const meta = await messageCacheService.getConversationMeta(conversationId);
    
    let url = `${API_BASE_URL}/api/conversations/${conversationId}/messages?limit=50`;
    
    if (meta?.last_sync_time) {
      url += `&after=${new Date(meta.last_sync_time).toISOString()}`;
    }
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const result = await response.json();
    const newMessages = result.data.messages || [];
    
    if (newMessages.length > 0) {
      console.log(`📥 [FETCH] Got ${newMessages.length} new messages`);
      
      // ✅ Add to state immediately (show skeleton for attachments)
      setMessages(prev => [
        ...prev,
        ...newMessages.map(m => ({
          ...m,
          _needsDecryption: true,
          _isDecrypted: false,
        })),
      ]);
      
      // ✅ Queue for decryption
      newMessages.forEach(msg => {
        decryptionQueue.current.push({
          messageId: msg._id,
          priority: msg.type === 'text' ? 'high' : 'normal',
          hasAttachments: msg.attachments?.length > 0,
        });
      });
      
      processDecryptionQueue();
      
      // ✅ Save to cache (encrypted)
      const toCache = newMessages.map(m => toCachedMessage(m, conversationId));
      await messageCacheService.saveMessages(toCache);
      
      // ✅ Update metadata
      await messageCacheService.updateConversationMeta({
        conversation_id: conversationId,
        last_sync_time: Date.now(),
        total_cached: messages.length + newMessages.length,
      });
    }
  }, [conversationId, messages.length]);

  // ✅ Initial load
  useEffect(() => {
    if (conversationId && isInitialized) {
      loadFromCache();
      fetchNewMessages();
    }
  }, [conversationId, isInitialized]);

  return {
    messages,
    decryptionProgress,
    isDecrypting: (msgId: string) => decryptionProgress.has(msgId),
    fetchNewMessages,
  };
};