export interface PushNotificationData {
  type: 'message' | 'call' | 'friend_request';
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  chatId?: string;
  callId?: string;
  timestamp?: number;
}

export interface NotificationContent {
  title: string;
  body: string;
  data: PushNotificationData;
}

export interface PushTokenData {
  userId: string;
  pushToken: string;
  platform: 'ios' | 'android';
}