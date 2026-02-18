// components/QuoteListItem.tsx
// Quote list item with swipe-to-delete — CLAUDE.md section 4.6

import { useRef } from "react";
import { Alert, Animated, Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import type { Quote } from "@/types/database";
import type { QuoteStatus } from "@/types/quote";

interface QuoteListItemProps {
  quote: Quote;
  currencySymbol?: string;
  onPress: (quote: Quote) => void;
  onDelete: (quoteId: string) => void;
}

const STATUS_COLORS: Record<QuoteStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-600 dark:text-gray-400", label: "Draft" },
  calculated: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", label: "Calculated" },
  sent: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", label: "Sent" },
  accepted: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", label: "Accepted" },
  rejected: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", label: "Rejected" },
};

const FENCE_TYPE_LABELS: Record<string, string> = {
  wood_privacy: "Wood Privacy",
  wood_picket: "Wood Picket",
  chain_link: "Chain Link",
  vinyl: "Vinyl",
  aluminum: "Aluminum",
};

export default function QuoteListItem({
  quote,
  currencySymbol = "$",
  onPress,
  onDelete,
}: QuoteListItemProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const status = quote.status as QuoteStatus;
  const statusConfig = STATUS_COLORS[status] ?? STATUS_COLORS.draft;

  const fenceType = quote.inputs?.fence_type ?? "wood_privacy";
  const fenceLabel = FENCE_TYPE_LABELS[fenceType] ?? fenceType;
  const length = quote.inputs?.length ?? 0;

  const createdDate = new Date(quote.created_at);
  const formattedDate = createdDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleDelete = () => {
    Alert.alert(
      "Delete Quote",
      `Are you sure you want to delete the quote for ${quote.client_name}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => swipeableRef.current?.close(),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            swipeableRef.current?.close();
            onDelete(quote.id);
          },
        },
      ]
    );
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.5],
      extrapolate: "clamp",
    });

    return (
      <Pressable
        className="bg-red-500 justify-center items-center px-6 rounded-r-xl"
        onPress={handleDelete}
      >
        <Animated.Text
          className="text-white font-semibold"
          style={{ transform: [{ scale }] }}
        >
          Delete
        </Animated.Text>
      </Pressable>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
    >
      <Pressable
        className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-750"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 1,
        }}
        onPress={() => onPress(quote)}
      >
        {/* Header Row */}
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-3">
            <Text
              className="text-lg font-semibold text-gray-900 dark:text-white"
              numberOfLines={1}
            >
              {quote.client_name}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {fenceLabel} • {length} ft
            </Text>
          </View>

          {/* Status Badge */}
          <View className={`px-2.5 py-1 rounded-full ${statusConfig.bg}`}>
            <Text className={`text-xs font-medium ${statusConfig.text}`}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Footer Row */}
        <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {formattedDate}
          </Text>
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            {currencySymbol}
            {quote.total.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </View>
      </Pressable>
    </Swipeable>
  );
}

// ============================================================
// QUOTE LIST COMPONENT
// ============================================================

interface QuoteListProps {
  quotes: Quote[];
  currencySymbol?: string;
  onQuotePress: (quote: Quote) => void;
  onQuoteDelete: (quoteId: string) => void;
}

export function QuoteList({
  quotes,
  currencySymbol = "$",
  onQuotePress,
  onQuoteDelete,
}: QuoteListProps) {
  return (
    <View className="gap-4">
      {quotes.map((quote) => (
        <QuoteListItem
          key={quote.id}
          quote={quote}
          currencySymbol={currencySymbol}
          onPress={onQuotePress}
          onDelete={onQuoteDelete}
        />
      ))}
    </View>
  );
}
