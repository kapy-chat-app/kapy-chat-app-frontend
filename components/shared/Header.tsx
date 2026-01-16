// components/shared/Header.tsx - FIXED INFINITE RERENDER
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState, useRef } from "react";
import { Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useEmotion, EmotionCounselingData } from "@/hooks/ai/useEmotion";
import { useSocket } from "@/hooks/message/useSocket";
import { useRouter } from "expo-router";
import FloatingRecommendation from "@/components/page/ai/FloatingRecommendation";

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
  onMenuPress?: () => void;
  showFloatingRec?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showBackButton = false,
  onBackPress,
  rightComponent,
  onMenuPress,
  showFloatingRec = false,
}) => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const router = useRouter();
  const { socket } = useSocket();
  const { getEmotionCounseling } = useEmotion({ days: 7 });

  const [showFloating, setShowFloating] = useState(false);
  const [counselingData, setCounselingData] = useState<EmotionCounselingData | null>(null);
  const [counselingLoading, setCounselingLoading] = useState(false);

  // ✅ FIX 1: Debounce loading to prevent rapid calls
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadTimeRef = useRef<number>(0);
  const LOAD_COOLDOWN = 5000; // 5 seconds minimum between loads

  // ✅ FIX 2: Memoize loadCounselingData with stable dependencies
  const loadCounselingData = useCallback(async () => {
    if (!showFloatingRec) return;

    // ✅ Prevent rapid successive calls
    const now = Date.now();
    if (now - lastLoadTimeRef.current < LOAD_COOLDOWN) {
      console.log("📊 [Header] Skipping - too soon since last load");
      return;
    }

    setCounselingLoading(true);
    lastLoadTimeRef.current = now;

    try {
      const result = await getEmotionCounseling(7);
      if (result.success && result.data) {
        setCounselingData(result.data);
        console.log("📊 [Header] Counseling data loaded:", {
          hasData: result.data.hasData,
          emotion: result.data.currentEmotion,
          recommendationCount: result.data.recommendations?.length || 0,
        });
      } else {
        console.error("❌ [Header] Failed to load counseling:", result.error);
      }
    } catch (error) {
      console.error("❌ [Header] Error loading counseling:", error);
    } finally {
      setCounselingLoading(false);
    }
  }, [showFloatingRec]); // ✅ Remove getEmotionCounseling from deps

  // ✅ FIX 3: Load only once on mount
  useEffect(() => {
    if (showFloatingRec) {
      console.log("📊 [Header] Initial load");
      loadCounselingData();
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [showFloatingRec]); // ✅ Only depend on showFloatingRec

  // ✅ FIX 4: Debounced socket handler
  useEffect(() => {
    if (!socket || !showFloatingRec) return;

    const handleEmotionUpdate = () => {
      console.log("🎯 [Header] Emotion update received");

      // ✅ Clear existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // ✅ Debounce: wait 2 seconds before reloading
      loadingTimeoutRef.current = setTimeout(() => {
        console.log("🔄 [Header] Debounced reload");
        loadCounselingData();
      }, 2000);
    };

    socket.on("emotionAnalysisComplete", handleEmotionUpdate);
    socket.on("emotionAnalyzedWithRecommendations", handleEmotionUpdate);

    return () => {
      socket.off("emotionAnalysisComplete", handleEmotionUpdate);
      socket.off("emotionAnalyzedWithRecommendations", handleEmotionUpdate);
      
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [socket, showFloatingRec]); // ✅ Don't include loadCounselingData

  const toggleFloating = useCallback(() => {
    setShowFloating(prev => !prev);
  }, []);

  const handleViewFullCounseling = useCallback(() => {
    setShowFloating(false);
    router.push("/(tabs)/emotion");
  }, [router]);

  // ✅ FIX 5: Memoize hasRecommendations
  const hasRecommendations = React.useMemo(() => 
    counselingData?.recommendations && counselingData.recommendations.length > 0,
    [counselingData?.recommendations]
  );

  return (
    <>
      <View 
        className={`flex-row items-center px-4 py-3 min-h-[60px] ${
          isDark ? 'bg-black' : 'bg-white'
        }`}
      >
        <View className="w-10">
          {showBackButton ? (
            <TouchableOpacity onPress={onBackPress} className="p-2">
              <Ionicons name="arrow-back" size={24} color="#FF8C42" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onMenuPress} className="p-2">
              <Ionicons name="menu" size={24} color="#FF8C42" />
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-1 items-center">
          <Text 
            className={`text-lg font-semibold ${
              isDark ? 'text-white' : 'text-black'
            }`}
          >
            {title}
          </Text>
        </View>

        <View className="w-10 items-end">
          {rightComponent ? (
            rightComponent
          ) : showFloatingRec ? (
            <TouchableOpacity 
              className="p-1 relative" 
              onPress={toggleFloating}
              disabled={counselingLoading}
            >
              <View
                className={`w-10 h-10 rounded-full border-2 border-orange-500 justify-center items-center ${
                  isDark ? "bg-orange-900/20" : "bg-orange-50"
                }`}
              >
                {counselingLoading ? (
                  <ActivityIndicator size="small" color="#F97316" />
                ) : (
                  <Ionicons name="happy" size={20} color="#F97316" />
                )}
              </View>

              {hasRecommendations && !showFloating && !counselingLoading && (
                <View
                  className={`absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 items-center justify-center border-2 ${
                    isDark ? "border-black" : "border-white"
                  }`}
                >
                  <Text className="text-white text-[9px] font-bold">
                    {counselingData?.recommendations.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View className="w-10 h-10" />
          )}
        </View>
      </View>

      {showFloatingRec && (
        <FloatingRecommendation
          visible={showFloating}
          counselingData={counselingData}
          loading={counselingLoading}
          onClose={() => setShowFloating(false)}
          onViewFull={handleViewFullCounseling}
        />
      )}
    </>
  );
};

// ✅ FIX 6: Memoize component to prevent unnecessary re-renders
export default React.memo(Header, (prevProps, nextProps) => {
  return (
    prevProps.title === nextProps.title &&
    prevProps.showBackButton === nextProps.showBackButton &&
    prevProps.showFloatingRec === nextProps.showFloatingRec &&
    prevProps.rightComponent === nextProps.rightComponent
  );
});