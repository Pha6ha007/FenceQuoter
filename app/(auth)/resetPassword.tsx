// app/(auth)/resetPassword.tsx
// Reset password screen — CLAUDE.md section 4.1

import { Link, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthContext } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/hooks/useAuth";
import { resetPasswordSchema, validate } from "@/lib/validation";

export default function ResetPasswordScreen() {
  const { resetPassword, isLoading } = useAuthContext();

  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleResetPassword = async () => {
    setErrors({});

    // Validate form
    const result = validate(resetPasswordSchema, { email });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await resetPassword(email);

      if (error) {
        Alert.alert("Reset Failed", getAuthErrorMessage(error));
      } else {
        setIsSuccess(true);
      }
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isButtonDisabled = isLoading || isSubmitting;

  // Success state
  if (isSuccess) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
        <ScrollView
          className="flex-grow justify-center px-6 py-8"
        >
          <View className="items-center">
            {/* Success Icon */}
            <View className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full items-center justify-center mb-6">
              <Text className="text-3xl">✓</Text>
            </View>

            <Text className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">
              Check Your Email
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-center mb-8">
              We've sent a password reset link to{"\n"}
              <Text className="font-medium text-gray-700 dark:text-gray-300">
                {email}
              </Text>
            </Text>

            <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
              Didn't receive the email? Check your spam folder or try again.
            </Text>

            <Pressable
              className="bg-blue-600 rounded-lg py-3 px-6 mb-4 active:bg-blue-700"
              onPress={() => {
                setIsSuccess(false);
                setEmail("");
              }}
            >
              <Text className="text-white text-center font-semibold">
                Try Another Email
              </Text>
            </Pressable>

            <Link href="./login" asChild>
              <Pressable>
                <Text className="text-blue-600 dark:text-blue-400 font-semibold">
                  Back to Sign In
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <Pressable
            className="absolute top-4 left-0 p-2"
            onPress={() => router.back()}
          >
            <Text className="text-blue-600 dark:text-blue-400 text-base">
              ← Back
            </Text>
          </Pressable>

          {/* Header */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white text-center">
              Reset Password
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-center mt-2">
              Enter your email and we'll send you a link to reset your password
            </Text>
          </View>

          {/* Email Input */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </Text>
            <TextInput
              className={`border rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                errors.email
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              placeholder="you@example.com"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!isButtonDisabled}
            />
            {errors.email && (
              <Text className="text-red-500 text-sm mt-1">{errors.email}</Text>
            )}
          </View>

          {/* Reset Button */}
          <Pressable
            className={`rounded-lg py-3 px-4 mb-6 ${
              isButtonDisabled ? "bg-blue-400" : "bg-blue-600 active:bg-blue-700"
            }`}
            onPress={handleResetPassword}
            disabled={isButtonDisabled}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                Send Reset Link
              </Text>
            )}
          </Pressable>

          {/* Login Link */}
          <View className="flex-row justify-center">
            <Text className="text-gray-600 dark:text-gray-400">
              Remember your password?{" "}
            </Text>
            <Link href="./login" asChild>
              <Pressable>
                <Text className="text-blue-600 dark:text-blue-400 font-semibold">
                  Sign In
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
