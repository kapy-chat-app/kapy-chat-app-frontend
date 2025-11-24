// hooks/ai/useOnDeviceAI.ts - WITH GLOBAL INIT & RATE LIMITING
import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useLanguage } from '@/contexts/LanguageContext';
import { Asset } from 'expo-asset';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

// ============================================
// ✅ GLOBAL STATE FOR ONNX (LOAD ONCE AT APP START)
// ============================================
let InferenceSession: any = null;
let Tensor: any = null;
let isONNXAvailable = false;
let isONNXLoading = false;

// ✅ NEW: Global ONNX models (shared across all hooks)
let globalONNXReady = false;
let globalEmotionSession: any = null;
let globalToxicitySession: any = null;

// ============================================
// LOAD ONNX RUNTIME (ONCE)
// ============================================
const loadONNXRuntime = async () => {
  if (globalONNXReady) {
    console.log('✅ [ONNX] Already loaded globally');
    return true;
  }
  
  if (isONNXAvailable) return true;
  
  if (isONNXLoading) {
    let attempts = 0;
    while (isONNXLoading && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    return isONNXAvailable;
  }
  
  isONNXLoading = true;
  
  try {
    console.log('🔄 [ONNX] Loading ONNX Runtime...');
    const onnx = require('onnxruntime-react-native');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    InferenceSession = onnx.InferenceSession;
    Tensor = onnx.Tensor;
    
    if (!InferenceSession || !Tensor) {
      throw new Error('ONNX modules not available');
    }
    
    // Test tensor creation
    try {
      const testTensor = new Tensor('float32', new Float32Array([1, 2, 3]), [1, 3]);
      console.log('✅ [ONNX] Tensor test passed');
    } catch (testErr) {
      throw new Error('ONNX Tensor creation failed');
    }
    
    isONNXAvailable = true;
    console.log('✅ [ONNX] Runtime loaded successfully');
    return true;
  } catch (error) {
    console.warn('⚠️ [ONNX] Runtime not available:', error);
    isONNXAvailable = false;
    return false;
  } finally {
    isONNXLoading = false;
  }
};

// ============================================
// ✅ NEW: LOAD ONNX MODELS GLOBALLY (AT APP START)
// ============================================
const loadONNXModelsGlobally = async () => {
  if (globalONNXReady) {
    console.log('✅ [ONNX] Models already loaded globally');
    return true;
  }

  try {
    const onnxLoaded = await loadONNXRuntime();

    if (onnxLoaded && InferenceSession) {
      console.log('📦 [ONNX] Loading models globally...');

      // ✅ CORRECT: Use native execution providers for React Native
      const sessionOptions = {
        executionProviders: ['cpu'], // ✅ Use CPU backend (always available)
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
      };

      // Load Emotion Model
      try {
        const emotionAsset = Asset.fromModule(
          require('../../assets/models/emotion/emotion.onnx')
        );
        await emotionAsset.downloadAsync();
        
        console.log('📥 [ONNX] Emotion asset downloaded:', emotionAsset.localUri);
        
        // ✅ Create session with CPU backend
        globalEmotionSession = await InferenceSession.create(
          emotionAsset.localUri || emotionAsset.uri,
          sessionOptions
        );
        console.log('✅ [ONNX] Emotion model loaded (CPU backend)');
      } catch (err: any) {
        console.warn('⚠️ [ONNX] Emotion model not available');
        console.error('[ONNX Error Details]:', err.message || err);
      }

      // Load Toxicity Model
      try {
        const toxicityAsset = Asset.fromModule(
          require('../../assets/models/toxicity/toxicity.onnx')
        );
        await toxicityAsset.downloadAsync();
        
        console.log('📥 [ONNX] Toxicity asset downloaded:', toxicityAsset.localUri);
        
        globalToxicitySession = await InferenceSession.create(
          toxicityAsset.localUri || toxicityAsset.uri,
          sessionOptions
        );
        console.log('✅ [ONNX] Toxicity model loaded (CPU backend)');
      } catch (err: any) {
        console.warn('⚠️ [ONNX] Toxicity model not available');
        console.error('[ONNX Error Details]:', err.message || err);
      }

      globalONNXReady = globalEmotionSession !== null || globalToxicitySession !== null;
      console.log('✅ [ONNX] Models loaded:', {
        emotion: globalEmotionSession ? '✅' : '❌',
        toxicity: globalToxicitySession ? '✅' : '❌',
      });
      
      return globalONNXReady;
    }

    return false;
  } catch (error: any) {
    console.error('❌ [ONNX] Failed to load models:', error.message || error);
    return false;
  }
};


// ============================================
// ONNX INFERENCE WITH RETRY
// ============================================
const runONNXWithRetry = async (
  session: any,
  feeds: any,
  maxRetries: number = 3
): Promise<any> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await session.run(feeds);
      return result;
    } catch (error) {
      console.warn(`⚠️ ONNX inference failed (attempt ${i + 1}/${maxRetries}):`, error);
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
    }
  }
  throw new Error('ONNX inference max retries exceeded');
};

