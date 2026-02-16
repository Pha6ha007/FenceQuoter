// components/EmptyState.tsx
// Reusable empty state component — CLAUDE.md section 4.6

import { Pressable, Text, View } from "react-native";

interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon = "📋",
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-20 px-6">
      <View className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full items-center justify-center mb-6">
        <Text className="text-5xl">{icon}</Text>
      </View>

      <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
        {title}
      </Text>

      <Text className="text-gray-500 dark:text-gray-400 text-center mb-6 max-w-xs">
        {message}
      </Text>

      {actionLabel && onAction && (
        <Pressable
          className="bg-blue-600 rounded-xl py-3 px-8 active:bg-blue-700"
          onPress={onAction}
        >
          <Text className="text-white font-semibold text-base">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
