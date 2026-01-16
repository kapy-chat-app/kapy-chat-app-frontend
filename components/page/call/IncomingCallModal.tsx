// components/IncomingCallModal.tsx - WITH NAVIGATION FIX
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface IncomingCallProps {
  visible: boolean;
  callData: {
    call_id: string;
    caller_id: string;
    caller_name: string;
    caller_avatar?: string;
    call_type: 'video' | 'audio';
    channel_name: string;
    conversation_id: string;
    conversation_type?: 'private' | 'group';
    conversation_name?: string;
    conversation_avatar?: string;
    participants_count?: number;
  } | null;
  onAnswer: (callId: string) => Promise<any>;
  onReject: (callId: string) => Promise<void>;
}

export default function IncomingCallModal({
  visible,
  callData,
  onAnswer,
  onReject,
}: IncomingCallProps) {
  const router = useRouter();
  const pulseAnim = useState(new Animated.Value(1))[0];
  const [isProcessing, setIsProcessing] = useState(false);

   useEffect(() => {
    if (visible && callData) {
      startVibration();
      startPulseAnimation();
      setIsProcessing(false); // ⭐ Reset processing state when modal opens
    } else {
      stopVibration();
      setIsProcessing(false); // ⭐ Reset processing state when modal closes
    }

    return () => {
      stopVibration();
      setIsProcessing(false);
    };
  }, [visible, callData]);

  const startVibration = () => {
    const pattern = [0, 1000, 500, 1000];
    Vibration.vibrate(pattern, true);
  };

  const stopVibration = () => {
    Vibration.cancel();
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleAnswer = async () => {
    if (!callData || isProcessing) return;

    try {
      console.log('📞 Answer button pressed:', callData.call_id);
      setIsProcessing(true);
      stopVibration();

      // Call answer API
      await onAnswer(callData.call_id);
      console.log('✅ onAnswer completed, navigating to call screen...');

      // Navigate to call screen
      router.push({
        pathname: '/call/[id]' as any,
        params: {
          id: callData.call_id,
          channelName: callData.channel_name,
          conversationId: callData.conversation_id,
          callType: callData.call_type,
          conversationType: callData.conversation_type || 'private',
        },
      });

      console.log('✅ Navigation called');
    } catch (error) {
      console.error('❌ Error in handleAnswer:', error);
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!callData || isProcessing) return;

    try {
      console.log('📞 Reject button pressed:', callData.call_id);
      setIsProcessing(true);
      stopVibration();

      await onReject(callData.call_id);
      console.log('✅ Call rejected');
    } catch (error) {
      console.error('❌ Error in handleReject:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!visible || !callData) return null;

  const isGroupCall = callData.conversation_type === 'group';
  
  const displayAvatar = isGroupCall 
    ? callData.conversation_avatar 
    : callData.caller_avatar;
  
  const displayName = isGroupCall
    ? callData.conversation_name || 'Group Call'
    : callData.caller_name;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleReject}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Animated.View 
            style={[
              styles.avatarContainer,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            {displayAvatar ? (
              <Image
                source={{ uri: displayAvatar }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons 
                  name={isGroupCall ? 'people' : 'person'} 
                  size={60} 
                  color="#fff" 
                />
              </View>
            )}
            
            {isGroupCall && (
              <View style={styles.groupBadge}>
                <Ionicons name="people" size={16} color="#fff" />
                {callData.participants_count && callData.participants_count > 0 && (
                  <Text style={styles.groupBadgeText}>
                    {callData.participants_count}
                  </Text>
                )}
              </View>
            )}
          </Animated.View>

          <View style={styles.infoContainer}>
            <Text style={styles.primaryName}>{displayName}</Text>
            
            {isGroupCall && (
              <View style={styles.callerInfoContainer}>
                <Ionicons name="person-circle-outline" size={18} color="#9ca3af" />
                <Text style={styles.callerName}>{callData.caller_name}</Text>
              </View>
            )}
          </View>

          <View style={styles.callTypeContainer}>
            <Ionicons
              name={callData.call_type === 'video' ? 'videocam' : 'call'}
              size={20}
              color="#fff"
            />
            <Text style={styles.callTypeText}>
              Incoming {callData.call_type} call...
            </Text>
          </View>

          {isGroupCall && callData.participants_count && callData.participants_count > 0 && (
            <View style={styles.participantsInfoContainer}>
              <Ionicons name="people-outline" size={16} color="#9ca3af" />
              <Text style={styles.participantsInfoText}>
                {callData.participants_count} {callData.participants_count === 1 ? 'person' : 'people'} already in call
              </Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={handleReject}
              disabled={isProcessing}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.answerButton]}
              onPress={handleAnswer}
              disabled={isProcessing}
            >
              <Ionicons name="call" size={32} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.labelContainer}>
            <Text style={styles.label}>Decline</Text>
            <Text style={styles.label}>{isGroupCall ? 'Join' : 'Answer'}</Text>
          </View>

          {/* Loading overlay */}
          {isProcessing && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#f97316" />
              <Text style={styles.loadingText}>Joining...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    alignItems: 'center',
    padding: 20,
    width: '100%',
  },
  avatarContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#f97316',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#374151',
    borderWidth: 4,
    borderColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#f97316',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: '#000',
  },
  groupBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  callerInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  callerName: {
    fontSize: 16,
    color: '#9ca3af',
  },
  callTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  callTypeText: {
    fontSize: 16,
    color: '#9ca3af',
    marginLeft: 8,
  },
  participantsInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 40,
  },
  participantsInfoText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 300,
    marginBottom: 20,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  answerButton: {
    backgroundColor: '#22c55e',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 300,
  },
  label: {
    fontSize: 14,
    color: '#9ca3af',
    width: 70,
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
});