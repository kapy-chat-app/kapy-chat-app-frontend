// hooks/ai/useOnDeviceAI.ts - USING LIGHTWEIGHT AI
import { useLanguage } from "@/contexts/LanguageContext";
import LightweightAI from "@/lib/ai/LightweightAI";
import { useCallback, useEffect, useState } from "react";

interface EmotionAnalysis {
  emotion: "joy" | "sadness" | "anger" | "fear" | "surprise" | "neutral";
  confidence: number;
  scores: {
    joy: number;
    sadness: number;
    anger: number;
    fear: number;
    surprise: number;
    neutral: number;
  };
  isToxic: boolean;
  toxicityScore: number;
  isExtreme: boolean;
}

interface ImageToxicity {
  isToxic: boolean;
  categories: string[];
  confidence: number;
}

export const useOnDeviceAI = () => {
  const { language } = useLanguage();
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // INIT LIGHTWEIGHT AI
  // ============================================
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        console.log("🤖 [AI] Initializing LightweightAI...");
        await LightweightAI.initialize();
        setIsReady(true);
        console.log("✅ [AI] LightweightAI ready!");
      } catch (err) {
        console.error("❌ [AI] Failed to init:", err);
        setError(
          err instanceof Error ? err.message : "Failed to initialize AI"
        );
        setIsReady(true); // Still set ready (fallback works)
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // ============================================
  // ANALYZE TEXT MESSAGE
  // ============================================
  const analyzeTextMessage = useCallback(
    async (text: string): Promise<EmotionAnalysis> => {
      if (!isReady) {
        throw new Error("AI not ready");
      }

      try {
        console.log(`🔍 Analyzing: "${text.substring(0, 50)}..."`);

        // Xác định ngôn ngữ
        const lang = language === "vi" ? "vi" : language === "zh" ? "zh" : "en";

        // ✅ Sử dụng LightweightAI
        const result = await LightweightAI.analyzeMessage(text, lang);

        console.log(
          `✅ LightAI: ${result.emotion} (${(result.confidence * 100).toFixed(
            0
          )}%)`
        );

        return {
          emotion: result.emotion,
          confidence: result.confidence,
          scores: {
            joy: result.scores.joy || 0,
            sadness: result.scores.sadness || 0,
            anger: result.scores.anger || 0,
            fear: result.scores.fear || 0,
            surprise: result.scores.surprise || 0,
            neutral: result.scores.neutral || 0,
          },
          isToxic: result.isToxic,
          toxicityScore: result.toxicityScore,
          isExtreme: result.isExtreme,
        };
      } catch (err) {
        console.error("❌ Analysis failed:", err);
        // Fallback to neutral
        return {
          emotion: "neutral",
          confidence: 0.5,
          scores: {
            joy: 0,
            sadness: 0,
            anger: 0,
            fear: 0,
            surprise: 0,
            neutral: 1,
          },
          isToxic: false,
          toxicityScore: 0,
          isExtreme: false,
        };
      }
    },
    [isReady, language]
  );

  // ============================================
  // CHECK IMAGE TOXICITY
  // ============================================
  const checkImageToxicity = useCallback(
    async (imageBase64: string, mimeType: string): Promise<ImageToxicity> => {
      if (!isReady) {
        console.warn("⚠️ AI not ready");
        return { isToxic: false, categories: [], confidence: 0 };
      }

      try {
        console.log("🖼️ Checking image...");

        // Convert base64 to temporary URI (nếu cần)
        const imageUri = `data:${mimeType};base64,${imageBase64}`;

        // ✅ Sử dụng LightweightAI
        const result = await LightweightAI.checkImageSafety(imageUri);

        console.log(`✅ Image: ${result.isToxic ? "⚠️ TOXIC" : "✅ Safe"}`);

        return {
          isToxic: result.isToxic,
          categories: result.categories,
          confidence: result.toxicityScore / 100,
        };
      } catch (err) {
        console.error("❌ Image check failed:", err);
        return { isToxic: false, categories: [], confidence: 0 };
      }
    },
    [isReady]
  );

  // ============================================
  // GENERATE RECOMMENDATIONS (OPTIONAL - Có thể giữ hoặc xóa)
  // ============================================
  const generateRecommendations = useCallback(async () => {
    // Placeholder - có thể implement sau
    return null;
  }, []);

  return {
    isReady,
    loading,
    error,
    analyzeTextMessage,
    checkImageToxicity,
    generateRecommendations,
  };
};
