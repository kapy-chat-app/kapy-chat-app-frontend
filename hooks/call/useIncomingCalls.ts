// hooks/useIncomingCalls.ts - Enhanced for Group Calls
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
      
      // Join personal room
      const personalRoom = `user:${userId}`;
      newSocket.emit('join', personalRoom);
      console.log(`📞 Joined personal room: ${personalRoom}`);
      
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
      if (data.caller_id === userId) {
        console.log('📞 Ignoring incoming call from self');
        return;
      }
      
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
    newSocket.on('callParticipantsUpdated', (data: { 
      call_id: string, 
      participants_count: number 
    }) => {
      console.log('📞 Participants count updated:', data);
      
      // Update current incoming call data if it matches
      if (incomingCall && incomingCall.call_id === data.call_id) {
        setIncomingCall(prev => prev ? {
          ...prev,
          participants_count: data.participants_count,
        } : null);
      }
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
      
      // Hide incoming call dialog after answering
      setShowIncomingCall(false);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Error answering call:', error.response?.data || error.message);
      
      // If already in call (group call scenario), still proceed
      if (error.response?.data?.message === "Already in call") {
        console.log('✅ Already in call, proceeding...');
        setShowIncomingCall(false);
        return error.response.data;
      }
      
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