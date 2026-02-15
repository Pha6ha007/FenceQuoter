// hooks/useNetworkStatus.ts
// Network connectivity monitoring hook — CLAUDE.md section 2

import NetInfo, {
  NetInfoState,
  NetInfoStateType,
} from "@react-native-community/netinfo";
import { useCallback, useEffect, useRef, useState } from "react";

type NetworkStatus = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: NetInfoStateType;
  isWifi: boolean;
  isCellular: boolean;
  details: NetInfoState["details"];
};

type NetworkStatusState = {
  isLoading: boolean;
  status: NetworkStatus;
  wasOffline: boolean; // true if was offline at some point (for sync indicator)
};

type NetworkStatusActions = {
  refresh: () => Promise<void>;
  checkConnection: () => Promise<boolean>;
};

export type UseNetworkStatusReturn = NetworkStatusState & NetworkStatusActions;

const DEFAULT_STATUS: NetworkStatus = {
  isConnected: true,
  isInternetReachable: null,
  type: NetInfoStateType.unknown,
  isWifi: false,
  isCellular: false,
  details: null,
};

export function useNetworkStatus(): UseNetworkStatusReturn {
  const [state, setState] = useState<NetworkStatusState>({
    isLoading: true,
    status: DEFAULT_STATUS,
    wasOffline: false,
  });

  const wasOfflineRef = useRef(false);

  // ============================================================
  // PARSE NETINFO STATE
  // ============================================================

  const parseNetInfoState = useCallback((netInfoState: NetInfoState): NetworkStatus => {
    const isConnected = netInfoState.isConnected ?? false;
    const isInternetReachable = netInfoState.isInternetReachable;

    return {
      isConnected,
      isInternetReachable,
      type: netInfoState.type,
      isWifi: netInfoState.type === NetInfoStateType.wifi,
      isCellular: netInfoState.type === NetInfoStateType.cellular,
      details: netInfoState.details,
    };
  }, []);

  // ============================================================
  // REFRESH STATUS
  // ============================================================

  const refresh = useCallback(async () => {
    try {
      const netInfoState = await NetInfo.fetch();
      const status = parseNetInfoState(netInfoState);

      // Track if we were ever offline
      if (!status.isConnected) {
        wasOfflineRef.current = true;
      }

      setState((prev) => ({
        isLoading: false,
        status,
        wasOffline: wasOfflineRef.current,
      }));
    } catch (e) {
      console.error("Failed to fetch network status:", e);
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [parseNetInfoState]);

  // ============================================================
  // CHECK CONNECTION (returns boolean)
  // ============================================================

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const netInfoState = await NetInfo.fetch();
      return netInfoState.isConnected ?? false;
    } catch {
      return false;
    }
  }, []);

  // ============================================================
  // SUBSCRIBE TO NETWORK CHANGES
  // ============================================================

  useEffect(() => {
    // Initial fetch
    refresh();

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener((netInfoState) => {
      const status = parseNetInfoState(netInfoState);

      // Track if we were ever offline
      if (!status.isConnected) {
        wasOfflineRef.current = true;
      }

      setState((prev) => ({
        isLoading: false,
        status,
        wasOffline: wasOfflineRef.current,
      }));
    });

    return () => {
      unsubscribe();
    };
  }, [refresh, parseNetInfoState]);

  return {
    ...state,
    refresh,
    checkConnection,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get human-readable network type label
 */
export function getNetworkTypeLabel(type: NetInfoStateType): string {
  const labels: Record<NetInfoStateType, string> = {
    [NetInfoStateType.none]: "No Connection",
    [NetInfoStateType.unknown]: "Unknown",
    [NetInfoStateType.cellular]: "Cellular",
    [NetInfoStateType.wifi]: "Wi-Fi",
    [NetInfoStateType.bluetooth]: "Bluetooth",
    [NetInfoStateType.ethernet]: "Ethernet",
    [NetInfoStateType.wimax]: "WiMAX",
    [NetInfoStateType.vpn]: "VPN",
    [NetInfoStateType.other]: "Other",
  };

  return labels[type] ?? "Unknown";
}

/**
 * Get network status message for display
 */
export function getNetworkStatusMessage(status: NetworkStatus): string {
  if (!status.isConnected) {
    return "You're offline";
  }

  if (status.isInternetReachable === false) {
    return "No internet access";
  }

  if (status.isWifi) {
    return "Connected via Wi-Fi";
  }

  if (status.isCellular) {
    return "Connected via cellular";
  }

  return "Connected";
}

/**
 * Get network status color for indicator
 */
export function getNetworkStatusColor(status: NetworkStatus): string {
  if (!status.isConnected) {
    return "#ef4444"; // red
  }

  if (status.isInternetReachable === false) {
    return "#f59e0b"; // amber
  }

  return "#22c55e"; // green
}

/**
 * Check if network is good enough for heavy operations (uploads, etc.)
 */
export function isNetworkGoodForUploads(status: NetworkStatus): boolean {
  if (!status.isConnected) return false;
  if (status.isInternetReachable === false) return false;

  // Prefer Wi-Fi for uploads, but cellular is okay too
  return true;
}

/**
 * Check if we should show offline banner
 */
export function shouldShowOfflineBanner(status: NetworkStatus): boolean {
  return !status.isConnected || status.isInternetReachable === false;
}

// ============================================================
// SIMPLE HOOK FOR JUST ONLINE/OFFLINE
// ============================================================

/**
 * Simple hook that just returns isOnline boolean
 */
export function useIsOnline(): boolean {
  const { status } = useNetworkStatus();
  return status.isConnected && status.isInternetReachable !== false;
}

// ============================================================
// HOOK FOR EXECUTING CALLBACK WHEN BACK ONLINE
// ============================================================

/**
 * Hook that executes a callback when network comes back online
 */
export function useOnBackOnline(callback: () => void): void {
  const { status } = useNetworkStatus();
  const wasOfflineRef = useRef(false);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const isOnline = status.isConnected && status.isInternetReachable !== false;

    if (!isOnline) {
      wasOfflineRef.current = true;
    } else if (wasOfflineRef.current && isOnline) {
      // Was offline, now online - execute callback
      wasOfflineRef.current = false;
      callbackRef.current();
    }
  }, [status.isConnected, status.isInternetReachable]);
}
