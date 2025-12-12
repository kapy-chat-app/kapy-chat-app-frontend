import { Stack } from "expo-router";

export default function ContactRoutesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
       <Stack.Screen name="blocks" options={{ headerShown: false }} />
      <Stack.Screen name="requests" options={{ headerShown: false }} />
      <Stack.Screen name="public-profile/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}