// hooks/user/useProfileCheck.ts
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter, useSegments } from 'expo-router';
import { useUserApi } from '@/hooks/user/useUserApi';

export const useProfileCheck = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const { getUserProfile } = useUserApi();
  const router = useRouter();
  const segments = useSegments();
  
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const checkProfile = async () => {
      const inAuthGroup = segments[0] === "(auth)";
      const inCompleteProfile = segments[0] === "complete-profile";

      console.log("🔍 [useProfileCheck] Current segments:", segments);
      console.log("🔍 [useProfileCheck] isSignedIn:", isSignedIn);

      // ⭐ Nếu không đăng nhập
      if (!isSignedIn) {
        if (!inAuthGroup) {
          console.log("⚠️ [useProfileCheck] Not signed in, redirecting to sign-in");
          router.replace("/(auth)/sign-in");
        }
        setProfileComplete(false);
        setIsCheckingProfile(false);
        return;
      }

      // ⭐ Nếu đang ở màn hình complete-profile thì KHÔNG check
      if (inCompleteProfile) {
        console.log("✅ [useProfileCheck] Already in complete-profile, skipping check");
        setIsCheckingProfile(false);
        return;
      }

      // ⭐ Đã đăng nhập -> kiểm tra profile
      try {
        console.log("🔍 [useProfileCheck] Checking profile status...");
        const response = await getUserProfile();
        console.log("📋 [useProfileCheck] Profile response:", response);

        const hasProfile = response.profileComplete !== false && response.data !== null;
        setProfileComplete(hasProfile);

        if (!hasProfile && !inCompleteProfile) {
          console.log("⚠️ [useProfileCheck] No profile found, redirecting to complete-profile");
          router.replace("/complete-profile");
        } else if (hasProfile && (inAuthGroup || inCompleteProfile)) {
          console.log("✅ [useProfileCheck] Profile complete, redirecting to home");
          router.replace("/");
        }
      } catch (error) {
        console.error("❌ [useProfileCheck] Profile check error:", error);
        // Nếu có lỗi và chưa ở complete-profile, redirect
        if (!inCompleteProfile) {
          router.replace("/complete-profile");
        }
        setProfileComplete(false);
      } finally {
        setIsCheckingProfile(false);
      }
    };

    checkProfile();
  }, [isSignedIn, isLoaded, segments]);

  const markProfileComplete = () => {
    setProfileComplete(true);
  };

  return {
    isCheckingProfile,
    profileComplete,
    hasProfile: profileComplete === true, // ⭐ NEW: Thêm hasProfile
    markProfileComplete,
  };
};