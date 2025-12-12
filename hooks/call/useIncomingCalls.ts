// hooks/call/useIncomingCalls.ts - COMPLETE UNIFIED VERSION
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import io, { Socket } from 'socket.io-client';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus, Platform, NativeModules } from 'react-native';
import { Audio } from 'expo-av';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const API_URL = process.env.EXPO_PUBLIC_API_URL;

const { CallNotification } = NativeModules;

interface IncomingCallData {
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
}

interface CallNotificationData {
  type: string;
  action?: string;
  callId: string;
  channelName: string;
  conversationId: string;
  callType: 'audio' | 'video';
  callerId: string;
  caller_name: string;
  caller_avatar?: string;
  conversation_type?: 'private' | 'group';
  conversation_name?: string;
  conversation_avatar?: string;
  participants_count?: number;
}

export const useIncomingCalls = () => {
  const { userId, getToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [ringtoneSound, setRingtoneSound] = useState<Audio.Sound | null>(null);
  
  const isHandlingNotification = useRef(false);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentCallIdRef = useRef<string | null>(null);

  // ⭐ Play ringtone
  const playRingtone = useCallback(async () => {
    try {
      if (ringtoneSound) {
        const status = await ringtoneSound.getStatusAsync();
        if (status.isLoaded) {
          await ringtoneSound.stopAsync();
        }
        await ringtoneSound.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/ringtone.mp3'),
        { 
          shouldPlay: true, 
          isLooping: true,
          volume: 1.0
        }
      );
      
      setRingtoneSound(sound);
      await sound.playAsync();
      
      console.log('🔊 Ringtone started playing');
    } catch (error) {
      console.error('❌ Error playing ringtone:', error);
    }
  }, [ringtoneSound]);

  // ⭐ Stop ringtone
  const stopRingtone = useCallback(async () => {
    try {
      if (ringtoneSound) {
        const status = await ringtoneSound.getStatusAsync();
        if (status.isLoaded) {
          await ringtoneSound.stopAsync();
        }
        await ringtoneSound.unloadAsync();
        setRingtoneSound(null);
        console.log('🔇 Ringtone stopped');
      }
    } catch (error) {
      console.error('❌ Error stopping ringtone:', error);
      setRingtoneSound(null);
    }
  }, [ringtoneSound]);

  // ⭐ Handle incoming call (SINGLE SOURCE OF TRUTH)
  const handleIncomingCallFromNotification = useCallback(async (callData: IncomingCallData) => {
    // Prevent duplicate handling
    if (isHandlingNotification.current) {
      console.log('⚠️ Already handling a call notification, skipping...');
      return;
    }

    // Check if same call already being handled
    if (currentCallIdRef.current === callData.call_id) {
      console.log('⚠️ This call is already being handled:', callData.call_id);
      return;
    }

    console.log('📞 Processing incoming call:', callData);
    
    // Don't show if I'm the caller
    if (callData.caller_id === userId) {
      console.log('📞 Ignoring incoming call from self');
      return;
    }

    isHandlingNotification.current = true;
    currentCallIdRef.current = callData.call_id;

    // Clear any existing timeout
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
    }

    // Set call data and show modal
    setIncomingCall(callData);
    setShowIncomingCall(true);

    // Play ringtone
    await playRingtone();

    // Dismiss native notification if exists
    if (Platform.OS === 'android' && CallNotification) {
      try {
        await CallNotification.dismissIncomingCallNotification();
      } catch (error) {
        console.log('No native notification to dismiss');
      }
    }

    // Auto-dismiss after 30 seconds
    callTimeoutRef.current = setTimeout(() => {
      console.log('⏰ Call timeout - auto rejecting');
      rejectCall(callData.call_id);
    }, 30000);

    // Reset flag after a short delay
    setTimeout(() => {
      isHandlingNotification.current = false;
    }, 1000);
  }, [userId, playRingtone]);

  // ⭐ DETECTION #1: App launched from KILLED state
  useEffect(() => {
    if (!userId) return;

    const checkInitialNotification = async () => {
      try {
        const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();
        
        if (lastNotificationResponse) {
          const data = lastNotificationResponse.notification.request.content.data as CallNotificationData;
          
          console.log('📱 App opened from KILLED state with notification:', data);
          
          if (data.type === 'call' && data.action === 'incoming_call') {
            setTimeout(() => {
              handleIncomingCallFromNotification({
                call_id: data.callId,
                caller_id: data.callerId,
                caller_name: data.caller_name,
                caller_avatar: data.caller_avatar,
                call_type: data.callType,
                channel_name: data.channelName,
                conversation_id: data.conversationId,
                conversation_type: data.conversation_type || 'private',
                conversation_name: data.conversation_name,
                conversation_avatar: data.conversation_avatar,
                participants_count: data.participants_count,
              });
            }, 500);
          }
        }
      } catch (error) {
        console.error('❌ Error checking initial notification:', error);
      }
    };

    checkInitialNotification();
  }, [userId, handleIncomingCallFromNotification]);

  // ⭐ DETECTION #2: Notification tapped (BACKGROUND/FOREGROUND)
  useEffect(() => {
    if (!userId) return;

    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data as CallNotificationData;
        
        console.log('📱 Notification tapped:', data);
        
        if (data.type === 'call' && data.action === 'incoming_call') {
          setTimeout(() => {
            handleIncomingCallFromNotification({
              call_id: data.callId,
              caller_id: data.callerId,
              caller_name: data.caller_name,
              caller_avatar: data.caller_avatar,
              call_type: data.callType,
              channel_name: data.channelName,
              conversation_id: data.conversationId,
              conversation_type: data.conversation_type || 'private',
              conversation_name: data.conversation_name,
              conversation_avatar: data.conversation_avatar,
              participants_count: data.participants_count,
            });
          }, 300);
        }
      }
    );

    return () => {
      notificationSubscription.remove();
    };
  }, [userId, handleIncomingCallFromNotification]);

  // ⭐ DETECTION #3: App state changes (BACKGROUND → FOREGROUND)
  useEffect(() => {
    if (!userId) return;

    const appStateSubscription = AppState.addEventListener(
      'change',
      async (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          console.log('📱 App became active, checking for pending call notifications...');
          
          const notifications = await Notifications.getPresentedNotificationsAsync();
          
          const callNotification = notifications.find(
            (notif) => {
              const data = notif.request.content.data as CallNotificationData;
              return data.type === 'call' && data.action === 'incoming_call';
            }
          );

          if (callNotification) {
            const data = callNotification.request.content.data as CallNotificationData;
            
            console.log('📱 Found pending call notification:', data);
            
            setTimeout(() => {
              handleIncomingCallFromNotification({
                call_id: data.callId,
                caller_id: data.callerId,
                caller_name: data.caller_name,
                caller_avatar: data.caller_avatar,
                call_type: data.callType,
                channel_name: data.channelName,
                conversation_id: data.conversationId,
                conversation_type: data.conversation_type || 'private',
                conversation_name: data.conversation_name,
                conversation_avatar: data.conversation_avatar,
                participants_count: data.participants_count,
              });
            }, 300);

            await Notifications.dismissNotificationAsync(
              callNotification.request.identifier
            );
          }
        }
      }
    );

    return () => {
      appStateSubscription.remove();
    };
  }, [userId, handleIncomingCallFromNotification]);

  // ⭐ Socket connection (REAL-TIME for app running)
  useEffect(() => {
    if (!userId) return;

    console.log('📞 Connecting to socket for incoming calls');
    
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('📞 Socket connected, ID:', newSocket.id);
      
      const personalRoom = `user:${userId}`;
      newSocket.emit('join', personalRoom);
      console.log(`📞 Joined personal room: ${personalRoom}`);
      
      newSocket.emit('addNewUsers', { _id: userId });
    });

    // ⭐ SOCKET EVENT: incomingCall
    newSocket.on('incomingCall', async (data: IncomingCallData) => {
      console.log('📞 Incoming call received via socket:', data);
      
      if (data.caller_id === userId) {
        console.log('📞 Ignoring incoming call from self');
        return;
      }
      
      await handleIncomingCallFromNotification(data);
    });

    newSocket.on('callAnswered', async (data: any) => {
      console.log('📞 Call answered:', data);
      
      // For 1-1 calls, if someone else answered, hide modal
      if (data.conversation_type !== 'group' && data.answered_by !== userId) {
        await stopRingtone();
        setShowIncomingCall(false);
        setIncomingCall(null);
        currentCallIdRef.current = null;
        
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
        }
      }
    });

    newSocket.on('callRejected', async (data: any) => {
      console.log('📞 Call rejected:', data);
      
      if (data.call_id === currentCallIdRef.current) {
        await stopRingtone();
        setIncomingCall(null);
        setShowIncomingCall(false);
        currentCallIdRef.current = null;
        
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
        }
      }
    });

    newSocket.on('callEnded', async (data: any) => {
      console.log('📞 Call ended:', data);
      
      if (data.call_id === currentCallIdRef.current) {
        await stopRingtone();
        setIncomingCall(null);
        setShowIncomingCall(false);
        currentCallIdRef.current = null;
        
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
        }
      }
    });

    newSocket.on('callParticipantsUpdated', (data: { 
      call_id: string, 
      participants_count: number 
    }) => {
      if (incomingCall && incomingCall.call_id === data.call_id) {
        setIncomingCall(prev => prev ? {
          ...prev,
          participants_count: data.participants_count,
        } : null);
      }
    });

    setSocket(newSocket);

    return () => {
      stopRingtone();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
      newSocket.disconnect();
    };
  }, [userId, handleIncomingCallFromNotification]);

  // ⭐ Answer call
  const answerCall = useCallback(async (callId: string) => {
    try {
      await stopRingtone();
      
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }

      const token = await getToken();
      const response = await axios.post(
        `${API_URL}/api/calls/${callId}/answer`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('✅ Call answered successfully');
      setShowIncomingCall(false);
      currentCallIdRef.current = null;
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error answering call:', error);
      
      if (error.response?.data?.message === "Already in call") {
        console.log('✅ Already in call, proceeding...');
        setShowIncomingCall(false);
        currentCallIdRef.current = null;
        return error.response.data;
      }
      
      throw error;
    }
  }, [getToken, stopRingtone]);

  // ⭐ Reject call
  const rejectCall = useCallback(async (callId: string) => {
    try {
      await stopRingtone();
      
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }

      const token = await getToken();
      await axios.post(
        `${API_URL}/api/calls/${callId}/reject`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('✅ Call rejected successfully');
      setIncomingCall(null);
      setShowIncomingCall(false);
      currentCallIdRef.current = null;
    } catch (error: any) {
      console.error('❌ Error rejecting call:', error);
      setIncomingCall(null);
      setShowIncomingCall(false);
      currentCallIdRef.current = null;
    }
  }, [getToken, stopRingtone]);

  // ⭐ Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRingtone();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
    };
  }, [stopRingtone]);

  return {
    incomingCall,
    showIncomingCall,
    answerCall,
    rejectCall,
    socket,
    handleIncomingCallFromNotification,
  };
};