// ============================================
// RATE LIMITER
// ============================================
class RateLimiter {
  private lastCall: number = 0;
  private minInterval: number = 5000;

  async throttle() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    
    if (timeSinceLastCall < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastCall;
      console.log(`⏳ Rate limiting: waiting ${(waitTime / 1000).toFixed(1)}s`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCall = Date.now();
  }
}

// ============================================
// TYPES
// ============================================
interface EmotionAnalysis {
  emotion: 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'neutral';
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

interface Recommendation {
  message: string;
  tips: string[];
}

// ============================================
// TOKENIZER FOR ONNX
// ============================================
class SimpleTokenizer {
  private vocab: Map<string, number>;
  private maxLength: number = 128;

  constructor() {
    this.vocab = new Map();
    this.buildVocab();
  }

  private buildVocab() {
    const words = [
      '[PAD]', '[UNK]', '[CLS]', '[SEP]',
      'happy', 'sad', 'angry', 'fear', 'surprise', 'joy', 'love', 'hate',
      'good', 'bad', 'great', 'terrible', 'wonderful', 'awful',
      'vui', 'buồn', 'giận', 'sợ', 'ngạc', 'nhiên', 'yêu', 'ghét',
      'tốt', 'xấu', 'tuyệt', 'kinh', 'khủng',
      '开心', '难过', '生气', '害怕', '惊讶', '爱', '恨',
      '好', '坏', '太好了', '可怕',
      'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'am', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did',
      'the', 'a', 'an', 'this', 'that', 'these', 'those',
      'my', 'your', 'his', 'her', 'its', 'our', 'their',
      'not', 'no', 'yes', 'very', 'so', 'too', 'much',
      '.', ',', '!', '?', '-', '\'', '"',
    ];

    words.forEach((word, idx) => {
      this.vocab.set(word.toLowerCase(), idx);
    });
  }

