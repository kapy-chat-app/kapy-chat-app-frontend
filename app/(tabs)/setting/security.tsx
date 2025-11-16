import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth, useUser } from '@clerk/clerk-expo';
import Header from '@/components/shared/Header';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import * as Device from 'expo-device';

interface Session {
  id: string;
  deviceName: string;
  deviceType: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  ipAddress?: string;
  browser?: string;
}

export default function SecurityScreen() {
  const router = useRouter();
  const { actualTheme } = useTheme();
  const { t } = useLanguage();
  const { signOut } = useAuth();
  const { user } = useUser();
  const isDark = actualTheme === 'dark';

  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Change Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      
      if (user) {
        const clerkSessions = await user.getSessions();
        
        const formattedSessions: Session[] = clerkSessions.map((session: any) => {
          const isCurrentSession = session.id === user.id;
          
          return {
            id: session.id,
            deviceName: getDeviceName(session),
            deviceType: getDeviceType(session),
            location: session.lastActiveAt?.city || 'Unknown',
            lastActive: formatLastActive(session.lastActiveAt),
            isCurrent: isCurrentSession,
            ipAddress: session.lastActiveAt?.ipAddress,
            browser: session.lastActiveAt?.userAgent,
          };
        });

        setSessions(formattedSessions);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDeviceName = (session: any): string => {
    if (session.lastActiveAt?.userAgent) {
      const ua = session.lastActiveAt.userAgent;
      if (ua.includes('iPhone')) return 'iPhone';
      if (ua.includes('iPad')) return 'iPad';
      if (ua.includes('Android')) return 'Android Device';
      if (ua.includes('Windows')) return 'Windows PC';
      if (ua.includes('Mac')) return 'Mac';
    }
    return Device.modelName || 'Unknown Device';
  };

  const getDeviceType = (session: any): string => {
    if (session.lastActiveAt?.userAgent) {
      const ua = session.lastActiveAt.userAgent;
      if (ua.includes('Mobile')) return 'mobile';
      if (ua.includes('Tablet')) return 'tablet';
    }
    return 'desktop';
  };

  const formatLastActive = (timestamp: any): string => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return t('securityScreen.sessions.justNow');
    if (diffInMinutes < 60) return t('securityScreen.sessions.minutesAgo', { count: diffInMinutes });
    if (diffInHours < 24) return t('securityScreen.sessions.hoursAgo', { count: diffInHours });
    if (diffInDays < 7) return t('securityScreen.sessions.daysAgo', { count: diffInDays });
    
    return date.toLocaleDateString();
  };

  const handleOpenChangePassword = () => {
    setShowPasswordModal(true);
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return t('securityScreen.changePassword.validation.minLength');
    }
    if (!/[A-Z]/.test(password)) {
      return t('securityScreen.changePassword.validation.uppercase');
    }
    if (!/[a-z]/.test(password)) {
      return t('securityScreen.changePassword.validation.lowercase');
    }
    if (!/[0-9]/.test(password)) {
      return t('securityScreen.changePassword.validation.number');
    }
    return null;
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      Alert.alert(t('error'), t('securityScreen.changePassword.validation.currentRequired'));
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert(t('error'), t('securityScreen.changePassword.validation.newRequired'));
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      Alert.alert(t('error'), passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('error'), t('securityScreen.changePassword.validation.mismatch'));
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert(t('error'), t('securityScreen.changePassword.validation.same'));
      return;
    }

    setIsChangingPassword(true);

    try {
      await user?.updatePassword({
        currentPassword,
        newPassword,
      });

      Alert.alert(
        t('success'),
        t('securityScreen.changePassword.success'),
        [
          {
            text: t('ok'),
            onPress: handleClosePasswordModal,
          },
        ]
      );
    } catch (error: any) {
      console.error('Error changing password:', error);
      
      let errorMessage = t('securityScreen.changePassword.error.generic');
      
      if (error.errors && error.errors.length > 0) {
        const clerkError = error.errors[0];
        if (clerkError.code === 'form_password_incorrect') {
          errorMessage = t('securityScreen.changePassword.error.incorrectCurrent');
        } else {
          errorMessage = clerkError.longMessage || clerkError.message;
        }
      }

      Alert.alert(t('error'), errorMessage);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOutSession = async (sessionId: string, isCurrent: boolean) => {
    if (isCurrent) {
      Alert.alert(
        t('securityScreen.sessions.signOutCurrent.title'),
        t('securityScreen.sessions.signOutCurrent.message'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('securityScreen.sessions.signOut'),
            style: 'destructive',
            onPress: async () => {
              await signOut();
            },
          },
        ]
      );
    } else {
      Alert.alert(
        t('securityScreen.sessions.signOutOther.title'),
        t('securityScreen.sessions.signOutOther.message'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('securityScreen.sessions.signOut'),
            style: 'destructive',
            onPress: async () => {
              await revokeSession(sessionId);
            },
          },
        ]
      );
    }
  };

  const revokeSession = async (sessionId: string) => {
    try {
      setIsProcessing(true);
      
      if (user) {
        await user.getSessions().then((sessions: any[]) => {
          const session = sessions.find((s: any) => s.id === sessionId);
          if (session) {
            return session.revoke();
          }
        });
      }

      Alert.alert(t('success'), t('securityScreen.sessions.signOutSuccess'));
      await loadSessions();
    } catch (error) {
      console.error('Error revoking session:', error);
      Alert.alert(t('error'), t('securityScreen.sessions.signOutError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignOutAllOther = () => {
    const otherSessions = sessions.filter(s => !s.isCurrent);
    
    if (otherSessions.length === 0) {
      Alert.alert(
        t('securityScreen.sessions.noOtherSessions.title'),
        t('securityScreen.sessions.noOtherSessions.message')
      );
      return;
    }

    Alert.alert(
      t('securityScreen.sessions.signOutAll.title'),
      t('securityScreen.sessions.signOutAll.message', { count: otherSessions.length }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('securityScreen.sessions.signOutAll.confirm'),
          style: 'destructive',
          onPress: signOutAllOtherSessions,
        },
      ]
    );
  };

  const signOutAllOtherSessions = async () => {
    try {
      setIsProcessing(true);
      
      const otherSessions = sessions.filter(s => !s.isCurrent);
      
      for (const session of otherSessions) {
        await revokeSession(session.id);
      }

      Alert.alert(t('success'), t('securityScreen.sessions.signOutAllSuccess'));
      await loadSessions();
    } catch (error) {
      console.error('Error signing out all sessions:', error);
      Alert.alert(t('error'), t('securityScreen.sessions.signOutAllError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return 'phone-portrait-outline';
      case 'tablet':
        return 'tablet-portrait-outline';
      case 'desktop':
        return 'desktop-outline';
      default:
        return 'hardware-chip-outline';
    }
  };

  const passwordRequirements = [
    { key: 'minLength', text: t('securityScreen.changePassword.requirements.minLength'), met: newPassword.length >= 8 },
    { key: 'uppercase', text: t('securityScreen.changePassword.requirements.uppercase'), met: /[A-Z]/.test(newPassword) },
    { key: 'lowercase', text: t('securityScreen.changePassword.requirements.lowercase'), met: /[a-z]/.test(newPassword) },
    { key: 'number', text: t('securityScreen.changePassword.requirements.number'), met: /[0-9]/.test(newPassword) },
  ];

  const SessionItem = ({ session }: { session: Session }) => (
    <View
      className={`p-4 ${
        isDark ? 'bg-gray-900' : 'bg-white'
      } mb-2 rounded-xl`}
    >
      <View className="flex-row items-start">
        <View
          style={{ backgroundColor: session.isCurrent ? '#10B98120' : '#6B728020' }}
          className="w-12 h-12 rounded-full justify-center items-center"
        >
          <Ionicons
            name={getDeviceIcon(session.deviceType) as any}
            size={24}
            color={session.isCurrent ? '#10B981' : '#6B7280'}
          />
        </View>

        <View className="flex-1 ml-4">
          <View className="flex-row items-center">
            <Text
              className={`text-base font-semibold ${
                isDark ? 'text-white' : 'text-black'
              }`}
            >
              {session.deviceName}
            </Text>
            {session.isCurrent && (
              <View className="ml-2 px-2 py-1 bg-green-500/20 rounded-full">
                <Text className="text-xs font-medium text-green-500">
                  {t('securityScreen.sessions.current')}
                </Text>
              </View>
            )}
          </View>

          <Text
            className={`text-sm mt-1 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {session.location}
          </Text>

          <Text
            className={`text-xs mt-1 ${
              isDark ? 'text-gray-500' : 'text-gray-500'
            }`}
          >
            {t('securityScreen.sessions.lastActive')}: {session.lastActive}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => handleSignOutSession(session.id, session.isCurrent)}
          disabled={isProcessing}
          className="ml-2"
        >
          <Ionicons
            name="exit-outline"
            size={20}
            color="#EF4444"
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-gray-50'}`}>
      <Header
        title={t('securityScreen.title')}
        showBackButton
        onBackPress={() => router.back()}
      />

      <ScrollView className="flex-1">
        {/* Info Card */}
        <View
          className={`mx-4 mt-4 mb-6 p-4 rounded-xl ${
            isDark ? 'bg-blue-900/20' : 'bg-blue-50'
          }`}
        >
          <View className="flex-row items-start">
            <Ionicons
              name="information-circle"
              size={24}
              color="#3B82F6"
              style={{ marginTop: 2 }}
            />
            <Text
              className={`flex-1 ml-3 text-sm ${
                isDark ? 'text-blue-200' : 'text-blue-900'
              }`}
            >
              {t('securityScreen.info')}
            </Text>
          </View>
        </View>

        {/* Change Password Section */}
        <View className="mb-6">
          <Text
            className={`text-sm font-semibold px-6 mb-3 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {t('securityScreen.password.title')}
          </Text>
          <View className="px-4">
            <TouchableOpacity
              onPress={handleOpenChangePassword}
              className={`flex-row items-center py-4 px-4 ${
                isDark ? 'bg-gray-900' : 'bg-white'
              } rounded-xl`}
              activeOpacity={0.7}
              disabled={isProcessing}
            >
              <View
                style={{ backgroundColor: '#3B82F620' }}
                className="w-12 h-12 rounded-full justify-center items-center"
              >
                <Ionicons
                  name="key-outline"
                  size={24}
                  color="#3B82F6"
                />
              </View>

              <View className="flex-1 ml-4">
                <Text
                  className={`text-base font-semibold ${
                    isDark ? 'text-white' : 'text-black'
                  }`}
                >
                  {t('securityScreen.password.change')}
                </Text>
                <Text
                  className={`text-sm mt-1 ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  {t('securityScreen.password.subtitle')}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={isDark ? '#9CA3AF' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Sessions */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between px-6 mb-3">
            <Text
              className={`text-sm font-semibold ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {t('securityScreen.sessions.title')}
            </Text>
            {sessions.filter(s => !s.isCurrent).length > 0 && (
              <TouchableOpacity
                onPress={handleSignOutAllOther}
                disabled={isProcessing}
              >
                <Text className="text-sm font-semibold text-red-500">
                  {t('securityScreen.sessions.signOutAll.button')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="px-4">
            {isLoading ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="large" color="#F97316" />
              </View>
            ) : sessions.length === 0 ? (
              <View
                className={`p-6 rounded-xl ${
                  isDark ? 'bg-gray-900' : 'bg-white'
                }`}
              >
                <Text
                  className={`text-center ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  {t('securityScreen.sessions.noSessions')}
                </Text>
              </View>
            ) : (
              sessions.map((session) => (
                <SessionItem key={session.id} session={session} />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        transparent={false}
        onRequestClose={handleClosePasswordModal}
      >
        <SafeAreaView className={`flex-1 ${isDark ? 'bg-black' : 'bg-gray-50'}`}>
          <View className="flex-row items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <TouchableOpacity
              onPress={handleClosePasswordModal}
              disabled={isChangingPassword}
              className="mr-4"
            >
              <Ionicons
                name="close"
                size={28}
                color={isDark ? '#FFF' : '#000'}
              />
            </TouchableOpacity>
            <Text
              className={`text-xl font-bold ${
                isDark ? 'text-white' : 'text-black'
              }`}
            >
              {t('securityScreen.changePassword.title')}
            </Text>
          </View>

          <ScrollView className="flex-1 px-6">
            {/* Info */}
            <View
              className={`mt-4 mb-6 p-4 rounded-xl ${
                isDark ? 'bg-blue-900/20' : 'bg-blue-50'
              }`}
            >
              <Text
                className={`text-sm ${
                  isDark ? 'text-blue-200' : 'text-blue-900'
                }`}
              >
                {t('securityScreen.changePassword.info')}
              </Text>
            </View>

            {/* Current Password */}
            <View className="mb-4">
              <Input
                label={t('securityScreen.changePassword.labels.current')}
                placeholder={t('securityScreen.changePassword.placeholders.current')}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                leftIcon="lock-closed-outline"
                rightIcon={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                onRightIconPress={() => setShowCurrentPassword(!showCurrentPassword)}
                secureTextEntry={!showCurrentPassword}
                editable={!isChangingPassword}
              />
            </View>

            {/* New Password */}
            <View className="mb-4">
              <Input
                label={t('securityScreen.changePassword.labels.new')}
                placeholder={t('securityScreen.changePassword.placeholders.new')}
                value={newPassword}
                onChangeText={setNewPassword}
                leftIcon="key-outline"
                rightIcon={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                onRightIconPress={() => setShowNewPassword(!showNewPassword)}
                secureTextEntry={!showNewPassword}
                editable={!isChangingPassword}
              />
            </View>

            {/* Password Requirements */}
            {newPassword.length > 0 && (
              <View className="mb-4">
                <Text
                  className={`text-sm font-semibold mb-2 ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  {t('securityScreen.changePassword.requirements.title')}
                </Text>
                {passwordRequirements.map((req) => (
                  <View key={req.key} className="flex-row items-center mb-2">
                    <Ionicons
                      name={req.met ? 'checkmark-circle' : 'close-circle'}
                      size={18}
                      color={req.met ? '#10B981' : '#EF4444'}
                    />
                    <Text
                      className={`ml-2 text-sm ${
                        req.met
                          ? 'text-green-500'
                          : isDark
                          ? 'text-gray-400'
                          : 'text-gray-600'
                      }`}
                    >
                      {req.text}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Confirm Password */}
            <View className="mb-6">
              <Input
                label={t('securityScreen.changePassword.labels.confirm')}
                placeholder={t('securityScreen.changePassword.placeholders.confirm')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                leftIcon="checkmark-circle-outline"
                rightIcon={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
                secureTextEntry={!showConfirmPassword}
                editable={!isChangingPassword}
              />
            </View>

            {/* Change Button */}
            <Button
              title={t('securityScreen.changePassword.button')}
              onPress={handleChangePassword}
              variant="primary"
              disabled={isChangingPassword}
              loading={isChangingPassword}
              fullWidth
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}