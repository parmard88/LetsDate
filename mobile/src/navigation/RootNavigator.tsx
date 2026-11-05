import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import type { Theme } from '@react-navigation/native';

import { apiRequest } from '../lib/api';
import { sessionService } from '../services/session';
import { MeResponse } from '../types/api';
import { COLORS } from '../theme';
import { AuthScreen } from '../screens/auth/AuthScreen';

const Stack = createStackNavigator();

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

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
    regular: { fontFamily: 'Arial', fontWeight: '400' },
    medium: { fontFamily: 'Arial', fontWeight: '500' },
    bold: { fontFamily: 'Arial', fontWeight: '700' },
    heavy: { fontFamily: 'Arial', fontWeight: '900' },
  },
};

export default function RootNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const token = await sessionService.getToken();
      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      const response = await apiRequest<MeResponse>('/api/auth/me');
      if (response.success) {
        setIsAuthenticated(true);
      } else {
        await sessionService.clearToken();
        setIsAuthenticated(false);
      }
    } catch {
      await sessionService.clearToken();
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="App" component={() => null} />
        ) : (
          <Stack.Screen
            name="Auth"
            component={() => (
              <AuthScreen onAuthSuccess={() => checkSession()} />
            )}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
