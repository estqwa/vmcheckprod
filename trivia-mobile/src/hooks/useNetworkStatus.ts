import { useMemo } from 'react';
import { useNetInfo } from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const netInfo = useNetInfo();

  const isOffline = useMemo(() => {
    if (netInfo.isConnected === false) return true;
    if (netInfo.isInternetReachable === false) return true;
    return false;
  }, [netInfo.isConnected, netInfo.isInternetReachable]);

  const isOnline = !isOffline;

  return {
    ...netInfo,
    isOffline,
    isOnline,
  };
}

