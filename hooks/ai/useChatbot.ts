// mobile/hooks/ai/useChatbot.ts - COMPLETE
import { useLanguage } from "@/contexts/LanguageContext";
import { useSocket } from "@/hooks/message/useSocket";
import AIAPIService, {
  AIChatMessage,
  ConversationPreview,
  EmotionContext,
} from "@/lib/ai/AiAPIService";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  language?: "vi" | "en" | "zh";
  emotion?: string;
  timestamp: Date;
}

export const useChatbot = (initialConversationId?: string) => {
  const { getToken } = useAuth();
  const { language } = useLanguage();
  const { socket } = useSocket();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId || null
  );
  const [conversationTitle, setConversationTitle] = useState<string | null>(
    null
  );
  const [emotionContext, setEmotionContext] = useState<EmotionContext | null>(
    null
  );
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);

  const isLoadingHistory = useRef(false);
  const hasLoadedConversations = useRef(false);

  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("aiTyping", (data: any) => {
      // ✅ Chấp nhận typing cho conversation hiện tại hoặc conversation mới
      if (!conversationId || data.conversation_id === conversationId) {
        setTyping(data.is_typing);
      }
    });

    socket.on("aiChatResponse", (data: any) => {
      // ✅ FIX: Chấp nhận response cho conversation hiện tại HOẶC khi chưa có conversation
      if (!conversationId || data.conversation_id === conversationId) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message,
            language: data.language,
            timestamp: new Date(data.timestamp),
          },
        ]);
        setTyping(false);
        setLoading(false);

        // ✅ Cập nhật conversation_id nếu đây là conversation mới
        if (!conversationId && data.conversation_id) {
          setConversationId(data.conversation_id);
        }

        if (data.emotion_context) setEmotionContext(data.emotion_context);
      }
    });

    socket.on("aiChatError", (data: any) => {
      setError(data.error);
      setTyping(false);
      setLoading(false);
    });

    return () => {
      socket.off("aiTyping");
      socket.off("aiChatResponse");
      socket.off("aiChatError");
    };
  }, [socket, conversationId]);

  const sendMessage = useCallback(
    async (message: string) => {
      try {
        setLoading(true);
        setError(null);
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");
        if (!conversationId) {
          loadConversations();
        }
        setMessages((prev) => [
          ...prev,
          { role: "user", content: message, timestamp: new Date() },
        ]);
        const currentLang =
          language === "vi" ? "vi" : language === "zh" ? "zh" : "en";
        const response = await AIAPIService.sendMessage(
          token,
          message,
          conversationId || undefined,
          currentLang
        );

        if (response.success && response.data) {
          if (!conversationId) setConversationId(response.data.conversation_id);
          if (response.data.title) setConversationTitle(response.data.title);
          if (response.data.emotion_context)
            setEmotionContext(response.data.emotion_context);
          if (!socket) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: response.data.message,
                language: response.data.language,
                emotion: response.data.emotion_context?.emotion,
                timestamp: new Date(response.data.timestamp),
              },
            ]);
          }
          loadConversations();
          return response.data;
        } else {
          throw new Error(response.error || "Failed to send message");
        }
      } catch (err: any) {
        setError(err.message || "Failed to send message");
        console.error("❌ Send message error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getToken, language, conversationId, socket]
  );

  const loadHistory = useCallback(
    async (convId: string) => {
      if (isLoadingHistory.current) return;
      try {
        isLoadingHistory.current = true;
        setLoading(true);
        setError(null);
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");
        const response = await AIAPIService.getChatHistory(token, convId);
        if (response.success && response.data) {
          setMessages(
            response.data.messages.map((msg: AIChatMessage) => ({
              role: msg.role,
              content: msg.content,
              language: msg.language,
              emotion: msg.emotion,
              timestamp: new Date(msg.timestamp),
            }))
          );
          setConversationId(convId);
          if (response.data.title) setConversationTitle(response.data.title);
          if (response.data.emotion_context) {
            setEmotionContext({
              emotion: response.data.emotion_context.dominant_emotion,
              confidence: response.data.emotion_context.avg_confidence,
              trends: response.data.emotion_context.recent_emotions,
              intensity: response.data.emotion_context.avg_confidence,
            });
          }
        } else {
          throw new Error(response.error || "Failed to load history");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load history");
        console.error("❌ Load history error:", err);
      } finally {
        setLoading(false);
        isLoadingHistory.current = false;
      }
    },
    [getToken]
  );

  const loadConversations = useCallback(async () => {
    try {
      setConversationsLoading(true);
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const response = await AIAPIService.getAllConversations(token);
      if (response.success && response.data) {
        setConversations(response.data.conversations);
      }
    } catch (err: any) {
      console.error("❌ Load conversations error:", err);
    } finally {
      setConversationsLoading(false);
    }
  }, [getToken]);

  const deleteConversationHandler = useCallback(
    async (convId: string) => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");
        const response = await AIAPIService.deleteConversation(token, convId);
        if (response.success) {
          setConversations((prev) =>
            prev.filter((c) => c.conversation_id !== convId)
          );
          if (conversationId === convId) {
            setMessages([]);
            setConversationId(null);
            setConversationTitle(null);
            setEmotionContext(null);
            setError(null);
          }
        }
      } catch (err: any) {
        console.error("❌ Delete conversation error:", err);
      }
    },
    [getToken, conversationId]
  );
  const loadSmartSuggestions = useCallback(async () => {
    try {
      setSuggestionsLoading(true);
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const currentLang =
        language === "vi" ? "vi" : language === "zh" ? "zh" : "en";
      const response = await AIAPIService.getSmartSuggestions(
        token,
        currentLang,
        4
      );

      if (response.success && response.data) {
        setSmartSuggestions(response.data.suggestions);
      }
    } catch (err: any) {
      console.error("❌ Load suggestions error:", err);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [getToken, language]);
  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setConversationTitle(null);
    setEmotionContext(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!hasLoadedConversations.current) {
      hasLoadedConversations.current = true;
      loadConversations();
    }
  }, []);
  useEffect(() => {
    if (!conversationId) {
      loadSmartSuggestions();
    }
  }, [conversationId]);
  return {
    messages,
    sendMessage,
    loadHistory,
    clearConversation,
    conversations,
    loadConversations,
    deleteConversation: deleteConversationHandler,
    conversationsLoading,
    loading,
    typing,
    error,
    conversationId,
    conversationTitle,
    emotionContext,
    smartSuggestions,
    suggestionsLoading,
    loadSmartSuggestions,
  };
};
