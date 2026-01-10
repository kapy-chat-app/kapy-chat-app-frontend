// components/page/profile/UserLastSeen.tsx - AUTO FETCH VERSION

import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useSocket, formatLastSeen, getLastSeen } from '@/hooks/message/useSocket';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@clerk/clerk-expo';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface UserLastSeenProps {
  userId: string;
  showDot?: boolean;
  textSize?: 'xs' | 'sm' | 'base';
}

export const UserLastSeen: React.FC<UserLastSeenProps> = ({ 
  userId, 
  showDot = true,
  textSize = 'xs',
}) => {
  const { isUserOnline, onlineUsers } = useSocket();
  const { getToken } = useAuth();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  
  const [fetchedLastSeen, setFetchedLastSeen] = useState<Date | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  
  let isOnline = isUserOnline(userId);
  let lastSeen = getLastSeen(userId, onlineUsers);

  // ✅ AUTO FETCH: Nếu không tìm thấy trong onlineUsers và chưa fetch
  useEffect(() => {
    const shouldFetch = !isOnline && !lastSeen && !isFetching && !fetchedLastSeen;
    
    if (shouldFetch) {
      setIsFetching(true);
      
      getToken()
        .then(token => {
          return fetch(`${API_URL}/api/user/${userId}/last-seen`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
        })
        .then(res => res.json())
        .then(data => {
          if (data.last_seen) {
            setFetchedLastSeen(new Date(data.last_seen));
            console.log(`📋 [UserLastSeen] Fetched last_seen from API for ${userId}:`, data.last_seen);
          }
        })
        .catch(err => {
          console.error(`❌ [UserLastSeen] Failed to fetch last_seen for ${userId}:`, err);
        })
        .finally(() => {
          setIsFetching(false);
        });
    }
  }, [userId, isOnline, lastSeen, isFetching, fetchedLastSeen, getToken]);

  // ✅ Sử dụng fetched data nếu không có trong socket
  if (!lastSeen && fetchedLastSeen) {
    lastSeen = fetchedLastSeen;
  }

  const dotClass = `w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`;
  const textClass = `${textSize === 'xs' ? 'text-xs' : textSize === 'sm' ? 'text-sm' : 'text-base'} ${
    isOnline 
      ? 'text-green-500 font-medium' 
      : isDark ? 'text-gray-400' : 'text-gray-600'
  }`;

  if (isOnline) {
    return (
      <View className="flex-row items-center gap-1.5">
        {showDot && <View className={dotClass} />}
        <Text className={textClass}>
          Đang hoạt động
        </Text>
      </View>
    );
  }

  if (lastSeen) {
    return (
      <View className="flex-row items-center gap-1.5">
        {showDot && <View className={dotClass} />}
        <Text className={textClass}>
          Hoạt động {formatLastSeen(lastSeen)}
        </Text>
      </View>
    );
  }

  // ✅ Nếu đang fetch, hiển thị loading hoặc rỗng
  return null;
};