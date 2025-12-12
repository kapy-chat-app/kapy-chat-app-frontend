// components/page/message/EncryptionInitProvider.tsx - PURE NATIVE VERSION
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

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const ENCRYPTION_KEY_STORE = "e2ee_master_key";

// ✅ Backup data structure
interface KeyBackupData {
  encryptedMasterKey: string;
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

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  useEffect(() => {
    if (isSignedIn && userId) {
      checkAndInitialize();
    } else {
      setLoading(false);
    }
  }, [isSignedIn, userId]);

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

  // ============================================
  // ✅ Check if local keys exist
  // ============================================
  const hasLocalKeys = async (): Promise<boolean> => {
    try {
      const key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
      return key !== null;
    } catch {
      return false;
    }
  };

  // ============================================
  // ✅ Check server backup status
  // ============================================
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

  const checkAndInitialize = async () => {
    try {
      console.log('🔐 [Init] Checking encryption status...');
      setLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Check local keys
      const hasLocal = await hasLocalKeys();
      console.log('📱 [Init] Has local keys:', hasLocal);

      // Check server backup
      const serverHasBackup = await checkServerBackup(token);
      console.log('📡 [Init] Server has backup:', serverHasBackup);
      setHasBackup(serverHasBackup);

      // ✅ SCENARIO 1: Has backup but no local keys → RESTORE
      if (serverHasBackup && !hasLocal) {
        console.log('📦 [Init] Need to restore from backup');
        setNeedsRestore(true);
        setLoading(false);
        return;
      }

      // ✅ SCENARIO 2: No local keys, no backup → NEW USER
      if (!hasLocal) {
        console.log('🆕 [Init] New user - need to create keys');
        setNeedsBackupPassword(true);
        setLoading(false);
        return;
      }

      // ✅ SCENARIO 3: Has local keys AND has backup → ALL GOOD
      if (hasLocal && serverHasBackup) {
        console.log('✅ [Init] Complete setup detected');
        await initializeEncryption();
        return;
      }

      // ✅ SCENARIO 4: Has local keys but NO backup → OLD USER
      if (hasLocal && !serverHasBackup) {
        console.log('👤 [Init] Old user (no backup)');
        setIsReady(true);
        setLoading(false);
        
        // Show backup recommendation after delay
        setTimeout(() => {
          Alert.alert(
            t('encryption.backup.recommendTitle') || 'Backup Your Keys',
            t('encryption.backup.recommendMessage') || 'Create a backup to protect your encryption keys',
            [
              { text: t('encryption.backup.later') || 'Later', style: 'cancel' },
              {
                text: t('encryption.backup.createNow') || 'Create Now',
                onPress: () => {
                  setIsCreatingBackupForExistingKeys(true);
                  setNeedsBackupPassword(true);
                }
              }
            ]
          );
        }, 2000);
        return;
      }

      // Fallback
      await initializeEncryption();
      
    } catch (err: any) {
      console.error('❌ [Init] Failed:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // ============================================
  // ✅ Pure native key generation
  // ============================================
  const generateAndUploadKey = async (): Promise<string> => {
    // Generate native key
    const masterKey = await NativeEncryptionBridge.generateKey();
    
    // Store locally
    await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE, masterKey);
    
    // Upload to server
    const token = await getToken();
    if (token) {
      const uploadResponse = await fetch(`${API_BASE_URL}/api/keys/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ publicKey: masterKey }),
      });

      if (uploadResponse.ok) {
        console.log('✅ [Init] Key uploaded to server');
      }
    }
    
    return masterKey;
  };

  // ============================================
  // ✅ Create backup using native encryption
  // ============================================
  const createNativeBackup = async (
    masterKey: string,
    password: string
  ): Promise<KeyBackupData> => {
    // Use native module to encrypt the master key with password
    const result = await NativeEncryptionBridge.encryptMessage(masterKey, password);
    
    return {
      encryptedMasterKey: result.encryptedContent,
      iv: result.iv,
      authTag: result.authTag,
      keyVersion: 1,
      createdAt: new Date().toISOString(),
    };
  };

  const initializeEncryption = async (password?: string) => {
    try {
      console.log('🔐 [Init] Initializing E2EE...');
      
      // Check if key already exists
      let masterKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
      
      if (!masterKey) {
        // Generate new key
        masterKey = await generateAndUploadKey();
      }

      // Create backup if password provided
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

          if (backupResponse.ok) {
            console.log('✅ [Init] Backup uploaded');
            setHasBackup(true);
          }
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

  // ============================================
  // ✅ Create backup for existing keys
  // ============================================
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

      console.log('✅ [Init] Backup created');
      setHasBackup(true);
      setNeedsBackupPassword(false);
      setIsCreatingBackupForExistingKeys(false);
      setBackupPassword('');
      setConfirmPassword('');
      
      Alert.alert(t('success') || 'Success', 'Backup created successfully');
    } catch (err: any) {
      console.error('❌ [Init] Backup creation failed:', err);
      Alert.alert(t('error'), err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (isCreatingBackupForExistingKeys) {
      await createBackupForExistingKeys();
    } else {
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
        await initializeEncryption(backupPassword);
      } catch (err: any) {
        Alert.alert(t('error'), err.message);
        setLoading(false);
      }
    }
  };

  // ============================================
  // ✅ Restore from backup using native decryption
  // ============================================
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

      // Fetch backup from server
      const response = await fetch(`${API_BASE_URL}/api/keys/backup`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error('Backup not found');
      }

      const backupData: KeyBackupData = result.data.backup;

      // Decrypt master key using native module
      const masterKey = await NativeEncryptionBridge.decryptMessage(
        backupData.encryptedMasterKey,
        backupData.iv,
        backupData.authTag,
        restorePassword
      );

      // Store restored key
      await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE, masterKey);
      
      // Initialize normally
      await initializeEncryption();
      setNeedsRestore(false);
      
      Alert.alert(t('success'), 'Keys restored successfully');
    } catch (err: any) {
      console.error('❌ [Init] Restore failed:', err);
      Alert.alert(t('error'), 'Invalid password or corrupted backup');
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

  // Theme colors
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-gray-900' : 'bg-white';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-gray-50';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const subTextColor = isDark ? 'text-gray-400' : 'text-gray-600';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-300';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-white';

  // Show backup password setup screen
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
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
            className="items-center"
          >
            {/* Icon */}
            <View className={`w-24 h-24 rounded-full ${cardBg} items-center justify-center mb-6`}>
              <Ionicons 
                name="shield-checkmark" 
                size={48} 
                color={isDark ? '#f97316' : '#f97316'} 
              />
            </View>

            {/* Title */}
            <Text className={`text-3xl font-bold ${textColor} mb-3 text-center`}>
              {isCreatingBackupForExistingKeys 
                ? (t('encryption.backup.createForExistingTitle') || 'Create Backup')
                : (t('encryption.backup.title') || 'Secure Your Messages')}
            </Text>
            
            {/* Description */}
            <Text className={`text-base ${subTextColor} text-center mb-8 px-4`}>
              {isCreatingBackupForExistingKeys
                ? (t('encryption.backup.createForExistingDescription') || 'Create a backup password to protect your existing encryption keys')
                : (t('encryption.backup.description') || 'Create a backup password to protect your encryption keys')}
            </Text>

            {/* Password Input */}
            <View className="w-full mb-4">
              <Text className={`text-sm font-medium ${textColor} mb-2`}>
                {t('encryption.backup.passwordLabel') || 'Backup Password'}
              </Text>
              <View className={`flex-row items-center ${inputBg} border ${borderColor} rounded-xl px-4`}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={20} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                />
                <TextInput
                  className={`flex-1 py-4 px-3 ${textColor}`}
                  placeholder={t('encryption.backup.passwordPlaceholder') || 'Enter password'}
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  secureTextEntry={!showPassword}
                  value={backupPassword}
                  onChangeText={setBackupPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons 
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                    size={20} 
                    color={isDark ? '#9CA3AF' : '#6B7280'} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Input */}
            <View className="w-full mb-6">
              <Text className={`text-sm font-medium ${textColor} mb-2`}>
                {t('encryption.backup.confirmPasswordLabel') || 'Confirm Password'}
              </Text>
              <View className={`flex-row items-center ${inputBg} border ${borderColor} rounded-xl px-4`}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={20} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                />
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
                  <Ionicons 
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} 
                    size={20} 
                    color={isDark ? '#9CA3AF' : '#6B7280'} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Requirements */}
            <View className={`w-full ${cardBg} rounded-xl p-4 mb-6`}>
              <Text className={`text-sm font-medium ${textColor} mb-2`}>
                {t('encryption.backup.requirements') || 'Requirements'}
              </Text>
              <View className="flex-row items-center mb-1">
                <Ionicons 
                  name="checkmark-circle" 
                  size={16} 
                  color={backupPassword.length >= 8 ? '#10B981' : isDark ? '#4B5563' : '#D1D5DB'} 
                />
                <Text className={`text-sm ${subTextColor} ml-2`}>
                  {t('encryption.backup.minLength') || 'At least 8 characters'}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons 
                  name="information-circle" 
                  size={16} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                />
                <Text className={`text-xs ${subTextColor} ml-2`}>
                  {t('encryption.backup.hint') || 'Use a strong, unique password'}
                </Text>
              </View>
            </View>

            {/* Create Button */}
            <TouchableOpacity
              className={`w-full bg-orange-500 rounded-xl py-4 mb-3 ${loading ? 'opacity-50' : ''}`}
              onPress={handleCreateBackup}
              disabled={loading}
            >
              <Text className="text-white text-center font-semibold text-base">
                {loading 
                  ? (t('encryption.backup.creating') || 'Creating...') 
                  : (t('encryption.backup.createButton') || 'Create Backup')}
              </Text>
            </TouchableOpacity>
            
            {/* Skip/Cancel Button */}
            <TouchableOpacity
              className="w-full py-3"
              onPress={() => {
                if (isCreatingBackupForExistingKeys) {
                  // Cancel - go back to app
                  setNeedsBackupPassword(false);
                  setIsCreatingBackupForExistingKeys(false);
                } else {
                  // Skip - initialize without backup
                  initializeEncryption();
                }
              }}
              disabled={loading}
            >
              <Text className={`${subTextColor} text-center font-medium`}>
                {isCreatingBackupForExistingKeys
                  ? (t('cancel') || 'Cancel')
                  : (t('encryption.backup.skipButton') || 'Skip for now')}
              </Text>
            </TouchableOpacity>

            {/* Warning (only for new users) */}
            {!isCreatingBackupForExistingKeys && (
              <View className="flex-row items-start mt-4 px-4">
                <Ionicons 
                  name="warning-outline" 
                  size={16} 
                  color="#F59E0B" 
                  style={{ marginTop: 2 }}
                />
                <Text className={`text-xs ${subTextColor} ml-2 flex-1`}>
                  {t('encryption.backup.skipWarning') || 'Without a backup, you may lose access to your messages'}
                </Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Show restore screen
  if (needsRestore) {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className={`flex-1 ${bgColor}`}
      >
        <ScrollView 
          contentContainerClassName="flex-grow justify-center p-6"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
            className="items-center"
          >
            {/* Icon */}
            <View className={`w-24 h-24 rounded-full ${cardBg} items-center justify-center mb-6`}>
              <Ionicons 
                name="key" 
                size={48} 
                color={isDark ? '#f97316' : '#f97316'} 
              />
            </View>

            {/* Title */}
            <Text className={`text-3xl font-bold ${textColor} mb-3 text-center`}>
              {t('encryption.restore.title') || 'Restore Your Keys'}
            </Text>
            
            {/* Description */}
            <Text className={`text-base ${subTextColor} text-center mb-8 px-4`}>
              {t('encryption.restore.description') || 'Enter your backup password to restore your encryption keys'}
            </Text>

            {/* Password Input */}
            <View className="w-full mb-6">
              <Text className={`text-sm font-medium ${textColor} mb-2`}>
                {t('encryption.restore.passwordLabel') || 'Backup Password'}
              </Text>
              <View className={`flex-row items-center ${inputBg} border ${borderColor} rounded-xl px-4`}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={20} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                />
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
                  <Ionicons 
                    name={showRestorePassword ? 'eye-off-outline' : 'eye-outline'} 
                    size={20} 
                    color={isDark ? '#9CA3AF' : '#6B7280'} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Info Card */}
            <View className={`w-full ${cardBg} rounded-xl p-4 mb-6`}>
              <View className="flex-row items-start">
                <Ionicons 
                  name="information-circle" 
                  size={20} 
                  color="#3B82F6" 
                  style={{ marginTop: 2 }}
                />
                <Text className={`text-sm ${subTextColor} ml-3 flex-1`}>
                  {t('encryption.restore.info') || 'This is the password you created when backing up your keys'}
                </Text>
              </View>
            </View>

            {/* Restore Button */}
            <TouchableOpacity
              className={`w-full bg-orange-500 rounded-xl py-4 mb-3 ${loading ? 'opacity-50' : ''}`}
              onPress={handleRestore}
              disabled={loading}
            >
              <Text className="text-white text-center font-semibold text-base">
                {loading 
                  ? (t('encryption.restore.restoring') || 'Restoring...') 
                  : (t('encryption.restore.restoreButton') || 'Restore Keys')}
              </Text>
            </TouchableOpacity>
            
            {/* Start Fresh Button */}
            <TouchableOpacity
              className="w-full py-3"
              onPress={() => {
                Alert.alert(
                  t('encryption.restore.startFreshTitle') || 'Start Fresh?',
                  t('encryption.restore.startFreshWarning') || 'This will create new keys. You will lose access to old messages.',
                  [
                    { text: t('cancel') || 'Cancel', style: 'cancel' },
                    {
                      text: t('encryption.restore.startFreshConfirm') || 'Start Fresh',
                      style: 'destructive',
                      onPress: () => {
                        setNeedsRestore(false);
                        initializeEncryption();
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

  // Show loading only ONCE at app start
  if (loading && isSignedIn) {
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