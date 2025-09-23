// hooks/useProfileCheck.ts
import { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useUserApi } from '@/hooks/user/useUserApi';

let hasInitialized = false; // Global flag to avoid re-checking

export const useProfileCheck = () => {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const { getUserProfile } = useUserApi(); // Use getUserProfile instead of checkUserProfile
  const router = useRouter();
  
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);

  useEffect(() => {
    // Only run once when app starts
    if (!authLoaded || !userLoaded || hasInitialized) {
      return;
    }

    hasInitialized = true;

    const performCheck = async () => {
      if (!isSignedIn) {
        router.replace('/sign-in');
        return;
      }

      setIsCheckingProfile(true);
      
      try {
        const response = await getUserProfile();
        console.log('Profile check response:', response);
        
        if (response.profileComplete === false) {
          setProfileComplete(false);
          router.replace('/complete-profile');
        } else {
          setProfileComplete(true);
          // User has profile, stay on current route
        }
      } catch (error) {
        console.error('Profile check error:', error);
        setProfileComplete(false);
        router.replace('/complete-profile');
      } finally {
        setIsCheckingProfile(false);
      }
    };

    performCheck();
  }, [authLoaded, userLoaded, isSignedIn, getUserProfile, router]);

  const resetCheck = () => {
    hasInitialized = false;
  };

  return {
    isCheckingProfile,
    profileComplete,
    markProfileComplete: () => {
      setProfileComplete(true);
    },
    resetCheck, // For testing or manual reset
  };
};