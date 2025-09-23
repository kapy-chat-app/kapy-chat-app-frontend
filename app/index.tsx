import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View, Text } from 'react-native';

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  // Show loading while checking authentication
  if (!isLoaded) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 dark:bg-gray-900">
        <ActivityIndicator size="large" color="#FF8C42" />
        <Text className="mt-4 text-gray-600 dark:text-gray-400">
          Checking authentication...
        </Text>
      </View>
    );
  }

  // Redirect based on authentication status
  if (isSignedIn) {
    return <Redirect href="/(tabs)/home" />;
  } else {
    return <Redirect href="/(auth)/sign-in" />;
  }
}