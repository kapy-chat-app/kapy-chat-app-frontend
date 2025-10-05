import { Stack } from "expo-router";

export default function MessageInfoLayout(){
    return (
        <Stack>
            <Stack.Screen name="[id]" options={{headerShown:false}}/>
            <Stack.Screen name="add-members/[id]" options={{headerShown:false}}/>
        </Stack>
    )
}