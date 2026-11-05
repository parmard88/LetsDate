import React from "react";
import { SafeAreaView, StatusBar } from "react-native";

import RootNavigator from "@/navigation/RootNavigator";

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <RootNavigator />
    </SafeAreaView>
  );
}
