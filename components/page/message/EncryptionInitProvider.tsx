// components/page/message/EncryptionInitProvider.tsx - ULTRA SIMPLE TEST
import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useRef } from 'react';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export function EncryptionInitProvider({ children }: { children: React.ReactNode }) {
  const { userId, getToken, isSignedIn } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    const testUpload = async () => {
      // Skip if already ran
      if (hasRun.current) {
        console.log('⏭️ Already ran, skipping...');
        return;
      }

      // Wait for auth
      if (!isSignedIn || !userId) {
        console.log('⏳ Waiting for auth...', { isSignedIn, userId });
        return;
      }

      hasRun.current = true;
      console.log('');
      console.log('='.repeat(60));
      console.log('🧪 STARTING UPLOAD TEST');
      console.log('='.repeat(60));

      try {
        // 1. Get token
        console.log('1️⃣ Getting token...');
        const token = await getToken();
        if (!token) {
          console.error('❌ No token!');
          return;
        }
        console.log('✅ Token:', token.substring(0, 30) + '...');

        // 2. Prepare data
        const testKey = 'TEST_KEY_' + Date.now();
        console.log('2️⃣ Test key:', testKey);

        // 3. Make request
        const url = `${API_BASE_URL}/api/keys/upload`;
        console.log('3️⃣ Calling:', url);
        console.log('3️⃣ Method: POST');
        console.log('3️⃣ Headers:', {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token.substring(0, 20) + '...'
        });
        console.log('3️⃣ Body:', JSON.stringify({ publicKey: testKey }));

        console.log('');
        console.log('🚀 SENDING REQUEST NOW...');
        console.log('');

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ 
            publicKey: testKey 
          }),
        });

        console.log('');
        console.log('📡 RESPONSE RECEIVED:');
        console.log('Status:', response.status);
        console.log('StatusText:', response.statusText);
        console.log('OK:', response.ok);
        
        const text = await response.text();
        console.log('Raw body:', text);

        try {
          const json = JSON.parse(text);
          console.log('Parsed JSON:', JSON.stringify(json, null, 2));
        } catch (e) {
          console.log('⚠️ Not JSON');
        }

        console.log('');
        console.log('='.repeat(60));
        console.log('✅ TEST COMPLETE');
        console.log('='.repeat(60));
        console.log('');

      } catch (error: any) {
        console.log('');
        console.log('='.repeat(60));
        console.error('❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
        console.log('='.repeat(60));
        console.log('');
      }
    };

    testUpload();
  }, [isSignedIn, userId, getToken]);

  return <>{children}</>;
}