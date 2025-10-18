// hooks/useIncomingCalls.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import io, { Socket } from 'socket.io-client';
import axios from 'axios';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface IncomingCallData {
  call_id: string;
  caller_id: string;
  caller_name: string;
  caller_avatar?: string;
  call_type: 'video' | 'audio';
  channel_name: string;
  conversation_id: string;
}

export const useIncomingCalls = () => {
  const { userId, getToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [showIncomingCall, setShowIncomingCall] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    if (!userId) return;

    console.log('📞 Connecting to socket for incoming calls, userId:', userId);
    
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('📞 Socket connected, ID:', newSocket.id);
      
      // ⭐ Join personal room với format đúng
      const personalRoom = `user:${userId}`;
      newSocket.emit('join', personalRoom);
      console.log(`📞 Joined personal room: ${personalRoom}`);
      
      // Legacy support - vẫn giữ để backward compatible
      newSocket.emit('addNewUsers', {
        _id: userId,
      });
    });

    newSocket.on('disconnect', () => {
      console.log('📞 Socket disconnected');
    });

    // ⭐ Confirm room join
    newSocket.on('roomJoined', (room: string) => {
      console.log(`✅ Successfully joined room: ${room}`);
    });

    // Listen for incoming calls
    newSocket.on('incomingCall', (data: IncomingCallData) => {
      console.log('📞 Incoming call received:', data);
      
      // ⭐ Không hiển thị incoming call nếu mình là caller
      if (data.caller_id === userId) {
        console.log('📞 Ignoring incoming call from self');
        return;
      }
      
      setIncomingCall(data);
      setShowIncomingCall(true);
    });

    // Listen for call answered (if caller)
    newSocket.on('callAnswered', (data: any) => {
      console.log('📞 Call answered event received:', data);
      // ⭐ Có thể thêm logic để update UI khi call được answer
    });

    // Listen for call rejected
    newSocket.on('callRejected', (data: any) => {
      console.log('📞 Call rejected event received:', data);
      setIncomingCall(null);
      setShowIncomingCall(false);
    });

    // Listen for call ended
    newSocket.on('callEnded', (data: any) => {
      console.log('📞 Call ended event received:', data);
      setIncomingCall(null);
      setShowIncomingCall(false);
    });

    setSocket(newSocket);

    return () => {
      console.log('📞 Cleaning up socket connection');
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [userId]);

  // Answer call
  const answerCall = useCallback(async (callId: string) => {
    try {
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

      console.log('✅ Call answered successfully:', response.data);
      setShowIncomingCall(false);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error answering call:', error.response?.data || error.message);
      throw error;
    }
  }, [getToken]);

  // Reject call
  const rejectCall = useCallback(async (callId: string) => {
    try {
      const token = await getToken();
      const response = await axios.post(
        `${API_URL}/api/calls/${callId}/reject`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log('✅ Call rejected successfully:', response.data);
      setIncomingCall(null);
      setShowIncomingCall(false);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error rejecting call:', error.response?.data || error.message);
      throw error;
    }
  }, [getToken]);

  return {
    incomingCall,
    showIncomingCall,
    answerCall,
    rejectCall,
    socket,
  };
};