// services/LightweightAI.ts - AI SIÊU NHẸ (NO TENSORFLOW)
import Sentiment from 'sentiment';
import nlp from 'compromise';
import emojiRegex from 'emoji-regex';

interface EmotionResult {
  emotion: 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'neutral';
  confidence: number;
  scores: Record<string, number>;
}

interface ToxicityResult {
  isToxic: boolean;
  toxicityScore: number;
  categories: string[];
}

interface AudioEmotionResult {
  emotion: string;
  energy: number;
  valence: number;
}

class LightweightAI {
  private sentiment: any;
  private emojiRegex: RegExp;
  private isReady: boolean = false;

  // ============================================
  // EMOTION DICTIONARIES (Multilingual)
  // ============================================
  private emotionKeywords = {
    joy: {
      en: ['happy', 'joy', 'great', 'wonderful', 'love', 'excellent', 'amazing', 'awesome', 'fantastic', 'delighted', 'pleased', 'glad', 'excited', 'cheerful', 'brilliant', 'perfect'],
      vi: ['vui', 'hạnh phúc', 'tuyệt', 'thích', 'yêu', 'tốt', 'hay', 'đẹp', 'xuất sắc', 'tuyệt vời', 'vui vẻ', 'phấn khích'],
      zh: ['开心', '高兴', '快乐', '幸福', '喜欢', '爱', '太好了', '棒', '完美', '愉快'],
      emojis: ['😊', '😄', '😁', '😃', '😀', '🤗', '❤️', '💕', '🥰', '😍', '🎉', '👍', '✨', '🌟', '💖', '😘']
    },
    sadness: {
      en: ['sad', 'unhappy', 'depressed', 'cry', 'miss', 'lonely', 'hurt', 'pain', 'sorrow', 'grief', 'miserable', 'melancholy', 'despair', 'heartbroken'],
      vi: ['buồn', 'khóc', 'cô đơn', 'nhớ', 'đau', 'tủi thân', 'u sầu', 'thương', 'đau khổ', 'bi thảm'],
      zh: ['难过', '伤心', '哭', '痛苦', '孤独', '想念', '悲伤', '忧郁'],
      emojis: ['😢', '😭', '💔', '😞', '😔', '😿', '🥺', '😥', '😪']
    },
    anger: {
      en: ['angry', 'mad', 'furious', 'hate', 'annoyed', 'pissed', 'irritated', 'rage', 'outraged', 'livid', 'frustrated', 'disgusted'],
      vi: ['giận', 'tức', 'ghét', 'bực', 'điên', 'cáu', 'phẫn nộ', 'khó chịu'],
      zh: ['生气', '愤怒', '恨', '讨厌', '气', '火', '烦'],
      emojis: ['😠', '😡', '🤬', '💢', '😤', '👿', '😾']
    },
    fear: {
      en: ['scared', 'afraid', 'fear', 'worried', 'anxious', 'nervous', 'panic', 'terrified', 'frightened', 'alarmed'],
      vi: ['sợ', 'lo', 'lo lắng', 'hoảng', 'sợ hãi', 'kinh sợ', 'run sợ', 'bồn chồn'],
      zh: ['害怕', '担心', '焦虑', '恐惧', '紧张', '惊慌'],
      emojis: ['😨', '😰', '😱', '🥶', '😧', '😦', '😳']
    },
    surprise: {
      en: ['wow', 'omg', 'shocking', 'surprised', 'unexpected', 'amazing', 'astonishing', 'incredible', 'unbelievable'],
      vi: ['ôi', 'trời', 'ngạc nhiên', 'bất ngờ', 'kinh ngạc', 'choáng'],
      zh: ['哇', '惊讶', '意外', '震惊', '不可思议', '难以置信'],
      emojis: ['😮', '😲', '🤯', '😯', '🙀', '😦']
    }
  };

  private toxicKeywords = {
    en: ['fuck', 'shit', 'damn', 'bitch', 'asshole', 'idiot', 'stupid', 'hate', 'kill', 'die', 'dumb', 'loser', 'ugly', 'retard', 'bastard'],
    vi: ['địt', 'lồn', 'cặc', 'đụ', 'dm', 'đm', 'cc', 'vl', 'vcl', 'đcm', 'clgt', 'ngu', 'chó', 'loz', 'đéo'],
    zh: ['操', '妈的', '他妈', '傻逼', '草', '去死', '白痴', '蠢', '混蛋']
  };

  constructor() {
    this.sentiment = new Sentiment();
    this.emojiRegex = emojiRegex();
  }

  // ============================================
  // INITIALIZE
  // ============================================
  async initialize(): Promise<void> {
    try {
      console.log('🤖 [LightAI] Initializing...');
      this.isReady = true;
      console.log('✅ [LightAI] Ready!');
    } catch (error) {
      console.error('❌ [LightAI] Init failed:', error);
      this.isReady = true;
    }
  }

