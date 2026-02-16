// app/(auth)/register.tsx
// Register screen — CLAUDE.md section 4.1

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
import { registerSchema, validate } from "@/lib/validation";

export default function RegisterScreen() {
  const { signUpWithEmail, signInWithGoogle, signInWithApple, isLoading } =
    useAuthContext();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    setErrors({});

    // Validate form
    const result = validate(registerSchema, { email, password, confirmPassword });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await signUpWithEmail(email, password);

      if (error) {
        Alert.alert("Registration Failed", getAuthErrorMessage(error));
      } else {
        Alert.alert(
          "Check Your Email",
          "We've sent you a verification link. Please check your email to complete registration.",
          [{ text: "OK", onPress: () => router.replace("./login") }]
        );
      }
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleRegister = async () => {
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        Alert.alert("Google Sign Up Failed", getAuthErrorMessage(error));
      }
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred");
    }
  };

  const handleAppleRegister = async () => {
    try {
      const { error } = await signInWithApple();
      if (error) {
        Alert.alert("Apple Sign Up Failed", getAuthErrorMessage(error));
      }
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred");
    }
  };

  const isButtonDisabled = isLoading || isSubmitting;

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
          {/* Header */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900 dark:text-white text-center">
              Create Account
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-center mt-2">
              Start quoting fences in minutes
            </Text>
          </View>

          {/* Email Input */}
          <View className="mb-4">
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

          {/* Password Input */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </Text>
            <TextInput
              className={`border rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                errors.password
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              placeholder="At least 8 characters"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              editable={!isButtonDisabled}
            />
            {errors.password && (
              <Text className="text-red-500 text-sm mt-1">
                {errors.password}
              </Text>
            )}
          </View>

          {/* Confirm Password Input */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm Password
            </Text>
            <TextInput
              className={`border rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                errors.confirmPassword
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              placeholder="Confirm your password"
              placeholderTextColor="#9ca3af"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              editable={!isButtonDisabled}
            />
            {errors.confirmPassword && (
              <Text className="text-red-500 text-sm mt-1">
                {errors.confirmPassword}
              </Text>
            )}
          </View>

          {/* Register Button */}
          <Pressable
            className={`rounded-lg py-3 px-4 mb-4 ${
              isButtonDisabled ? "bg-blue-400" : "bg-blue-600 active:bg-blue-700"
            }`}
            onPress={handleRegister}
            disabled={isButtonDisabled}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                Create Account
              </Text>
            )}
          </Pressable>

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
            <Text className="mx-4 text-gray-500 dark:text-gray-400 text-sm">
              or continue with
            </Text>
            <View className="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
          </View>

          {/* Social Sign Up Buttons */}
          <View className="flex-row gap-3 mb-6">
            <Pressable
              className="flex-1 flex-row items-center justify-center border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4 bg-white dark:bg-gray-800 active:bg-gray-50 dark:active:bg-gray-700"
              onPress={handleGoogleRegister}
              disabled={isButtonDisabled}
            >
              <Text className="text-gray-700 dark:text-gray-300 font-medium">
                Google
              </Text>
            </Pressable>

            {Platform.OS === "ios" && (
              <Pressable
                className="flex-1 flex-row items-center justify-center border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4 bg-white dark:bg-gray-800 active:bg-gray-50 dark:active:bg-gray-700"
                onPress={handleAppleRegister}
                disabled={isButtonDisabled}
              >
                <Text className="text-gray-700 dark:text-gray-300 font-medium">
                  Apple
                </Text>
              </Pressable>
            )}
          </View>

          {/* Login Link */}
          <View className="flex-row justify-center">
            <Text className="text-gray-600 dark:text-gray-400">
              Already have an account?{" "}
            </Text>
            <Link href="./login" asChild>
              <Pressable>
                <Text className="text-blue-600 dark:text-blue-400 font-semibold">
                  Sign In
                </Text>
              </Pressable>
            </Link>
          </View>

          {/* Terms */}
          <Text className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
            By creating an account, you agree to our Terms of Service and
            Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
