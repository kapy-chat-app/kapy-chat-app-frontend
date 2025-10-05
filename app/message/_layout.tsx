import { Stack } from "expo-router";

export default function MessageLayout(){
    return(
        <Stack>
            <Stack.Screen name="[id]" options={{headerShown:false}}/>
            <Stack.Screen name="info" options={{headerShown:false}}/>
        </Stack>
    )
}