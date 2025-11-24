// components/page/message/EncryptionInitProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { nativeEncryptionService } from '@/lib/encryption/NativeEncryptionService';
import { ActivityIndicator, View, Text } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface EncryptionContextType {
  isReady: boolean;
  loading: boolean;
  error: string | null;
}

const EncryptionContext = createContext<EncryptionContextType>({
  isReady: false,
  loading: true,
  error: null,
});

export const useEncryptionContext = () => useContext(EncryptionContext);

export const EncryptionInitProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { userId, getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn && userId) {
      initializeEncryption();
    } else {
      // Not signed in yet, wait
      setLoading(false);
    }
  }, [isSignedIn, userId]);

  const initializeEncryption = async () => {
    try {
      console.log('🔐 [App Init] Initializing E2EE...');
      setLoading(true);
      setError(null);

      // Initialize native encryption keys
      const keys = await nativeEncryptionService.initializeKeys();
      console.log('✅ [App Init] Native keys initialized');

      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Upload key to server (idempotent)
      console.log('📤 [App Init] Uploading key to server...');
      const response = await fetch(`${API_BASE_URL}/api/keys/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ publicKey: keys.publicKey }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to upload key');
      }

      setIsReady(true);
      console.log('✅ [App Init] E2EE ready globally');
    } catch (err: any) {
      console.error('❌ [App Init] E2EE initialization failed:', err);
      setError(err.message);
      setIsReady(false);
    } finally {
      setLoading(false);
    }
  };

  // Show loading only ONCE at app start
  if (loading && isSignedIn) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 dark:bg-gray-900">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="mt-4 text-gray-600 dark:text-gray-400 text-center px-8">
          🔐 Initializing encryption...
        </Text>
      </View>
    );
  }

  // Error state (non-blocking, app can still work)
  if (error) {
    console.warn('⚠️ [App Init] E2EE error (non-blocking):', error);
  }

  return (
    <EncryptionContext.Provider value={{ isReady, loading, error }}>
      {children}
    </EncryptionContext.Provider>
  );
};