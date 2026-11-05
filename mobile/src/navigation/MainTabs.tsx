import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import React from "react";
import { Text, View } from "react-native";

import { COLORS } from "@/theme";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

export type RootTabParamList = {
  Discovery: undefined;
  Matches: undefined;
  Messages: undefined;
  Profile: undefined;
};

export type ConversationStackParamList = {
  Conversation: { conversationId: string; otherUserName: string };
};

export type MainTabsParamList = RootTabParamList & {
  ConversationStack: undefined;
};

function TabBarIcon({ focused, color, size, name }: { focused: boolean; color: string; size: number; name: string }) {
  return (
    <Text style={{ fontSize: size, color, textAlign: "center" }}>
      {name}
    </Text>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.line,
          borderTopWidth: 1,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
        },
      }}
    >
      <Tab.Screen name="Discovery" component={() => null} />
      <Tab.Screen name="Matches" component={() => null} />
      <Tab.Screen name="Messages" component={() => null} />
      <Tab.Screen name="Profile" component={() => null} />
    </Tab.Navigator>
  );
}

export function ConversationStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Conversation" component={() => null} />
    </Stack.Navigator>
  );
}

export default function RootNavigation() {
  return null;
}
