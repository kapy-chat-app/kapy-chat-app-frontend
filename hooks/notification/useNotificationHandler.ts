// hooks/notification/useNotificationHandler.ts - FIXED
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

interface NotificationData {
  type: 'message' | 'call' | 'friend_request' | 'friend_request_accepted';
  action?: string;
  conversationId?: string;
  messageId?: string;
  callId?: string;
  channelName?: string;
  callType?: 'audio' | 'video';
  userId?: string;
}

export function useNotificationHandler() {
  const router = useRouter();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // ⭐ ONLY handle notification TAPS (not incoming calls)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('👆 Notification tapped:', response);
        
        const data = response.notification.request.content.data as NotificationData;
        
        // ⭐ Skip call notifications (handled by useIncomingCalls)
        if (data.type === 'call') {
          console.log('⏭️ Call notification - skip (useIncomingCalls handles it)');
          return;
        }
        
        // ✅ Handle other notifications
        setTimeout(() => {
          handleNotificationData(data);
        }, 300);
      }
    );

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  const handleNotificationData = (data: NotificationData) => {
    console.log('🔔 Handling notification:', data);
    
    switch (data.type) {
      case 'message':
        if (data.conversationId) {
          router.push({
            pathname: '/message/[id]' as any,
            params: { 
              id: data.conversationId,
              scrollToMessageId: data.messageId || ''
            }
          });
        }
        break;

      case 'friend_request':
        router.push('/contacts/requests' as any);
        break;

      case 'friend_request_accepted':
        if (data.userId) {
          router.push(`/contacts/public-profile/${data.userId}` as any);
        }
        break;

      default:
        console.log('Unknown notification type:', data.type);
    }
  };

  return {
    handleNotificationNavigation: handleNotificationData
  };
}