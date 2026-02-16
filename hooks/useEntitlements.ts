// hooks/useEntitlements.ts
// RevenueCat integration for subscription management
// NOTE: In Expo Go, native modules are unavailable — hook returns mock data.
// Full functionality requires development build (eas build --profile development)

import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

// Dynamic import for RevenueCat (native module, not available in Expo Go)
type CustomerInfo = { entitlements?: { active?: Record<string, unknown> } };
type PurchasesOfferings = { current?: unknown; availablePackages?: unknown[] };
type PurchasesPackage = unknown;

let Purchases: {
  configure: (opts: { apiKey: string }) => void;
  logIn: (userId: string) => Promise<void>;
  setEmail: (email: string) => Promise<void>;
  getCustomerInfo: () => Promise<CustomerInfo>;
  getOfferings: () => Promise<PurchasesOfferings>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<{ customerInfo: CustomerInfo }>;
  restorePurchases: () => Promise<CustomerInfo>;
} | null = null;

let revenueCatAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Purchases = require("react-native-purchases").default;
  revenueCatAvailable = true;
} catch {
  console.warn("[useEntitlements] react-native-purchases not available. Using mock mode.");
}

export function isRevenueCatAvailable(): boolean {
  return revenueCatAvailable;
}

type EntitlementsState = {
  isReady: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  activeEntitlementIds: string[];
  errorMessage: string | null;
};

const ENTITLEMENT_ID = "pro"; // IMPORTANT: set same in RevenueCat dashboard

export function useEntitlements(params: {
  userId: string | null;
  email?: string | null;
  revenueCatIosApiKey: string;
  revenueCatAndroidApiKey: string;
}) {
  const { userId, email, revenueCatIosApiKey, revenueCatAndroidApiKey } = params;

  const [state, setState] = useState<EntitlementsState>({
    isReady: false,
    isPro: false,
    customerInfo: null,
    offerings: null,
    activeEntitlementIds: [],
    errorMessage: null,
  });

  const apiKey = useMemo(() => {
    return Platform.OS === "ios" ? revenueCatIosApiKey : revenueCatAndroidApiKey;
  }, [revenueCatAndroidApiKey, revenueCatIosApiKey]);

  const refresh = useCallback(async () => {
    // Mock mode when RevenueCat not available or on web
    if (!Purchases || Platform.OS === "web") {
      setState({
        isReady: true,
        isPro: false,
        customerInfo: null,
        offerings: null,
        activeEntitlementIds: [],
        errorMessage: Platform.OS === "web"
          ? "Subscriptions not available on web"
          : "RevenueCat not available (Expo Go mode)",
      });
      return;
    }

    try {
      const [info, offerings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);

      const active = info.entitlements?.active ?? {};
      const activeIds = Object.keys(active);

      setState({
        isReady: true,
        isPro: Boolean(active[ENTITLEMENT_ID]),
        customerInfo: info,
        offerings,
        activeEntitlementIds: activeIds,
        errorMessage: null,
      });
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        isReady: true,
        errorMessage: e?.message ?? "Failed to load subscription",
      }));
    }
  }, []);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    if (!Purchases || Platform.OS === "web") {
      throw new Error("Purchases not available on this platform. Use a native app.");
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);

      const active = customerInfo.entitlements?.active ?? {};
      const activeIds = Object.keys(active);

      setState((prev) => ({
        ...prev,
        customerInfo,
        offerings: prev.offerings,
        isPro: Boolean(active[ENTITLEMENT_ID]),
        activeEntitlementIds: activeIds,
        errorMessage: null,
      }));

      return customerInfo;
    } catch (e) {
      const error = e as Error;
      // User cancelled purchase - not an error
      if (error.message?.includes("cancelled") || error.message?.includes("canceled")) {
        return null;
      }
      setState((prev) => ({
        ...prev,
        errorMessage: error.message ?? "Purchase failed",
      }));
      throw error;
    }
  }, []);

  const restore = useCallback(async () => {
    if (!Purchases || Platform.OS === "web") {
      throw new Error("Purchases not available on this platform. Use a native app.");
    }

    try {
      const info = await Purchases.restorePurchases();
      const active = info.entitlements?.active ?? {};
      const activeIds = Object.keys(active);

      setState((prev) => ({
        ...prev,
        customerInfo: info,
        isPro: Boolean(active[ENTITLEMENT_ID]),
        activeEntitlementIds: activeIds,
        errorMessage: null,
      }));

      return info;
    } catch (e) {
      const error = e as Error;
      setState((prev) => ({
        ...prev,
        errorMessage: error.message ?? "Restore failed",
      }));
      throw error;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Mock mode when RevenueCat not available (Expo Go) or on web
      if (!Purchases || Platform.OS === "web") {
        setState({
          isReady: true,
          isPro: false,
          customerInfo: null,
          offerings: null,
          activeEntitlementIds: [],
          errorMessage: Platform.OS === "web"
            ? "Subscriptions not available on web"
            : "RevenueCat not available (Expo Go mode)",
        });
        return;
      }

      if (!apiKey) return;

      try {
        // Configure SDK
        Purchases.configure({ apiKey });

        // Link to your user (so RevenueCat matches across devices)
        if (userId) {
          await Purchases.logIn(userId);
        }

        // Optional: set email for support
        if (email) {
          await Purchases.setEmail(email);
        }

        // Optional: debug logs while developing
        // Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);

        if (!cancelled) {
          await refresh();
        }
      } catch (e: any) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            isReady: true,
            errorMessage: e?.message ?? "RevenueCat init failed",
          }));
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [apiKey, email, refresh, userId]);

  return {
    ...state,
    refresh,
    restore,
    purchasePackage,
  };
}