  encode(text: string): { input_ids: number[]; attention_mask: number[] } {
    const tokens = text.toLowerCase().split(/\s+/);
    const input_ids: number[] = [2];
    const attention_mask: number[] = [1];

    for (const token of tokens) {
      if (input_ids.length >= this.maxLength - 1) break;
      const id = this.vocab.get(token) || 1;
      input_ids.push(id);
      attention_mask.push(1);
    }

    input_ids.push(3);
    attention_mask.push(1);

    while (input_ids.length < this.maxLength) {
      input_ids.push(0);
      attention_mask.push(0);
    }

    return { input_ids, attention_mask };
  }
}

// ============================================
// RULE-BASED FALLBACK
// ============================================
const analyzeWithRules = (text: string): EmotionAnalysis => {
  const lowerText = text.toLowerCase();
  
  const joyWords = [
    'happy', 'joy', 'great', 'wonderful', 'love', 'excellent', 'amazing', 'good', 'nice', 'glad',
    'vui', 'hạnh phúc', 'tuyệt', 'thích', 'yêu', 'tốt',
    '开心', '高兴', '快乐', '幸福', '喜欢', '爱',
    '😊', '😄', '😁', '❤️', '💕', '🥰'
  ];
  
  const sadWords = [
    'sad', 'unhappy', 'depressed', 'cry', 'miss', 'lonely', 'hurt', 'pain',
    'buồn', 'khóc', 'cô đơn', 'nhớ', 'đau',
    '难过', '伤心', '哭', '痛苦', '孤独',
    '😢', '😭', '💔', '😞'
  ];
  
  const angerWords = [
    'angry', 'mad', 'furious', 'hate', 'annoyed', 'pissed', 'irritated',
    'giận', 'tức', 'ghét', 'bực', 'điên',
    '生气', '愤怒', '恨', '讨厌',
    '😠', '😡', '🤬', '💢'
  ];
  
  const fearWords = [
    'scared', 'afraid', 'fear', 'worried', 'anxious', 'nervous', 'panic',
    'sợ', 'lo', 'lo lắng', 'hoảng', 'sợ hãi',
    '害怕', '担心', '焦虑', '恐惧',
    '😨', '😰', '😱', '🥶'
  ];
  
  const surpriseWords = [
    'wow', 'omg', 'shocking', 'surprised', 'unexpected', 'amazing',
    'ôi', 'trời', 'ngạc nhiên', 'bất ngờ',
    '哇', '惊讶', '意外', '震惊',
    '😮', '😲', '🤯', '😯'
  ];
  
  const toxicWords = [
    'fuck', 'shit', 'damn', 'bitch', 'asshole', 'idiot', 'stupid', 'hate',
    'địt', 'lồn', 'cặc', 'đụ', 'dm', 'đm', 'cc', 'vl',
    '操', '妈的', '他妈', '傻逼', '草'
  ];

  const scores = {
    joy: joyWords.filter(w => lowerText.includes(w)).length,
    sadness: sadWords.filter(w => lowerText.includes(w)).length,
    anger: angerWords.filter(w => lowerText.includes(w)).length,
    fear: fearWords.filter(w => lowerText.includes(w)).length,
    surprise: surpriseWords.filter(w => lowerText.includes(w)).length,
    neutral: 0,
  };

  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const normalizedScores = {
    joy: scores.joy / total,
    sadness: scores.sadness / total,
    anger: scores.anger / total,
    fear: scores.fear / total,
    surprise: scores.surprise / total,
    neutral: total === 0 ? 1 : 0,
  };

  let emotion: EmotionAnalysis['emotion'] = 'neutral';
  let confidence = 0.5;

  if (total > 0) {
    const maxEmotion = Object.entries(normalizedScores).reduce((a, b) => 
      b[1] > a[1] ? b : a
    );
    emotion = maxEmotion[0] as EmotionAnalysis['emotion'];
    confidence = Math.min(0.9, maxEmotion[1] * 2);
  }

  const toxicCount = toxicWords.filter(w => lowerText.includes(w)).length;
  const isToxic = toxicCount > 0;
  const toxicityScore = Math.min(100, toxicCount * 40);

  const isExtreme = confidence > 0.75 && (emotion === 'anger' || emotion === 'sadness');

  return {
    emotion,
    confidence,
    scores: normalizedScores,
    isToxic,
    toxicityScore,
    isExtreme,
  };
};

// ============================================
// MAIN HOOK
// ============================================
export const useOnDeviceAI = () => {
  const { language } = useLanguage();
  
  // ✅ CHANGED: Start with globalONNXReady state
  const [isReady, setIsReady] = useState(globalONNXReady);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ CHANGED: Use global sessions
  const emotionSession = useRef<any>(globalEmotionSession);
  const toxicitySession = useRef<any>(globalToxicitySession);
  const tokenizer = useRef<SimpleTokenizer | null>(null);
  
  const geminiAI = useRef<GoogleGenerativeAI | null>(null);
  const geminiModel = useRef<any>(null);
  const rateLimiter = useRef<RateLimiter>(new RateLimiter());

  // ============================================
  // ✅ CHANGED: INIT ONCE AT APP START
  // ============================================
  useEffect(() => {
    if (!globalONNXReady) {
      initModels();
    } else {
      // ✅ Use already loaded global models
      console.log('✅ [AI Hook] Using globally loaded ONNX models');
      emotionSession.current = globalEmotionSession;
      toxicitySession.current = globalToxicitySession;
      tokenizer.current = new SimpleTokenizer();
      setIsReady(true);
    }
  }, []);

  const initModels = async () => {
    try {
      setLoading(true);
      console.log('🤖 [AI Hook] Initializing AI models...');

      // 1. Init Tokenizer
      tokenizer.current = new SimpleTokenizer();
      console.log('✅ [AI Hook] Tokenizer ready');

      // 2. ✅ Load ONNX models globally
      try {
        const onnxSuccess = await loadONNXModelsGlobally();

        if (onnxSuccess) {
          emotionSession.current = globalEmotionSession;
          toxicitySession.current = globalToxicitySession;
        }
      } catch (onnxError) {
        console.warn('⚠️ [AI Hook] ONNX completely unavailable, using rule-based:', onnxError);
      }

      // 3. Init Gemini (optional)
      if (GEMINI_API_KEY) {
        try {
          geminiAI.current = new GoogleGenerativeAI(GEMINI_API_KEY);
          geminiModel.current = geminiAI.current.getGenerativeModel({ 
            model: 'gemini-1.5-flash'
          });
          console.log('✅ [AI Hook] Gemini AI initialized (gemini-1.5-flash)');
        } catch (err) {
          console.warn('⚠️ [AI Hook] Gemini init failed:', err);
        }
      } else {
        console.warn('⚠️ [AI Hook] Gemini API key not found');
      }

      setIsReady(true);
      console.log('✅ [AI Hook] AI ready! (ONNX:', isONNXAvailable, ', Gemini:', !!geminiModel.current, ')');
    } catch (err) {
      console.error('❌ [AI Hook] Failed to init AI:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize AI');
      setIsReady(true);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // GEMINI WITH RETRY & RATE LIMITING
  // ============================================
  const callGeminiWithRetry = async (
    prompt: any,
    maxRetries: number = 3
  ): Promise<any> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await rateLimiter.current.throttle();
        
        const result = await geminiModel.current.generateContent(prompt);
        return result;
        
      } catch (err: any) {
        const errorMessage = err?.message || '';
        
        if (errorMessage.includes('429') || errorMessage.includes('quota')) {
          const retryMatch = errorMessage.match(/retry in ([\d.]+)s/i);
          const retryDelay = retryMatch 
            ? parseFloat(retryMatch[1]) * 1000 
            : 20000;
          
          console.warn(`⚠️ Quota exceeded. Retry ${i + 1}/${maxRetries} in ${(retryDelay / 1000).toFixed(0)}s`);
          
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }
        
        throw err;
      }
    }
    
    throw new Error('Max retries exceeded');
  };

