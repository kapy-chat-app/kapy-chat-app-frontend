import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSocket } from './useSocket';

export const useOnlineStatus = () => {
  const { socket, emit } = useSocket();

  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (socket) {
        if (nextAppState === 'active') {
          emit('userOnline');
        } else if (nextAppState === 'background' || nextAppState === 'inactive') {
          emit('userOffline');
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Set online when component mounts
    if (socket) {
      emit('userOnline');
    }

    return () => {
      subscription?.remove();
      // Set offline when component unmounts
      if (socket) {
        emit('userOffline');
      }
    };
  }, [socket, emit]);
};