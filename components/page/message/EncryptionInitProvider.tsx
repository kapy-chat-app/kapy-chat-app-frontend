// components/page/message/EncryptionInitProvider.tsx - MANDATORY BACKUP VERSION
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { NativeEncryptionBridge } from '@/lib/encryption/NativeEncryptionBridge';
import * as SecureStore from 'expo-secure-store';
import { 
  ActivityIndicator, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useProfileCheck } from '@/hooks/user/useProfileCheck';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const ENCRYPTION_KEY_STORE = "e2ee_master_key";

interface KeyBackupData {
  encryptedMasterKey: string;
  salt: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  createdAt: string;
}

interface EncryptionContextType {
  isReady: boolean;
  loading: boolean;
  error: string | null;
  hasBackup: boolean;
  showBackupPrompt: () => void;
}

const EncryptionContext = createContext<EncryptionContextType>({
  isReady: false,
  loading: true,
  error: null,
  hasBackup: false,
  showBackupPrompt: () => {},
});

export const useEncryptionContext = () => useContext(EncryptionContext);

export const EncryptionInitProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasBackup, setHasBackup] = useState(false);
  
  // Backup password setup state
  const [needsBackupPassword, setNeedsBackupPassword] = useState(false);
  const [isCreatingBackupForExistingKeys, setIsCreatingBackupForExistingKeys] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Restore from backup state
  const [needsRestore, setNeedsRestore] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');
  const [showRestorePassword, setShowRestorePassword] = useState(false);
  
  const { userId, getToken, isSignedIn } = useAuth();
  const { t } = useLanguage();
  const { theme } = useTheme();
  
  const { hasProfile, isCheckingProfile } = useProfileCheck();

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  useEffect(() => {
    if (isSignedIn && userId && hasProfile && !isCheckingProfile) {
      console.log('🔐 [Init] User has profile, initializing encryption...');
      checkAndInitialize();
    } else if (isSignedIn && userId && !isCheckingProfile && !hasProfile) {
      console.log('⏳ [Init] User has no profile yet, skipping encryption init');
      setLoading(false);
      setIsReady(false);
    } else if (!isSignedIn) {
      setLoading(false);
      setIsReady(false);
    }
  }, [isSignedIn, userId, hasProfile, isCheckingProfile]);

  useEffect(() => {
    if (needsBackupPassword || needsRestore) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [needsBackupPassword, needsRestore]);

  const hasLocalKeys = async (): Promise<boolean> => {
    try {
      const key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
      return key !== null && key.length > 0;
    } catch {
      return false;
    }
  };

  const checkServerHasPublicKey = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/keys/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const result = await response.json();
        return result.success && result.data?.publicKey;
      }
      
      return false;
    } catch (err) {
      console.error('⚠️ Failed to check server public key:', err);
      return false;
    }
  };

  const checkServerBackup = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/keys/backup/check`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const result = await response.json();
        return result.success && result.data?.hasBackup === true;
      }
    } catch (err) {
      console.error('⚠️ Failed to check server backup:', err);
    }
    return false;
  };

  const uploadPublicKey = async (masterKey: string, retries: number = 3): Promise<boolean> => {
    console.log(`📤 [Init] Uploading public key (attempt 1/${retries})...`);
    
    const token = await getToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/keys/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ publicKey: masterKey }),
        });

        if (response.ok) {
          console.log('✅ [Init] Public key uploaded successfully');
          return true;
        }

        const errorText = await response.text();
        console.warn(`⚠️ [Init] Upload attempt ${attempt}/${retries} failed: ${response.status} - ${errorText}`);
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      } catch (error: any) {
        console.error(`❌ [Init] Upload attempt ${attempt}/${retries} error:`, error.message);
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw new Error('Failed to upload public key after multiple attempts');
  };

  const checkAndInitialize = async () => {
    try {
      console.log('🔐 [Init] Checking encryption status...');
      setLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const hasLocal = await hasLocalKeys();
      console.log('📱 [Init] Has local keys:', hasLocal);

      const serverHasBackup = await checkServerBackup(token);
      console.log('📡 [Init] Server has backup:', serverHasBackup);
      setHasBackup(serverHasBackup);

      const serverHasPublicKey = await checkServerHasPublicKey(token);
      console.log('🔑 [Init] Server has public key:', serverHasPublicKey);

      // ✅ SCENARIO 1: Has backup but no local keys → MUST RESTORE
      if (serverHasBackup && !hasLocal) {
        console.log('📦 [Init] MUST restore from backup');
        setNeedsRestore(true);
        setLoading(false);
        return;
      }

      // ✅ SCENARIO 2: No local keys, no backup → MUST CREATE WITH BACKUP
      if (!hasLocal) {
        console.log('🆕 [Init] MUST create encryption keys WITH BACKUP');
        setNeedsBackupPassword(true);
        setLoading(false);
        return;
      }

      // ✅ SCENARIO 3: Has local keys but NO backup → MUST CREATE BACKUP
      if (hasLocal && !serverHasBackup) {
        console.log('⚠️ [Init] Has local keys but NO BACKUP - FORCING backup creation');
        setIsCreatingBackupForExistingKeys(true);
        setNeedsBackupPassword(true);
        setLoading(false);
        return;
      }

      // ✅ SCENARIO 4: Has local keys but NO public key on server → Upload it!
      if (hasLocal && !serverHasPublicKey) {
        console.log('⚠️ [Init] Has local key but not uploaded - uploading now...');
        
        try {
          const masterKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
          if (masterKey) {
            await uploadPublicKey(masterKey);
            console.log('✅ [Init] Public key uploaded successfully');
          }
        } catch (uploadError: any) {
          console.error('❌ [Init] Failed to upload key:', uploadError);
        }
      }

      // ✅ SCENARIO 5: Everything is good → Initialize
      console.log('✅ [Init] Has local keys and backup, initializing...');
      await initializeEncryption();
      
    } catch (err: any) {
      console.error('❌ [Init] Failed:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const generateAndUploadKey = async (): Promise<string> => {
    console.log('🔐 [Init] Generating master key...');
    
    const masterKey = await NativeEncryptionBridge.generateKey();
    console.log(`✅ [Init] Master key generated (${masterKey.length} chars)`);
    
    await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE, masterKey);
    console.log('✅ [Init] Master key stored locally');
    
    try {
      await uploadPublicKey(masterKey);
    } catch (error) {
      console.error('❌ [Init] Failed to upload key:', error);
      throw error;
    }
    
    return masterKey;
  };

  const createNativeBackup = async (
    masterKey: string,
    password: string
  ): Promise<KeyBackupData> => {
    console.log('🔐 [Init] Creating encrypted backup...');
    
    const saltBytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      saltBytes[i] = Math.floor(Math.random() * 256);
    }
    const salt = Buffer.from(saltBytes).toString('base64');
    
    const result = await NativeEncryptionBridge.encryptMessage(masterKey, password + salt);
    
    console.log('✅ [Init] Backup created');
    
    return {
      encryptedMasterKey: result.encryptedContent,
      salt: salt,
      iv: result.iv,
      authTag: result.authTag,
      keyVersion: 1,
      createdAt: new Date().toISOString(),
    };
  };

  const initializeEncryption = async (password?: string) => {
    try {
      console.log('🔐 [Init] Initializing E2EE...');
      
      let masterKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
      
      if (!masterKey) {
        masterKey = await generateAndUploadKey();
      } else {
        console.log(`✅ [Init] Using existing master key (${masterKey.length} chars)`);
        
        try {
          const token = await getToken();
          if (token) {
            const serverHasKey = await checkServerHasPublicKey(token);
            if (!serverHasKey) {
              console.log('⚠️ [Init] Key not on server - uploading...');
              await uploadPublicKey(masterKey);
            }
          }
        } catch (error) {
          console.warn('⚠️ [Init] Could not verify/upload key:', error);
        }
      }

      // ✅ MANDATORY: Must create backup with password
      if (password) {
        const backupData = await createNativeBackup(masterKey, password);
        
        const token = await getToken();
        if (token) {
          const backupResponse = await fetch(`${API_BASE_URL}/api/keys/backup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ backup: backupData }),
          });

          if (!backupResponse.ok) {
            throw new Error('Failed to upload backup to server');
          }
          
          console.log('✅ [Init] Backup uploaded to server');
          setHasBackup(true);
        }
      }

      setIsReady(true);
      setNeedsBackupPassword(false);
      setIsCreatingBackupForExistingKeys(false);
      console.log('✅ [Init] E2EE ready');
    } catch (err: any) {
      console.error('❌ [Init] Failed:', err);
      setError(err.message);
      setIsReady(false);
    } finally {
      setLoading(false);
    }
  };

  const createBackupForExistingKeys = async () => {
    if (backupPassword.length < 8) {
      Alert.alert(t('error'), 'Password must be at least 8 characters');
      return;
    }

    if (backupPassword !== confirmPassword) {
      Alert.alert(t('error'), 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const masterKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
      if (!masterKey) {
        throw new Error('Master key not found');
      }

      const backupData = await createNativeBackup(masterKey, backupPassword);
      
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch(`${API_BASE_URL}/api/keys/backup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ backup: backupData }),
      });

      if (!response.ok) {
        throw new Error('Failed to upload backup');
      }

      console.log('✅ [Init] Backup created successfully');
      setHasBackup(true);
      setNeedsBackupPassword(false);
      setIsCreatingBackupForExistingKeys(false);
      setBackupPassword('');
      setConfirmPassword('');
      
      // Now initialize encryption
      await initializeEncryption();
      
      Alert.alert(
        t('success') || 'Success', 
        t('encryption.backup.createdSuccess') || 'Backup created successfully. Keep your password safe!'
      );
    } catch (err: any) {
      console.error('❌ [Init] Backup creation failed:', err);
      Alert.alert(t('error'), err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ REMOVED: handleSkipBackup function - no longer needed

  const handleCreateBackup = async () => {
    if (backupPassword.length < 8) {
      Alert.alert(
        t('error'), 
        t('encryption.backup.passwordTooShort') || 'Password must be at least 8 characters'
      );
      return;
    }

    if (backupPassword !== confirmPassword) {
      Alert.alert(
        t('error'), 
        t('encryption.backup.passwordMismatch') || 'Passwords do not match'
      );
      return;
    }

    if (isCreatingBackupForExistingKeys) {
      await createBackupForExistingKeys();
    } else {
      setLoading(true);
      try {
        await initializeEncryption(backupPassword);
      } catch (err: any) {
        Alert.alert(t('error'), err.message);
        setLoading(false);
      }
    }
  };

  const handleRestore = async () => {
    if (!restorePassword) {
      Alert.alert(t('error'), 'Password is required');
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch(`${API_BASE_URL}/api/keys/backup`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error('Backup not found');
      }

      const backupData: KeyBackupData = result.data.backup;
      console.log('📥 [Init] Backup fetched from server');

      const masterKey = await NativeEncryptionBridge.decryptMessage(
        backupData.encryptedMasterKey,
        backupData.iv,
        backupData.authTag,
        restorePassword + backupData.salt
      );

      console.log(`✅ [Init] Master key restored (${masterKey.length} chars)`);

      await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE, masterKey);
      console.log('✅ [Init] Master key stored locally');
      
      try {
        await uploadPublicKey(masterKey);
        console.log('✅ [Init] Public key uploaded to server');
      } catch (uploadError) {
        console.error('❌ [Init] Failed to upload key after restore:', uploadError);
        throw new Error('Restored key but failed to upload. Please try again.');
      }

      setIsReady(true);
      setHasBackup(true);
      setNeedsRestore(false);
      setRestorePassword('');
      
      Alert.alert(
        t('success'), 
        t('encryption.restore.success') || 'Keys restored successfully'
      );
    } catch (err: any) {
      console.error('❌ [Init] Restore failed:', err);
      Alert.alert(
        t('error'), 
        err.message || t('encryption.restore.invalidPassword') || 'Invalid password or corrupted backup'
      );
    } finally {
      setLoading(false);
    }
  };

  const showBackupPrompt = () => {
    if (hasBackup) {
      Alert.alert(t('info') || 'Info', 'You already have a backup');
      return;
    }
    
    setIsCreatingBackupForExistingKeys(true);
    setNeedsBackupPassword(true);
  };

  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-gray-900' : 'bg-white';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-gray-50';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const subTextColor = isDark ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-300';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-white';

  if (!hasProfile && !isCheckingProfile) {
    console.log('⏸️ [Init] Encryption paused - waiting for profile');
    return (
      <EncryptionContext.Provider value={{ isReady: false, loading: false, error: null, hasBackup: false, showBackupPrompt }}>
        {children}
      </EncryptionContext.Provider>
    );
  }

  // ✅ MANDATORY BACKUP UI - NO SKIP OPTION
  if (needsBackupPassword) {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className={`flex-1 ${bgColor}`}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
            className="items-center"
          >
            <View className={`w-24 h-24 rounded-full ${cardBg} items-center justify-center mb-6`}>
              <Ionicons name="shield-checkmark" size={48} color="#f97316" />
            </View>

            <Text className={`text-3xl font-bold ${textColor} mb-3 text-center`}>
              {isCreatingBackupForExistingKeys 
                ? (t('encryption.backup.required') || '🔐 Backup Required')
                : (t('encryption.setup.required') || '🔒 Encryption Setup')}
            </Text>
            
            <Text className={`text-base ${subTextColor} text-center mb-2 px-4`}>
              {isCreatingBackupForExistingKeys
                ? (t('encryption.backup.mandatoryForExisting') || 'You must create a backup password to continue using the app securely.')
                : (t('encryption.setup.mandatory') || 'Create a backup password to protect your messages. This is required for security.')}
            </Text>

            {/* ✅ WARNING MESSAGE */}
            <View className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-6">
              <View className="flex-row items-start">
                <Ionicons name="warning" size={20} color="#f97316" style={{ marginTop: 2 }} />
                <Text className={`text-sm ${isDark ? 'text-orange-300' : 'text-orange-700'} ml-2 flex-1`}>
                  {t('encryption.backup.warningMessage') || 'Keep this password safe! Without it, you cannot recover your messages if you lose your device.'}
                </Text>
              </View>
            </View>

            <View className="w-full mb-4">
              <Text className={`text-sm font-medium ${textColor} mb-2`}>
                {t('encryption.backup.passwordLabel') || 'Backup Password'} <Text className="text-red-500">*</Text>
              </Text>
              <View className={`flex-row items-center ${inputBg} border ${borderColor} rounded-xl px-4`}>
                <Ionicons name="lock-closed-outline" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                <TextInput
                  className={`flex-1 py-4 px-3 ${textColor}`}
                  placeholder={t('encryption.backup.passwordPlaceholder') || 'Enter password (required)'}
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  secureTextEntry={!showPassword}
                  value={backupPassword}
                  onChangeText={setBackupPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </TouchableOpacity>
              </View>
            </View>

            <View className="w-full mb-6">
              <Text className={`text-sm font-medium ${textColor} mb-2`}>
                {t('encryption.backup.confirmPasswordLabel') || 'Confirm Password'} <Text className="text-red-500">*</Text>
              </Text>
              <View className={`flex-row items-center ${inputBg} border ${borderColor} rounded-xl px-4`}>
                <Ionicons name="lock-closed-outline" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                <TextInput
                  className={`flex-1 py-4 px-3 ${textColor}`}
                  placeholder={t('encryption.backup.confirmPasswordPlaceholder') || 'Confirm password'}
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </TouchableOpacity>
              </View>
            </View>

            <View className={`w-full ${cardBg} rounded-xl p-4 mb-6`}>
              <Text className={`text-sm font-medium ${textColor} mb-2`}>
                {t('encryption.backup.requirements') || 'Requirements'}
              </Text>
              <View className="flex-row items-center mb-1">
                <Ionicons name="checkmark-circle" size={16} color={backupPassword.length >= 8 ? '#10B981' : isDark ? '#4B5563' : '#D1D5DB'} />
                <Text className={`text-sm ${subTextColor} ml-2`}>
                  {t('encryption.backup.minLength') || 'At least 8 characters'}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={16} color={backupPassword === confirmPassword && backupPassword.length > 0 ? '#10B981' : isDark ? '#4B5563' : '#D1D5DB'} />
                <Text className={`text-sm ${subTextColor} ml-2`}>
                  Passwords match
                </Text>
              </View>
            </View>

            <TouchableOpacity
              className={`w-full bg-orange-500 rounded-xl py-4 ${loading || backupPassword.length < 8 || backupPassword !== confirmPassword ? 'opacity-50' : ''}`}
              onPress={handleCreateBackup}
              disabled={loading || backupPassword.length < 8 || backupPassword !== confirmPassword}
            >
              <Text className="text-white text-center font-semibold text-base">
                {loading 
                  ? (t('encryption.backup.creating') || 'Creating...') 
                  : (t('encryption.backup.createButton') || 'Create Backup & Continue')}
              </Text>
            </TouchableOpacity>
            
            {/* ✅ REMOVED: Skip button - backup is now mandatory */}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (needsRestore) {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className={`flex-1 ${bgColor}`}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
            className="items-center"
          >
            <View className={`w-24 h-24 rounded-full ${cardBg} items-center justify-center mb-6`}>
              <Ionicons name="key" size={48} color="#f97316" />
            </View>

            <Text className={`text-3xl font-bold ${textColor} mb-3 text-center`}>
              {t('encryption.restore.title') || 'Restore Your Keys'}
            </Text>
            
            <Text className={`text-base ${subTextColor} text-center mb-8 px-4`}>
              {t('encryption.restore.description') || 'Enter your backup password to restore your encryption keys'}
            </Text>

            <View className="w-full mb-6">
              <Text className={`text-sm font-medium ${textColor} mb-2`}>
                {t('encryption.restore.passwordLabel') || 'Backup Password'}
              </Text>
              <View className={`flex-row items-center ${inputBg} border ${borderColor} rounded-xl px-4`}>
                <Ionicons name="lock-closed-outline" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                <TextInput
                  className={`flex-1 py-4 px-3 ${textColor}`}
                  placeholder={t('encryption.restore.passwordPlaceholder') || 'Enter your backup password'}
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  secureTextEntry={!showRestorePassword}
                  value={restorePassword}
                  onChangeText={setRestorePassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowRestorePassword(!showRestorePassword)}>
                  <Ionicons name={showRestorePassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              className={`w-full bg-orange-500 rounded-xl py-4 mb-3 ${loading || !restorePassword ? 'opacity-50' : ''}`}
              onPress={handleRestore}
              disabled={loading || !restorePassword}
            >
              <Text className="text-white text-center font-semibold text-base">
                {loading 
                  ? (t('encryption.restore.restoring') || 'Restoring...') 
                  : (t('encryption.restore.restoreButton') || 'Restore Keys')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="w-full py-3"
              onPress={() => {
                Alert.alert(
                  t('encryption.restore.startFreshTitle') || 'Start Fresh?',
                  t('encryption.restore.startFreshWarning') || 'This will create new keys. You will lose access to old messages. This action cannot be undone.',
                  [
                    { text: t('cancel') || 'Cancel', style: 'cancel' },
                    {
                      text: t('encryption.restore.startFreshConfirm') || 'Start Fresh',
                      style: 'destructive',
                      onPress: () => {
                        setNeedsRestore(false);
                        setNeedsBackupPassword(true);
                        setRestorePassword('');
                      },
                    },
                  ]
                );
              }}
              disabled={loading}
            >
              <Text className={`${subTextColor} text-center font-medium`}>
                {t('encryption.restore.startFreshButton') || 'Start fresh instead'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (loading && isSignedIn && hasProfile) {
    return (
      <View className={`flex-1 justify-center items-center ${bgColor}`}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text className={`mt-4 ${subTextColor} text-center px-8`}>
          {t('encryption.initializing') || 'Initializing encryption...'}
        </Text>
      </View>
    );
  }

  if (error) {
    console.warn('⚠️ [Init] E2EE error (non-blocking):', error);
  }

  return (
    <EncryptionContext.Provider value={{ isReady, loading, error, hasBackup, showBackupPrompt }}>
      {children}
    </EncryptionContext.Provider>
  );
};