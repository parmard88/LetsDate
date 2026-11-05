import { createStackNavigator } from "@react-navigation/stack";
import { NavigationContainer } from "@react-navigation/native";
import React from "react";

import { WelcomeScreen } from "@/screens/auth/WelcomeScreen";
import { COLORS } from "@/theme";

const Stack = createStackNavigator();

type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
};

export function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={WelcomeScreen} />
      <Stack.Screen name="Register" component={WelcomeScreen} />
    </Stack.Navigator>
  );
}

import type { Theme } from "@react-navigation/native";

const navigationTheme: Theme = {
  dark: false,
  colors: {
    primary: COLORS.primary,
    background: COLORS.background,
    card: COLORS.white,
    text: COLORS.foreground,
    border: COLORS.line,
    notification: COLORS.primary,
  },
  fonts: {
    regular: { fontFamily: "Arial", fontWeight: "400" },
    medium: { fontFamily: "Arial", fontWeight: "500" },
    bold: { fontFamily: "Arial", fontWeight: "700" },
    heavy: { fontFamily: "Arial", fontWeight: "900" },
  },
};

export default function RootNavigation() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <AuthStack />
    </NavigationContainer>
  );
}
