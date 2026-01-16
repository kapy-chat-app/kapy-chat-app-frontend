export const emotionLottieMap: Record<string, any> = {
  joy: require("@/assets/lottie/emotions/joy.json"),
  happy: require("@/assets/lottie/emotions/joy.json"),

  sadness: require("@/assets/lottie/emotions/sad.json"),
  sad: require("@/assets/lottie/emotions/sad.json"),

  anger: require("@/assets/lottie/emotions/angry.json"),

  fear: require("@/assets/lottie/emotions/anxious.json"),
  anxious: require("@/assets/lottie/emotions/anxious.json"),

  stressed: require("@/assets/lottie/emotions/stressed.json"),

  surprise: require("@/assets/lottie/emotions/surprise.json"),

  neutral: require("@/assets/lottie/emotions/neutral.json"),
};

export const getEmotionLottie = (emotion?: string) => {
  const key = (emotion ?? "neutral").toLowerCase();
  return emotionLottieMap[key] ?? emotionLottieMap.neutral;
};
