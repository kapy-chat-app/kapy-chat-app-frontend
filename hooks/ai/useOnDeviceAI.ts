// hooks/ai/useOnDeviceAI.ts - WITH AUTO LANGUAGE DETECTION
import { NativeModules, Platform } from "react-native";
import { useCallback, useEffect, useState } from "react";

const { EmotionAI } = NativeModules;

interface EmotionAnalysis {
  emotion: "joy" | "sadness" | "anger" | "fear" | "surprise" | "love";
  confidence: number;
  scores: {
    joy: number;
    sadness: number;
    anger: number;
    fear: number;
    surprise: number;
    love: number;
  };
  isToxic: boolean;
  toxicityScore: number;
  isExtreme: boolean;
  detectedLanguage?: string; // ✅ NEW
  translatedText?: string; // ✅ NEW
}

interface ImageToxicity {
  isToxic: boolean;
  categories: string[];
  confidence: number;
}

export const useOnDeviceAI = () => {
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // INIT NATIVE MODULE
  // ============================================
  useEffect(() => {
    async function init() {
      if (Platform.OS !== "android") {
        console.warn("⚠️ [AI] EmotionAI only supports Android");
        setError("AI features only available on Android");
        setIsReady(false);
        return;
      }

      if (!EmotionAI) {
        console.error("❌ [AI] EmotionAI native module not found");
        setError("AI module not found. Did you rebuild the app?");
        setIsReady(false);
        return;
      }

      setLoading(true);
      try {
        console.log("🤖 [AI] Initializing EmotionAI with auto language detection...");
        
        const result = await EmotionAI.initialize();
        
        if (result?.success) {
          setIsReady(true);
          console.log("✅ [AI] EmotionAI ready with auto language detection!");
        } else {
          throw new Error("Initialization returned false");
        }
      } catch (err) {
        console.error("❌ [AI] Failed to initialize:", err);
        setError(
          err instanceof Error ? err.message : "Failed to initialize AI"
        );
        setIsReady(false);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // ============================================
  // ✅ ANALYZE TEXT - NO LANGUAGE PARAMETER NEEDED
  // ============================================
  const analyzeTextMessage = useCallback(
    async (text: string): Promise<EmotionAnalysis> => {
      if (!isReady || !EmotionAI) {
        console.warn("⚠️ [AI] Not ready, returning fallback");
        return getFallbackAnalysis();
      }

      if (!text || text.trim().length === 0) {
        return getFallbackAnalysis();
      }

      try {
        console.log(`🔍 [AI] Analyzing: "${text.substring(0, 50)}..."`);

        // ✅ AUTO DETECTION - No language parameter!
        const result = await EmotionAI.analyzeText(text);

        console.log(
          `✅ [AI] Result: ${result.emotion} (${(result.confidence * 100).toFixed(0)}%), Toxic: ${result.isToxic} (${result.toxicityScore}%)`
        );
        
        if (result.detectedLanguage) {
          console.log(`🌍 [AI] Detected language: ${result.detectedLanguage}`);
        }

        const isExtreme = result.toxicityScore >= 85;

        return {
          emotion: result.emotion,
          confidence: result.confidence,
          scores: result.scores,
          isToxic: result.isToxic,
          toxicityScore: result.toxicityScore,
          isExtreme,
          detectedLanguage: result.detectedLanguage,
          translatedText: result.translatedText,
        };
      } catch (err) {
        console.error("❌ [AI] Analysis failed:", err);
        return getFallbackAnalysis();
      }
    },
    [isReady]
  );

  // ============================================
  // CHECK IMAGE TOXICITY
  // ============================================
  const checkImageToxicity = useCallback(
    async (imageUri: string): Promise<ImageToxicity> => {
      if (!isReady || !EmotionAI) {
        console.warn("⚠️ [AI] Not ready, assuming image is safe");
        return { isToxic: false, categories: [], confidence: 0 };
      }

      try {
        console.log("🖼️ [AI] Checking image safety...");
        const result = await EmotionAI.analyzeImage(imageUri);
        console.log(`✅ [AI] Image: ${result.isToxic ? "⚠️ UNSAFE" : "✅ Safe"}`);

        return {
          isToxic: result.isToxic,
          categories: result.categories || [],
          confidence: result.confidence,
        };
      } catch (err) {
        console.error("❌ [AI] Image check failed:", err);
        return { isToxic: false, categories: [], confidence: 0 };
      }
    },
    [isReady]
  );

  // ============================================
  // HELPER: Get Fallback Analysis
  // ============================================
  const getFallbackAnalysis = (): EmotionAnalysis => {
    return {
      emotion: "joy",
      confidence: 0.5,
      scores: {
        joy: 0.5,
        sadness: 0.1,
        anger: 0.1,
        fear: 0.1,
        surprise: 0.1,
        love: 0.1,
      },
      isToxic: false,
      toxicityScore: 0,
      isExtreme: false,
    };
  };

  return {
    isReady,
    loading,
    error,
    analyzeTextMessage,
    checkImageToxicity,
  };
};