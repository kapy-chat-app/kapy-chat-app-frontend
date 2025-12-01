// components/page/message/EncryptionInitProvider.tsx - FIXED for old users
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { 
  nativeEncryptionService, 
  KeyBackupData 
} from '@/lib/encryption/NativeEncryptionService';
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

interface EncryptionContextType {
  isReady: boolean;
  loading: boolean;
  error: string | null;
  hasBackup: boolean;
  showBackupPrompt: () => void; // ✅ NEW: Allow manual backup creation
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
  const [isCreatingBackupForExistingKeys, setIsCreatingBackupForExistingKeys] = useState(false); // ✅ NEW
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

   const checkAndInitialize = async () => {
    try {
      console.log('🔐 [App Init] Checking encryption status...');
      setLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Check if keys exist locally
      const hasLocalKeys = await nativeEncryptionService.isInitialized();
      console.log('📱 [App Init] Has local keys:', hasLocalKeys);

      // ✅ FIX: Always check server backup status FIRST (even before checking local keys)
      let serverHasBackup = false;
      try {
        console.log('📡 [App Init] Checking server for backup...');
        const backupResponse = await fetch(
          `${API_BASE_URL}/api/keys/backup/check`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        console.log('📡 [App Init] Backup check response status:', backupResponse.status);

        if (backupResponse.ok) {
          const backupResult = await backupResponse.json();
          console.log('📡 [App Init] Backup check result:', backupResult);

          if (backupResult.success && backupResult.data && typeof backupResult.data.hasBackup === 'boolean') {
            serverHasBackup = backupResult.data.hasBackup;
            console.log('✅ [App Init] Server has backup:', serverHasBackup);
            
            // ✅ FIX: Update hasBackup state immediately
            setHasBackup(serverHasBackup);
          } else {
            console.log('⚠️ [App Init] Invalid backup check response format');
          }
        } else {
          console.log('⚠️ [App Init] Backup check failed with status:', backupResponse.status);
        }
      } catch (backupError) {
        console.error('❌ [App Init] Error checking backup:', backupError);
      }

      // ✅ SCENARIO 1: Has backup but no local keys → RESTORE
      if (serverHasBackup && !hasLocalKeys) {
        console.log('📦 Backup found, prompting for restore password');
        setNeedsRestore(true);
        setLoading(false);
        return;
      }

      // ✅ SCENARIO 2: No local keys, no backup → NEW USER
      if (!hasLocalKeys) {
        console.log('🆕 New user, need to create backup password');
        setNeedsBackupPassword(true);
        setLoading(false);
        return;
      }

      // ✅ SCENARIO 3: Has local keys AND has backup → ALL GOOD
      if (hasLocalKeys && serverHasBackup) {
        console.log('✅ Complete user: Has keys AND backup');
        await initializeEncryption();
        return;
      }

      // ✅ SCENARIO 4: Has local keys but NO backup → OLD USER
      if (hasLocalKeys && !serverHasBackup) {
        console.log('👤 Old user detected (has keys but no backup)');
        // Initialize app normally first
        setIsReady(true);
        setLoading(false);
        
        // ✅ FIX: Only show dialog if we're SURE there's no backup
        // Wait a bit longer to ensure state is settled
        setTimeout(async () => {
          // ✅ DOUBLE CHECK: Verify backup status one more time
          try {
            const token = await getToken();
            if (!token) return;
            
            const recheck = await fetch(
              `${API_BASE_URL}/api/keys/backup/check`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (recheck.ok) {
              const recheckResult = await recheck.json();
              if (recheckResult.success && recheckResult.data?.hasBackup) {
                console.log('✅ [Recheck] Backup found, not showing dialog');
                setHasBackup(true);
                return; // Don't show dialog
              }
            }
          } catch (err) {
            console.error('⚠️ [Recheck] Failed:', err);
          }
          
          // ✅ Still no backup after recheck → show dialog
          console.log('⚠️ [Recheck] No backup confirmed, showing dialog');
          Alert.alert(
            t('encryption.backup.recommendTitle') || 'Backup Your Keys',
            t('encryption.backup.recommendMessage') || 'We recommend creating a backup password to protect your encryption keys.',
            [
              { 
                text: t('encryption.backup.later') || 'Later', 
                style: 'cancel',
                onPress: () => console.log('User chose to create backup later')
              },
              {
                text: t('encryption.backup.createNow') || 'Create Now',
                onPress: () => {
                  setIsCreatingBackupForExistingKeys(true);
                  setNeedsBackupPassword(true);
                }
              }
            ]
          );
        }, 2000); // ✅ Increased delay to 2s for state to settle
        return;
      }

      // Fallback: Initialize normally
      await initializeEncryption();
      
    } catch (err: any) {
      console.error('❌ [App Init] Check failed:', err);
      setError(err.message);
      
      // If check fails, still try to initialize with local keys
      try {
        const hasLocalKeys = await nativeEncryptionService.isInitialized();
        if (hasLocalKeys) {
          console.log('⚠️ Check failed but local keys exist, initializing anyway...');
          await initializeEncryption();
          return;
        }
      } catch (fallbackError) {
        console.error('❌ Fallback init also failed:', fallbackError);
      }
      
      setLoading(false);
    }
  };


  const initializeEncryption = async (password?: string) => {
    try {
      console.log('🔐 [App Init] Initializing E2EE...');
      
      const result = await nativeEncryptionService.initializeKeys(password);
      console.log('✅ [App Init] Native keys initialized');

      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Upload public key to server
      try {
        console.log('📤 [App Init] Uploading key to server...');
        const uploadResponse = await fetch(`${API_BASE_URL}/api/keys/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ publicKey: result.publicKey }),
        });

        if (!uploadResponse.ok) {
          console.log('⚠️ [App Init] Key upload failed with status:', uploadResponse.status);
        } else {
          const uploadResult = await uploadResponse.json();
          if (!uploadResult.success) {
            console.log('⚠️ [App Init] Key upload failed:', uploadResult.error);
          } else {
            console.log('✅ [App Init] Key uploaded successfully');
          }
        }
      } catch (uploadError) {
        console.error('❌ [App Init] Error uploading key:', uploadError);
      }

      // Upload backup if password was provided
      if (result.backupData) {
        try {
          console.log('📤 [App Init] Uploading backup...');
          const backupResponse = await fetch(`${API_BASE_URL}/api/keys/backup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ backup: result.backupData }),
          });

          if (!backupResponse.ok) {
            console.log('⚠️ [App Init] Backup upload failed with status:', backupResponse.status);
          } else {
            const backupResult = await backupResponse.json();
            if (backupResult.success) {
              console.log('✅ [App Init] Backup uploaded');
              setHasBackup(true);
            } else {
              console.log('⚠️ [App Init] Backup upload failed:', backupResult.error);
            }
          }
        } catch (backupError) {
          console.error('❌ [App Init] Error uploading backup:', backupError);
        }
      }

