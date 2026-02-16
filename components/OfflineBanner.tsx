// components/OfflineBanner.tsx
// Offline status banner component — CLAUDE.md Phase 7

import { useEffect, useState } from "react";
import { Animated, Platform, Text, View } from "react-native";

import { useNetworkStatus, shouldShowOfflineBanner } from "@/hooks/useNetworkStatus";

export default function OfflineBanner() {
  const { status, isLoading } = useNetworkStatus();
  const [visible, setVisible] = useState(false);
  const [slideAnim] = useState(() => new Animated.Value(-50));

  const isOffline = shouldShowOfflineBanner(status);

  useEffect(() => {
    // Don't show banner while loading initial status
    if (isLoading) return;

    if (isOffline) {
      setVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [isOffline, isLoading, slideAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        position: "absolute",
        top: Platform.OS === "ios" ? 50 : 30,
        left: 16,
        right: 16,
        zIndex: 9999,
      }}
    >
      <View className="bg-amber-500 rounded-lg px-4 py-3 flex-row items-center justify-center shadow-lg">
        <Text className="text-white text-sm font-medium">
          {status.isConnected === false
            ? "You're offline — changes will sync when connected"
            : "Limited connectivity — some features may not work"}
        </Text>
      </View>
    </Animated.View>
  );
}
