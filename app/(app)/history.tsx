// app/(app)/history.tsx
// Quote history screen — CLAUDE.md section 4.6

import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import EmptyState from "@/components/EmptyState";
import { QuoteList } from "@/components/QuoteListItem";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  useQuotes,
  filterByTab,
  getTabCounts,
  canEditQuote,
} from "@/hooks/useQuotes";
import type { Quote } from "@/types/database";
type FilterTab = "active" | "sent" | "closed";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "sent", label: "Sent" },
  { key: "closed", label: "Closed" },
];

export default function HistoryScreen() {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;

  const {
    quotes,
    isLoading,
    fetchQuotes,
    deleteQuote,
  } = useQuotes(userId);

  const [activeFilter, setActiveFilter] = useState<FilterTab>("active");
  const [refreshing, setRefreshing] = useState(false);

  // Filter quotes by tab
  const filteredQuotes = useMemo(
    () => filterByTab(quotes, activeFilter),
    [quotes, activeFilter]
  );

  // Get counts for badges
  const counts = useMemo(
    () => getTabCounts(quotes),
    [quotes]
  );

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchQuotes();
    setRefreshing(false);
  }, [fetchQuotes]);

  // Navigate to quote
  const handleQuotePress = useCallback((quote: Quote) => {
    const isEditable = canEditQuote(quote);

    router.push({
      pathname: "./results",
      params: {
        quoteId: quote.id,
        variants: JSON.stringify(quote.variants),
        clientName: quote.client_name,
        clientEmail: quote.client_email ?? "",
        clientPhone: quote.client_phone ?? "",
        clientAddress: quote.client_address ?? "",
        readOnly: isEditable ? "false" : "true",
      },
    });
  }, []);

  // Delete quote
  const handleDeleteQuote = useCallback(async (quoteId: string) => {
    await deleteQuote(quoteId);
  }, [deleteQuote]);

  // Navigate to new quote
  const handleNewQuote = useCallback(() => {
    router.push("./newQuote");
  }, []);

  // Loading state
  if (isLoading && quotes.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-500 dark:text-gray-400 mt-4">
          Loading quotes...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={["bottom"]}>
        {/* Filter Tabs */}
        <View className="px-6 pt-3 pb-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.key;
              const count = counts[tab.key];

              return (
                <Pressable
                  key={tab.key}
                  className={`px-5 py-2.5 rounded-full flex-row items-center shadow-sm ${
                    isActive
                      ? "bg-blue-600"
                      : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  }`}
                  onPress={() => setActiveFilter(tab.key)}
                >
                  <Text
                    className={`font-medium ${
                      isActive
                        ? "text-white"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {tab.label}
                  </Text>
                  {count > 0 && (
                    <View
                      className={`ml-2 px-1.5 py-0.5 rounded-full min-w-[20px] items-center ${
                        isActive
                          ? "bg-blue-500"
                          : "bg-gray-100 dark:bg-gray-700"
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          isActive
                            ? "text-white"
                            : "text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {count}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Quote List or Empty State */}
        <ScrollView
          className="flex-1 px-6"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#2563eb"
            />
          }
          contentContainerStyle={
            filteredQuotes.length === 0 ? { flex: 1 } : { paddingBottom: 100 }
          }
        >
          {filteredQuotes.length === 0 ? (
            <EmptyState
              icon={activeFilter === "active" ? "📋" : "🔍"}
              title={
                activeFilter === "active"
                  ? "No Active Quotes"
                  : `No ${FILTER_TABS.find(t => t.key === activeFilter)?.label} Quotes`
              }
              message={
                activeFilter === "active"
                  ? "Create your first quote to get started with your fencing business"
                  : `You don't have any quotes in this category`
              }
              actionLabel={activeFilter === "active" ? "Create Quote" : undefined}
              onAction={activeFilter === "active" ? handleNewQuote : undefined}
            />
          ) : (
            <QuoteList
              quotes={filteredQuotes}
              currencySymbol="$"
              onQuotePress={handleQuotePress}
              onQuoteDelete={handleDeleteQuote}
            />
          )}
        </ScrollView>

        {/* FAB - New Quote */}
        <Pressable
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg active:bg-blue-700"
          onPress={handleNewQuote}
          style={{
            shadowColor: "#2563eb",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Text className="text-white text-3xl font-light leading-none">+</Text>
        </Pressable>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