      setIsReady(true);
      setNeedsBackupPassword(false);
      setIsCreatingBackupForExistingKeys(false);
      console.log('✅ [App Init] E2EE ready globally');
    } catch (err: any) {
      console.error('❌ [App Init] E2EE initialization failed:', err);
      setError(err.message);
      setIsReady(false);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Function to create backup for existing keys
   const createBackupForExistingKeys = async () => {
    if (backupPassword.length < 8) {
      Alert.alert(t('error'), t('encryption.backup.passwordTooShort') || 'Password must be at least 8 characters');
      return;
    }

    if (backupPassword !== confirmPassword) {
      Alert.alert(t('error'), t('encryption.backup.passwordMismatch') || 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      console.log('🔐 Creating backup for existing keys...');
      
      // Create backup from existing keys
      const backupData = await nativeEncryptionService.createBackup(backupPassword);
      
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Upload backup to server
      console.log('📤 Uploading backup...');
      const backupResponse = await fetch(`${API_BASE_URL}/api/keys/backup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ backup: backupData }),
      });

      if (!backupResponse.ok) {
        throw new Error('Failed to upload backup');
      }

      const backupResult = await backupResponse.json();
      if (!backupResult.success) {
        throw new Error(backupResult.error || 'Failed to upload backup');
      }

      console.log('✅ Backup created successfully');
      
      // ✅ FIX: Update state immediately
      setHasBackup(true);
      setNeedsBackupPassword(false);
      setIsCreatingBackupForExistingKeys(false);
      
      // ✅ FIX: Clear password fields
      setBackupPassword('');
      setConfirmPassword('');
      
      Alert.alert(
        t('success') || 'Success', 
        t('encryption.backup.created') || 'Backup created successfully'
      );
    } catch (err: any) {
      console.error('❌ Failed to create backup:', err);
      Alert.alert(t('error'), err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    // ✅ NEW: Check if we're creating backup for existing keys or new keys
    if (isCreatingBackupForExistingKeys) {
      await createBackupForExistingKeys();
    } else {
      // Original flow - creating new keys with backup
      if (backupPassword.length < 8) {
        Alert.alert(t('error'), t('encryption.backup.passwordTooShort') || 'Password must be at least 8 characters');
        return;
      }

      if (backupPassword !== confirmPassword) {
        Alert.alert(t('error'), t('encryption.backup.passwordMismatch') || 'Passwords do not match');
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

  const handleRestore = async () => {
    if (!restorePassword) {
      Alert.alert(t('error'), t('encryption.restore.passwordRequired') || 'Password is required');
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Fetch backup from server
      console.log('📥 Fetching backup from server...');
      const response = await fetch(`${API_BASE_URL}/api/keys/backup`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error('Backup not found');
      }

      // Restore from backup
      console.log('🔄 Restoring from backup...');
      await nativeEncryptionService.restoreFromBackup(
        result.data.backup,
        restorePassword
      );

      // Initialize normally
      await initializeEncryption();
      setNeedsRestore(false);
      
      Alert.alert(t('success'), t('encryption.restore.success') || 'Keys restored successfully');
    } catch (err: any) {
      console.error('❌ Restore failed:', err);
      Alert.alert(t('error'), t('encryption.restore.invalidPassword') || 'Invalid password or backup corrupted');
      setLoading(false);
    }
  };

  // ✅ NEW: Manual backup creation function
  const showBackupPrompt = () => {
    if (hasBackup) {
      Alert.alert(
        t('info') || 'Info',
        t('encryption.backup.alreadyExists') || 'You already have a backup'
      );
      return;
    }
    
    setIsCreatingBackupForExistingKeys(true);
    setNeedsBackupPassword(true);
  };

  // Theme-based colors
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

  // Error state (non-blocking, app can still work)
  if (error) {
    console.warn('⚠️ [App Init] E2EE error (non-blocking):', error);
  }

  return (
    <EncryptionContext.Provider value={{ isReady, loading, error, hasBackup, showBackupPrompt }}>
      {children}
    </EncryptionContext.Provider>
  );
};