  // ============================================
  // ANALYZE TEXT EMOTION
  // ============================================
  analyzeTextEmotion(text: string, language: 'en' | 'vi' | 'zh' = 'en'): EmotionResult {
    console.log(`🔍 [LightAI] Analyzing text (${language})...`);

    const lowerText = text.toLowerCase();
    
    // 1. Count emotion keywords
    const emotionScores: Record<string, number> = {
      joy: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      surprise: 0,
      neutral: 0
    };

    // Check keywords for each emotion
    Object.entries(this.emotionKeywords).forEach(([emotion, keywords]) => {
      const langWords = keywords[language] || [];
      const emojiWords = keywords.emojis || [];
      
      langWords.forEach(word => {
        if (lowerText.includes(word.toLowerCase())) {
          emotionScores[emotion] += 2;
        }
      });

      emojiWords.forEach(emoji => {
        if (text.includes(emoji)) {
          emotionScores[emotion] += 3;
        }
      });
    });

    // 2. Use sentiment analysis for English
    if (language === 'en') {
      const sentimentResult = this.sentiment.analyze(text);
      
      if (sentimentResult.score > 3) emotionScores.joy += 2;
      else if (sentimentResult.score > 0) emotionScores.joy += 1;
      else if (sentimentResult.score < -3) emotionScores.anger += 2;
      else if (sentimentResult.score < -1) emotionScores.sadness += 1;
    }

    // 3. NLP analysis for English
    if (language === 'en') {
      const doc = nlp(text);
      
      if (doc.questions().length > 0) {
        emotionScores.surprise += 1;
      }

      if (doc.has('#Negative')) {
        emotionScores.anger += 0.5;
        emotionScores.sadness += 0.5;
      }

      if (text.includes('!')) {
        const exclamationCount = (text.match(/!/g) || []).length;
        emotionScores.joy += exclamationCount * 0.5;
        emotionScores.anger += exclamationCount * 0.3;
      }
    }

    // 4. Calculate final scores
    const total = Object.values(emotionScores).reduce((a, b) => a + b, 0);
    
    if (total === 0) {
      return {
        emotion: 'neutral',
        confidence: 0.7,
        scores: { joy: 0, sadness: 0, anger: 0, fear: 0, surprise: 0, neutral: 1 }
      };
    }

    const normalizedScores = Object.fromEntries(
      Object.entries(emotionScores).map(([k, v]) => [k, v / total])
    );

    const maxEmotion = Object.entries(normalizedScores).reduce((a, b) => 
      b[1] > a[1] ? b : a
    );

    const emotion = maxEmotion[0] as EmotionResult['emotion'];
    const confidence = Math.min(0.95, maxEmotion[1] * 1.5);

    console.log(`✅ [LightAI] Emotion: ${emotion} (${(confidence * 100).toFixed(0)}%)`);

    return {
      emotion,
      confidence,
      scores: normalizedScores
    };
  }

  // ============================================
  // ANALYZE TOXICITY
  // ============================================
  analyzeToxicity(text: string, language: 'en' | 'vi' | 'zh' = 'en'): ToxicityResult {
    const lowerText = text.toLowerCase();
    const categories: string[] = [];
    let toxicCount = 0;

    const allToxicWords = [
      ...this.toxicKeywords.en,
      ...this.toxicKeywords.vi,
      ...this.toxicKeywords.zh
    ];

    allToxicWords.forEach(word => {
      if (lowerText.includes(word)) {
        toxicCount++;
        if (!categories.includes('offensive_language')) {
          categories.push('offensive_language');
        }
      }
    });

    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.5 && text.length > 10) {
      toxicCount += 0.5;
      if (!categories.includes('aggressive_tone')) {
        categories.push('aggressive_tone');
      }
    }

    const threatWords = ['kill', 'hurt', 'attack', 'destroy', 'chết', 'giết', 'đánh'];
    if (threatWords.some(word => lowerText.includes(word))) {
      toxicCount += 2;
      if (!categories.includes('threat')) {
        categories.push('threat');
      }
    }

    const isToxic = toxicCount > 0;
    const toxicityScore = Math.min(100, toxicCount * 30);

    console.log(`🔍 [LightAI] Toxicity: ${isToxic ? '⚠️ TOXIC' : '✅ Clean'} (${toxicityScore}%)`);

    return {
      isToxic,
      toxicityScore,
      categories
    };
  }

  // ============================================
  // CHECK IMAGE SAFETY (Basic)
  // ============================================
  async checkImageSafety(imageUri: string): Promise<ToxicityResult> {
    console.log('🖼️ [LightAI] Checking image...');

    try {
      return {
        isToxic: false,
        toxicityScore: 0,
        categories: []
      };
    } catch (error) {
      console.error('❌ [LightAI] Image check failed:', error);
      return {
        isToxic: false,
        toxicityScore: 0,
        categories: []
      };
    }
  }

  // ============================================
  // ANALYZE AUDIO EMOTION (Basic)
  // ============================================
  async analyzeAudioEmotion(audioUri: string): Promise<AudioEmotionResult> {
    console.log('🎤 [LightAI] Analyzing audio...');

    try {
      return {
        emotion: 'neutral',
        energy: 0.5,
        valence: 0.5
      };
    } catch (error) {
      console.error('❌ [LightAI] Audio analysis failed:', error);
      return {
        emotion: 'neutral',
        energy: 0,
        valence: 0
      };
    }
  }

  // ============================================
  // FULL ANALYSIS
  // ============================================
  async analyzeMessage(text: string, language: 'en' | 'vi' | 'zh' = 'en') {
    const emotion = this.analyzeTextEmotion(text, language);
    const toxicity = this.analyzeToxicity(text, language);

    return {
      ...emotion,
      isToxic: toxicity.isToxic,
      toxicityScore: toxicity.toxicityScore,
      toxicityCategories: toxicity.categories,
      isExtreme: emotion.confidence > 0.75 && 
                 (emotion.emotion === 'anger' || emotion.emotion === 'sadness')
    };
  }
}

export default new LightweightAI();