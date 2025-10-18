// components/IncomingCallModal.tsx
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
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
  } | null;
  onAnswer: (callId: string) => void;
  onReject: (callId: string) => void;
}

export default function IncomingCallModal({
  visible,
  callData,
  onAnswer,
  onReject,
}: IncomingCallProps) {
  const router = useRouter();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const pulseAnim = useState(new Animated.Value(1))[0];

  // Play ringtone and vibrate
  useEffect(() => {
    if (visible && callData) {
      playRingtone();
      startVibration();
      startPulseAnimation();
    } else {
      stopRingtone();
      stopVibration();
    }

    return () => {
      stopRingtone();
      stopVibration();
    };
  }, [visible, callData]);

  const playRingtone = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/ringtone.mp3'), // Add your ringtone
        { shouldPlay: true, isLooping: true }
      );
      setSound(sound);
    } catch (error) {
      console.error('Error playing ringtone:', error);
    }
  };

  const stopRingtone = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
  };

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

  const handleAnswer = () => {
    if (callData) {
      stopRingtone();
      stopVibration();
      onAnswer(callData.call_id);
      
      // Navigate to call screen
      router.push({
        pathname: '/call/[id]' as any,
        params: {
          id: callData.call_id,
          channelName: callData.channel_name,
          conversationId: callData.conversation_id,
          callType: callData.call_type,
        },
      });
    }
  };

  const handleReject = () => {
    if (callData) {
      stopRingtone();
      stopVibration();
      onReject(callData.call_id);
    }
  };

  if (!visible || !callData) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleReject}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Caller Avatar */}
          <Animated.View 
            style={[
              styles.avatarContainer,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            {callData.caller_avatar ? (
              <Image
                source={{ uri: callData.caller_avatar }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={60} color="#fff" />
              </View>
            )}
          </Animated.View>

          {/* Call Info */}
          <Text style={styles.callerName}>{callData.caller_name}</Text>
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

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* Reject Button */}
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={handleReject}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>

            {/* Answer Button */}
            <TouchableOpacity
              style={[styles.actionButton, styles.answerButton]}
              onPress={handleAnswer}
            >
              <Ionicons name="call" size={32} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.labelContainer}>
            <Text style={styles.label}>Decline</Text>
            <Text style={styles.label}>Answer</Text>
          </View>
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
  },
  avatarContainer: {
    marginBottom: 30,
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
  callerName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  callTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 60,
  },
  callTypeText: {
    fontSize: 16,
    color: '#9ca3af',
    marginLeft: 8,
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
});