  // ============================================
  // ANALYZE TEXT MESSAGE
  // ============================================
  const analyzeTextMessage = useCallback(async (text: string): Promise<EmotionAnalysis> => {
    if (!isReady) {
      throw new Error('AI not ready');
    }

    try {
      console.log(`🔍 Analyzing: "${text.substring(0, 50)}..."`);

      // Try ONNX first if available
      if (isONNXAvailable && emotionSession.current && tokenizer.current && Tensor) {
        try {
          const { input_ids, attention_mask } = tokenizer.current.encode(text);

          if (input_ids.length === 0 || attention_mask.length === 0) {
            throw new Error('Invalid tokenization result');
          }

          const inputIdsTensor = new Tensor(
            'int64', 
            BigInt64Array.from(input_ids.map(BigInt)), 
            [1, input_ids.length]
          );
          const attentionMaskTensor = new Tensor(
            'int64', 
            BigInt64Array.from(attention_mask.map(BigInt)), 
            [1, attention_mask.length]
          );

          const feeds = {
            input_ids: inputIdsTensor,
            attention_mask: attentionMaskTensor,
          };

          const results = await runONNXWithRetry(emotionSession.current, feeds);
          
          if (!results || !results.logits || !results.logits.data) {
            throw new Error('Invalid ONNX inference result');
          }
          
          const logits = results.logits.data as Float32Array;

          if (logits.length < 6) {
            throw new Error('Invalid logits length');
          }

          const emotions: EmotionAnalysis['emotion'][] = [
            'joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral'
          ];
          const scores = Array.from(logits.slice(0, 6));
          
          if (scores.some(s => !isFinite(s))) {
            throw new Error('Invalid score values (NaN/Infinity)');
          }
          
          const expScores = scores.map(s => Math.exp(s));
          const sumExp = expScores.reduce((a, b) => a + b, 0);
          
          if (sumExp === 0 || !isFinite(sumExp)) {
            throw new Error('Invalid softmax sum');
          }
          
          const probabilities = expScores.map(s => s / sumExp);

          const maxIdx = probabilities.indexOf(Math.max(...probabilities));
          const emotion = emotions[maxIdx];
          const confidence = probabilities[maxIdx];

          console.log(`✅ ONNX: ${emotion} (${(confidence * 100).toFixed(0)}%)`);

          const toxicCheck = analyzeWithRules(text);

          return {
            emotion,
            confidence,
            scores: {
              joy: probabilities[0],
              sadness: probabilities[1],
              anger: probabilities[2],
              fear: probabilities[3],
              surprise: probabilities[4],
              neutral: probabilities[5],
            },
            isToxic: toxicCheck.isToxic,
            toxicityScore: toxicCheck.toxicityScore,
            isExtreme: confidence > 0.75 && (emotion === 'anger' || emotion === 'sadness'),
          };
        } catch (onnxError) {
          console.warn('⚠️ ONNX failed, using rules:', onnxError);
          if (onnxError instanceof Error && 
              (onnxError.message.includes('not available') || 
               onnxError.message.includes('Invalid'))) {
            isONNXAvailable = false;
            console.warn('⚠️ ONNX marked as unavailable');
          }
        }
      }

      const result = analyzeWithRules(text);
      console.log(`✅ Rules: ${result.emotion} (${(result.confidence * 100).toFixed(0)}%)`);
      return result;

    } catch (err) {
      console.error('❌ Analysis failed:', err);
      return {
        emotion: 'neutral',
        confidence: 0.5,
        scores: { joy: 0, sadness: 0, anger: 0, fear: 0, surprise: 0, neutral: 1 },
        isToxic: false,
        toxicityScore: 0,
        isExtreme: false,
      };
    }
  }, [isReady]);

