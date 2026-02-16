// app/(app)/newQuote.tsx
// New quote form screen — CLAUDE.md section 4.3

import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FENCE_SPECS, TERRAIN_MULTIPLIERS } from "@/constants/coefficients";
import type { FenceType, TerrainType } from "@/types/quote";

const FENCE_TYPES: { value: FenceType; label: string }[] = [
  { value: "wood_privacy", label: "Wood Privacy" },
  { value: "wood_picket", label: "Wood Picket" },
  { value: "chain_link", label: "Chain Link" },
  { value: "vinyl", label: "Vinyl" },
  { value: "aluminum", label: "Aluminum" },
];

const TERRAIN_TYPES: { value: TerrainType; label: string }[] = [
  { value: "flat", label: "Flat" },
  { value: "slight_slope", label: "Slight Slope" },
  { value: "steep_slope", label: "Steep Slope" },
  { value: "rocky", label: "Rocky" },
];

export default function NewQuoteScreen() {
  // Client info
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");

  // Fence params
  const [fenceType, setFenceType] = useState<FenceType>("wood_privacy");
  const [length, setLength] = useState("");
  const [height, setHeight] = useState(
    String(FENCE_SPECS.wood_privacy.default_height)
  );
  const [gatesStandard, setGatesStandard] = useState(0);
  const [gatesLarge, setGatesLarge] = useState(0);
  const [removeOld, setRemoveOld] = useState(false);
  const [terrain, setTerrain] = useState<TerrainType>("flat");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedSpec = FENCE_SPECS[fenceType];

  const handleFenceTypeChange = (type: FenceType) => {
    setFenceType(type);
    setHeight(String(FENCE_SPECS[type].default_height));
  };

  const handleCalculate = () => {
    setErrors({});
    const newErrors: Record<string, string> = {};

    if (!clientName.trim()) {
      newErrors.clientName = "Client name is required";
    }
    if (!length || parseFloat(length) <= 0) {
      newErrors.length = "Valid length is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // TODO: Navigate to results with calculated data
    router.push("./results");
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="p-4"
          keyboardShouldPersistTaps="handled"
        >
          {/* Client Section */}
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Client Information
          </Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Client Name *
            </Text>
            <TextInput
              className={`border rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                errors.clientName
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              placeholder="John Smith"
              placeholderTextColor="#9ca3af"
              value={clientName}
              onChangeText={setClientName}
              autoCapitalize="words"
            />
            {errors.clientName && (
              <Text className="text-red-500 text-sm mt-1">
                {errors.clientName}
              </Text>
            )}
          </View>

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone
              </Text>
              <TextInput
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="(555) 123-4567"
                placeholderTextColor="#9ca3af"
                value={clientPhone}
                onChangeText={setClientPhone}
                keyboardType="phone-pad"
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </Text>
              <TextInput
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="email@example.com"
                placeholderTextColor="#9ca3af"
                value={clientEmail}
                onChangeText={setClientEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="123 Main St, City, State"
              placeholderTextColor="#9ca3af"
              value={clientAddress}
              onChangeText={setClientAddress}
            />
          </View>

          {/* Fence Section */}
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Fence Details
          </Text>

          {/* Fence Type */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fence Type
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {FENCE_TYPES.map((type) => (
                <Pressable
                  key={type.value}
                  className={`px-4 py-2 rounded-lg border ${
                    fenceType === type.value
                      ? "bg-blue-600 border-blue-600"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  }`}
                  onPress={() => handleFenceTypeChange(type.value)}
                >
                  <Text
                    className={
                      fenceType === type.value
                        ? "text-white font-medium"
                        : "text-gray-700 dark:text-gray-300"
                    }
                  >
                    {type.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Length and Height */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Length (ft) *
              </Text>
              <TextInput
                className={`border rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  errors.length
                    ? "border-red-500"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                placeholder="100"
                placeholderTextColor="#9ca3af"
                value={length}
                onChangeText={setLength}
                keyboardType="decimal-pad"
              />
              {errors.length && (
                <Text className="text-red-500 text-sm mt-1">
                  {errors.length}
                </Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Height (ft)
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {selectedSpec.available_heights.map((h) => (
                  <Pressable
                    key={h}
                    className={`px-3 py-2 rounded-lg border ${
                      parseFloat(height) === h
                        ? "bg-blue-600 border-blue-600"
                        : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                    }`}
                    onPress={() => setHeight(String(h))}
                  >
                    <Text
                      className={
                        parseFloat(height) === h
                          ? "text-white"
                          : "text-gray-700 dark:text-gray-300"
                      }
                    >
                      {h}ft
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Gates */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Walk Gates
              </Text>
              <View className="flex-row items-center border border-gray-300 dark:border-gray-600 rounded-lg">
                <Pressable
                  className="px-4 py-3"
                  onPress={() => setGatesStandard(Math.max(0, gatesStandard - 1))}
                >
                  <Text className="text-xl text-gray-600 dark:text-gray-400">−</Text>
                </Pressable>
                <Text className="flex-1 text-center text-base text-gray-900 dark:text-white">
                  {gatesStandard}
                </Text>
                <Pressable
                  className="px-4 py-3"
                  onPress={() => setGatesStandard(gatesStandard + 1)}
                >
                  <Text className="text-xl text-gray-600 dark:text-gray-400">+</Text>
                </Pressable>
              </View>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Driveway Gates
              </Text>
              <View className="flex-row items-center border border-gray-300 dark:border-gray-600 rounded-lg">
                <Pressable
                  className="px-4 py-3"
                  onPress={() => setGatesLarge(Math.max(0, gatesLarge - 1))}
                >
                  <Text className="text-xl text-gray-600 dark:text-gray-400">−</Text>
                </Pressable>
                <Text className="flex-1 text-center text-base text-gray-900 dark:text-white">
                  {gatesLarge}
                </Text>
                <Pressable
                  className="px-4 py-3"
                  onPress={() => setGatesLarge(gatesLarge + 1)}
                >
                  <Text className="text-xl text-gray-600 dark:text-gray-400">+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Terrain */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Terrain
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {TERRAIN_TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  className={`px-4 py-2 rounded-lg border ${
                    terrain === t.value
                      ? "bg-blue-600 border-blue-600"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  }`}
                  onPress={() => setTerrain(t.value)}
                >
                  <Text
                    className={
                      terrain === t.value
                        ? "text-white font-medium"
                        : "text-gray-700 dark:text-gray-300"
                    }
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Remove Old */}
          <Pressable
            className="flex-row items-center mb-4"
            onPress={() => setRemoveOld(!removeOld)}
          >
            <View
              className={`w-6 h-6 rounded border mr-3 items-center justify-center ${
                removeOld
                  ? "bg-blue-600 border-blue-600"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              {removeOld && <Text className="text-white text-sm">✓</Text>}
            </View>
            <Text className="text-gray-700 dark:text-gray-300">
              Remove old fence
            </Text>
          </Pressable>

          {/* Notes */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Additional notes..."
              placeholderTextColor="#9ca3af"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 80 }}
            />
          </View>

          {/* Calculate Button */}
          <Pressable
            className="bg-blue-600 rounded-lg py-4 px-4 active:bg-blue-700"
            onPress={handleCalculate}
          >
            <Text className="text-white text-center font-semibold text-lg">
              Calculate →
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
