// components/QuoteForm.tsx
// Quote form component for client info and fence parameters — CLAUDE.md section 4.3

import { Pressable, Text, TextInput, View } from "react-native";

import { FENCE_SPECS, TERRAIN_MULTIPLIERS } from "@/constants/coefficients";
import type { FenceType, TerrainType } from "@/types/quote";

// ============================================================
// TYPES
// ============================================================

interface ClientInfo {
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
}

interface FenceInputs {
  fence_type: FenceType;
  length: number;
  height: number;
  gates_standard: number;
  gates_large: number;
  remove_old: boolean;
  terrain: TerrainType;
  notes?: string;
}

interface QuoteFormProps {
  clientInfo: ClientInfo;
  fenceInputs: Partial<FenceInputs>;
  errors: Record<string, string>;
  onClientInfoChange: (info: Partial<ClientInfo>) => void;
  onInputChange: <K extends keyof FenceInputs>(field: K, value: FenceInputs[K]) => void;
  disabled?: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

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

// ============================================================
// COMPONENT
// ============================================================

export default function QuoteForm({
  clientInfo,
  fenceInputs,
  errors,
  onClientInfoChange,
  onInputChange,
  disabled = false,
}: QuoteFormProps) {
  const selectedFenceType = fenceInputs.fence_type ?? "wood_privacy";
  const selectedSpec = FENCE_SPECS[selectedFenceType];
  const availableHeights = selectedSpec?.available_heights ?? [4, 5, 6];

  const handleFenceTypeChange = (type: FenceType) => {
    onInputChange("fence_type", type);
    // Reset height to default for new fence type
    const newSpec = FENCE_SPECS[type];
    onInputChange("height", newSpec.default_height);
  };

  return (
    <View>
      {/* Client Section */}
      <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
        Client Information
      </Text>

      {/* Client Name */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Client Name *
        </Text>
        <TextInput
          className={`border rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
            errors.client_name
              ? "border-red-500"
              : "border-gray-300 dark:border-gray-600"
          }`}
          style={{ height: 48 }}
          placeholder="John Smith"
          placeholderTextColor="#9ca3af"
          value={clientInfo.client_name}
          onChangeText={(text) => onClientInfoChange({ client_name: text })}
          autoCapitalize="words"
          editable={!disabled}
        />
        {errors.client_name && (
          <Text className="text-red-500 text-sm mt-1">{errors.client_name}</Text>
        )}
      </View>

      {/* Phone & Email */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone
          </Text>
          <TextInput
            className={`border rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
              errors.client_phone
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-600"
            }`}
            style={{ height: 48 }}
            placeholder="(555) 123-4567"
            placeholderTextColor="#9ca3af"
            value={clientInfo.client_phone}
            onChangeText={(text) => onClientInfoChange({ client_phone: text })}
            keyboardType="phone-pad"
            editable={!disabled}
          />
          {errors.client_phone && (
            <Text className="text-red-500 text-sm mt-1">{errors.client_phone}</Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </Text>
          <TextInput
            className={`border rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
              errors.client_email
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-600"
            }`}
            style={{ height: 48 }}
            placeholder="email@example.com"
            placeholderTextColor="#9ca3af"
            value={clientInfo.client_email}
            onChangeText={(text) => onClientInfoChange({ client_email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!disabled}
          />
          {errors.client_email && (
            <Text className="text-red-500 text-sm mt-1">{errors.client_email}</Text>
          )}
        </View>
      </View>

      {/* Address */}
      <View className="mb-6">
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Address
        </Text>
        <TextInput
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          style={{ height: 48 }}
          placeholder="123 Main St, City, State"
          placeholderTextColor="#9ca3af"
          value={clientInfo.client_address}
          onChangeText={(text) => onClientInfoChange({ client_address: text })}
          editable={!disabled}
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
                selectedFenceType === type.value
                  ? "bg-blue-600 border-blue-600"
                  : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              }`}
              onPress={() => handleFenceTypeChange(type.value)}
              disabled={disabled}
            >
              <Text
                className={
                  selectedFenceType === type.value
                    ? "text-white font-medium"
                    : "text-gray-700 dark:text-gray-300"
                }
              >
                {type.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {errors.fence_type && (
          <Text className="text-red-500 text-sm mt-1">{errors.fence_type}</Text>
        )}
      </View>

      {/* Length and Height */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Length (ft) *
          </Text>
          <TextInput
            className={`border rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
              errors.length
                ? "border-red-500"
                : "border-gray-300 dark:border-gray-600"
            }`}
            style={{ height: 48 }}
            placeholder="100"
            placeholderTextColor="#9ca3af"
            value={fenceInputs.length ? String(fenceInputs.length) : ""}
            onChangeText={(text) => {
              const num = parseFloat(text) || 0;
              onInputChange("length", num);
            }}
            keyboardType="decimal-pad"
            editable={!disabled}
          />
          {errors.length && (
            <Text className="text-red-500 text-sm mt-1">{errors.length}</Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Height (ft)
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {availableHeights.map((h) => (
              <Pressable
                key={h}
                className={`px-3 py-2 rounded-lg border ${
                  fenceInputs.height === h
                    ? "bg-blue-600 border-blue-600"
                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                }`}
                onPress={() => onInputChange("height", h)}
                disabled={disabled}
              >
                <Text
                  className={
                    fenceInputs.height === h
                      ? "text-white"
                      : "text-gray-700 dark:text-gray-300"
                  }
                >
                  {h}ft
                </Text>
              </Pressable>
            ))}
          </View>
          {errors.height && (
            <Text className="text-red-500 text-sm mt-1">{errors.height}</Text>
          )}
        </View>
      </View>

      {/* Gates */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Walk Gates
          </Text>
          <Stepper
            value={fenceInputs.gates_standard ?? 0}
            onChange={(v) => onInputChange("gates_standard", v)}
            disabled={disabled}
          />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Driveway Gates
          </Text>
          <Stepper
            value={fenceInputs.gates_large ?? 0}
            onChange={(v) => onInputChange("gates_large", v)}
            disabled={disabled}
          />
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
                fenceInputs.terrain === t.value
                  ? "bg-blue-600 border-blue-600"
                  : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              }`}
              onPress={() => onInputChange("terrain", t.value)}
              disabled={disabled}
            >
              <Text
                className={
                  fenceInputs.terrain === t.value
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

      {/* Remove Old Fence Toggle */}
      <Pressable
        className="flex-row items-center mb-4"
        onPress={() => onInputChange("remove_old", !fenceInputs.remove_old)}
        disabled={disabled}
      >
        <View
          className={`w-6 h-6 rounded border mr-3 items-center justify-center ${
            fenceInputs.remove_old
              ? "bg-blue-600 border-blue-600"
              : "border-gray-300 dark:border-gray-600"
          }`}
        >
          {fenceInputs.remove_old && <Text className="text-white text-sm">✓</Text>}
        </View>
        <Text className="text-gray-700 dark:text-gray-300">Remove old fence</Text>
      </Pressable>

      {/* Notes */}
      <View className="mb-6">
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notes
        </Text>
        <TextInput
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Additional notes..."
          placeholderTextColor="#9ca3af"
          value={fenceInputs.notes ?? ""}
          onChangeText={(text) => onInputChange("notes", text)}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{ minHeight: 80 }}
          editable={!disabled}
        />
      </View>
    </View>
  );
}

// ============================================================
// STEPPER COMPONENT
// ============================================================

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

function Stepper({ value, onChange, min = 0, max = 99, disabled = false }: StepperProps) {
  return (
    <View className="flex-row items-center border border-gray-300 dark:border-gray-600 rounded-lg" style={{ height: 48 }}>
      <Pressable
        className="px-4 items-center justify-center"
        style={{ height: 46 }}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
      >
        <Text
          className={`text-xl ${
            disabled || value <= min
              ? "text-gray-300 dark:text-gray-600"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          −
        </Text>
      </Pressable>
      <Text className="flex-1 text-center text-base text-gray-900 dark:text-white">
        {value}
      </Text>
      <Pressable
        className="px-4 items-center justify-center"
        style={{ height: 46 }}
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
      >
        <Text
          className={`text-xl ${
            disabled || value >= max
              ? "text-gray-300 dark:text-gray-600"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}