  // ============================================
  // CHECK IMAGE TOXICITY
  // ============================================
  const checkImageToxicity = useCallback(async (
    imageBase64: string,
    mimeType: string
  ): Promise<ImageToxicity> => {
    if (!geminiModel.current) {
      console.warn('⚠️ Gemini not available for image check');
      return { isToxic: false, categories: [], confidence: 0 };
    }

    try {
      console.log('🖼️ Checking image...');

      const prompt = `Analyze this image for inappropriate content.

Respond ONLY with valid JSON:
{
  "isToxic": boolean,
  "categories": [],
  "confidence": 0-100
}`;

      const result = await callGeminiWithRetry([
        { inlineData: { data: imageBase64, mimeType } },
        prompt,
      ]);

      const text = result.response.text();
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analysis = JSON.parse(cleaned);

      console.log('✅ Image:', analysis.isToxic ? '⚠️ TOXIC' : '✅ Safe');
      return analysis;
    } catch (err) {
      console.error('❌ Image check failed:', err);
      return { isToxic: false, categories: [], confidence: 0 };
    }
  }, []);

  // ============================================
  // GENERATE RECOMMENDATIONS
  // ============================================
  const generateRecommendations = useCallback(async (
    recentEmotions: Array<{ emotion: string; confidence: number; text: string }>,
    currentLanguage: 'en' | 'vi' | 'zh' = 'en'
  ): Promise<Recommendation | null> => {
    if (!geminiModel.current) {
      console.warn('⚠️ Gemini not available for recommendations');
      return null;
    }

    try {
      console.log(`💡 Generating recommendations (${currentLanguage})...`);

      const langMap = { en: 'English', vi: 'Vietnamese', zh: 'Chinese' };

      const prompt = `You are an empathetic AI counselor. Based on recent emotions, provide support.

Recent emotions:
${recentEmotions.map((e, i) => `${i + 1}. ${e.emotion} (${(e.confidence * 100).toFixed(0)}%): "${e.text.substring(0, 100)}"`).join('\n')}

Respond in ${langMap[currentLanguage]} with JSON:
{
  "message": "supportive message",
  "tips": ["tip1", "tip2", "tip3"]
}`;

      const result = await callGeminiWithRetry(prompt);
      const text = result.response.text();
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      console.error('❌ Recommendations failed:', err);
      return null;
    }
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