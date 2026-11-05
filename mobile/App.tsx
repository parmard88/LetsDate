import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';

import RootNavigator from './src/navigation/RootNavigator'; // Ensure the file '../src/navigation/RootNavigator.tsx' exists

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <RootNavigator />
    </SafeAreaView>
  );
}
