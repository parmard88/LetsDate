import { createStackNavigator } from "@react-navigation/stack";
import React from "react";

const Stack = createStackNavigator();

export type ChatStackParamList = {
  Conversation: { conversationId: string; otherUserName: string };
};

export function ChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Conversation" component={() => null} />
    </Stack.Navigator>
  );
}

export default ChatStack;
