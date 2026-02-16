// app/(auth)/login.tsx
// Login screen — CLAUDE.md section 4.1

import { Link } from "expo-router";
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
import { loginSchema, validate } from "@/lib/validation";

export default function LoginScreen() {
  const { signInWithEmail, signInWithGoogle, signInWithApple, isLoading } =
    useAuthContext();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setErrors({});

    // Validate form
    const result = validate(loginSchema, { email, password });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await signInWithEmail(email, password);

      if (error) {
        Alert.alert("Login Failed", getAuthErrorMessage(error));
      }
      // Success: auth state change will trigger redirect via layout
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        Alert.alert("Google Login Failed", getAuthErrorMessage(error));
      }
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred");
    }
  };

  const handleAppleLogin = async () => {
    try {
      const { error } = await signInWithApple();
      if (error) {
        Alert.alert("Apple Login Failed", getAuthErrorMessage(error));
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
          className="flex-grow"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        >
          <View
            className="px-6 py-8"
            style={{ maxWidth: Platform.OS === "web" ? 480 : undefined, width: "100%", alignSelf: "center" }}
          >
          {/* Header */}
          <View className="mb-6">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white text-center">
              FenceQuoter
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 text-center mt-2 text-base">
              Sign in to your account
            </Text>
          </View>

          {/* Email Input */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </Text>
            <TextInput
              className={`border rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                errors.email
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              style={{ height: 48 }}
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
              className={`border rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                errors.password
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              style={{ height: 48 }}
              placeholder="Your password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              editable={!isButtonDisabled}
            />
            {errors.password && (
              <Text className="text-red-500 text-sm mt-1">
                {errors.password}
              </Text>
            )}
          </View>

          {/* Forgot Password Link */}
          <View className="mb-6">
            <Link href="./resetPassword" asChild>
              <Pressable>
                <Text className="text-blue-600 dark:text-blue-400 text-sm text-right">
                  Forgot password?
                </Text>
              </Pressable>
            </Link>
          </View>

          {/* Login Button - Primary */}
          <Pressable
            className={`rounded-lg mb-4 items-center justify-center ${
              isButtonDisabled ? "bg-blue-400" : "bg-blue-600 active:bg-blue-700"
            }`}
            style={{ height: 48 }}
            onPress={handleLogin}
            disabled={isButtonDisabled}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                Sign In
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

          {/* Social Login Buttons - Secondary */}
          <View className="flex-row gap-3 mb-6">
            <Pressable
              className="flex-1 flex-row items-center justify-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 active:bg-gray-50 dark:active:bg-gray-700"
              style={{ height: 48 }}
              onPress={handleGoogleLogin}
              disabled={isButtonDisabled}
            >
              <Text className="text-gray-700 dark:text-gray-300 font-medium">
                Google
              </Text>
            </Pressable>

            {Platform.OS === "ios" && (
              <Pressable
                className="flex-1 flex-row items-center justify-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 active:bg-gray-50 dark:active:bg-gray-700"
                style={{ height: 48 }}
                onPress={handleAppleLogin}
                disabled={isButtonDisabled}
              >
                <Text className="text-gray-700 dark:text-gray-300 font-medium">
                  Apple
                </Text>
              </Pressable>
            )}
          </View>

          {/* Register Link */}
          <View className="flex-row justify-center">
            <Text className="text-gray-500 dark:text-gray-400 text-base">
              Don't have an account?{" "}
            </Text>
            <Link href="./register" asChild>
              <Pressable>
                <Text className="text-blue-600 dark:text-blue-400 font-semibold text-base">
                  Sign Up
                </Text>
              </Pressable>
            </Link>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
