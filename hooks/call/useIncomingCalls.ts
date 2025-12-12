<<<<<<< HEAD
// hooks/useIncomingCalls.ts - Enhanced for Group Calls
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import io, { Socket } from 'socket.io-client';
import axios from 'axios';
=======
// hooks/call/useIncomingCalls.ts - COMPLETE UNIFIED VERSION
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import io, { Socket } from 'socket.io-client';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus, Platform, NativeModules } from 'react-native';
import { Audio } from 'expo-av';
>>>>>>> rebuild-super-clean

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const API_URL = process.env.EXPO_PUBLIC_API_URL;

<<<<<<< HEAD
=======
const { CallNotification } = NativeModules;

>>>>>>> rebuild-super-clean
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

<<<<<<< HEAD
=======
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

>>>>>>> rebuild-super-clean
export const useIncomingCalls = () => {
  const { userId, getToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
<<<<<<< HEAD

  // Initialize socket connection
  useEffect(() => {
    if (!userId) return;

    console.log('📞 Connecting to socket for incoming calls, userId:', userId);
=======
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
>>>>>>> rebuild-super-clean
    
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('📞 Socket connected, ID:', newSocket.id);
      
<<<<<<< HEAD
      // Join personal room
=======
>>>>>>> rebuild-super-clean
      const personalRoom = `user:${userId}`;
      newSocket.emit('join', personalRoom);
      console.log(`📞 Joined personal room: ${personalRoom}`);
      
<<<<<<< HEAD
      // Legacy support
      newSocket.emit('addNewUsers', {
        _id: userId,
      });
    });

    newSocket.on('disconnect', () => {
      console.log('📞 Socket disconnected');
    });

    newSocket.on('roomJoined', (room: string) => {
      console.log(`✅ Successfully joined room: ${room}`);
    });

    // Listen for incoming calls
    newSocket.on('incomingCall', (data: IncomingCallData) => {
      console.log('📞 Incoming call received:', data);
      
      // Don't show incoming call if I'm the caller
=======
      newSocket.emit('addNewUsers', { _id: userId });
    });

    // ⭐ SOCKET EVENT: incomingCall
    newSocket.on('incomingCall', async (data: IncomingCallData) => {
      console.log('📞 Incoming call received via socket:', data);
      
>>>>>>> rebuild-super-clean
      if (data.caller_id === userId) {
        console.log('📞 Ignoring incoming call from self');
        return;
      }
      
<<<<<<< HEAD
      // For group calls, show additional info
      if (data.conversation_type === 'group') {
        console.log(`📞 Group call from ${data.caller_name} in ${data.conversation_name}`);
        console.log(`📞 ${data.participants_count || 0} participants already in call`);
      }
      
      setIncomingCall(data);
      setShowIncomingCall(true);
    });

    // Listen for call answered
    newSocket.on('callAnswered', (data: any) => {
      console.log('📞 Call answered event received:', data);
      
      // For group calls, multiple people can answer
      // Don't hide the incoming call dialog automatically
      if (data.conversation_type !== 'group' && data.answered_by !== userId) {
        // For 1-1 calls, if someone else answered, hide dialog
        console.log('📞 Someone else answered the 1-1 call');
        setShowIncomingCall(false);
        setIncomingCall(null);
      }
    });

    // Listen for call rejected
    newSocket.on('callRejected', (data: any) => {
      console.log('📞 Call rejected event received:', data);
      
      // Only hide if I rejected
      if (data.rejected_by === userId) {
        setIncomingCall(null);
        setShowIncomingCall(false);
      }
    });

    // Listen for call ended
    newSocket.on('callEnded', (data: any) => {
      console.log('📞 Call ended event received:', data);
      setIncomingCall(null);
      setShowIncomingCall(false);
    });

    // Listen for participant updates in group calls
=======
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

>>>>>>> rebuild-super-clean
    newSocket.on('callParticipantsUpdated', (data: { 
      call_id: string, 
      participants_count: number 
    }) => {
<<<<<<< HEAD
      console.log('📞 Participants count updated:', data);
      
      // Update current incoming call data if it matches
=======
>>>>>>> rebuild-super-clean
      if (incomingCall && incomingCall.call_id === data.call_id) {
        setIncomingCall(prev => prev ? {
          ...prev,
          participants_count: data.participants_count,
        } : null);
      }
    });

    setSocket(newSocket);

    return () => {
<<<<<<< HEAD
      console.log('📞 Cleaning up socket connection');
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [userId]);

  // Answer call
  const answerCall = useCallback(async (callId: string) => {
    try {
=======
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

>>>>>>> rebuild-super-clean
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

<<<<<<< HEAD
      console.log('✅ Call answered successfully:', response.data);
      
      // Hide incoming call dialog after answering
      setShowIncomingCall(false);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error answering call:', error.response?.data || error.message);
      
      // If already in call (group call scenario), still proceed
      if (error.response?.data?.message === "Already in call") {
        console.log('✅ Already in call, proceeding...');
        setShowIncomingCall(false);
=======
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
>>>>>>> rebuild-super-clean
        return error.response.data;
      }
      
      throw error;
    }
<<<<<<< HEAD
  }, [getToken]);

  // Reject call
  const rejectCall = useCallback(async (callId: string) => {
    try {
      const token = await getToken();
      const response = await axios.post(
=======
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
>>>>>>> rebuild-super-clean
        `${API_URL}/api/calls/${callId}/reject`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

<<<<<<< HEAD
      console.log('✅ Call rejected successfully:', response.data);
      setIncomingCall(null);
      setShowIncomingCall(false);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error rejecting call:', error.response?.data || error.message);
      throw error;
    }
  }, [getToken]);
=======
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
>>>>>>> rebuild-super-clean

  return {
    incomingCall,
    showIncomingCall,
    answerCall,
    rejectCall,
    socket,
<<<<<<< HEAD
=======
    handleIncomingCallFromNotification,
>>>>>>> rebuild-super-clean
  };
};