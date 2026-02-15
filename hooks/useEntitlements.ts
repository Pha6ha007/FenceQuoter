// hooks/useEntitlements.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import Purchases, {
    CustomerInfo,
    PurchasesOfferings,
    PurchasesPackage,
} from "react-native-purchases";

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
    const { customerInfo } = await Purchases.purchasePackage(pkg);

    const active = customerInfo.entitlements?.active ?? {};
    const activeIds = Object.keys(active);

    setState((prev) => ({
      ...prev,
      customerInfo,
      offerings: prev.offerings,
      isPro: Boolean(active[ENTITLEMENT_ID]),
      activeEntitlementIds: activeIds,
    }));

    return customerInfo;
  }, []);

  const restore = useCallback(async () => {
    const info = await Purchases.restorePurchases();
    const active = info.entitlements?.active ?? {};
    const activeIds = Object.keys(active);

    setState((prev) => ({
      ...prev,
      customerInfo: info,
      isPro: Boolean(active[ENTITLEMENT_ID]),
      activeEntitlementIds: activeIds,
    }));

    return info;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
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
