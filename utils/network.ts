import * as Network from "expo-network";
import { Platform } from "react-native";

const NETWORK_PROFILE_TTL_MS = 15_000;

export type NetworkProfile = {
  isConnected: boolean;
  isCellular: boolean;
  requestConcurrency: number;
  imagePrefetchBatchSize: number;
};

let cachedProfile:
  | {
      value: NetworkProfile;
      expiresAt: number;
    }
  | null = null;

const conservativeProfile = (): NetworkProfile => ({
  isConnected: true,
  isCellular: Platform.OS !== "web",
  requestConcurrency: Platform.OS === "web" ? 4 : 2,
  imagePrefetchBatchSize: Platform.OS === "web" ? 6 : 2,
});

export async function getNetworkProfile(
  options: { force?: boolean } = {}
): Promise<NetworkProfile> {
  if (
    !options.force &&
    cachedProfile &&
    cachedProfile.expiresAt > Date.now()
  ) {
    return cachedProfile.value;
  }

  try {
    const state = await Network.getNetworkStateAsync();
    const isCellular = state.type === Network.NetworkStateType.CELLULAR;
    const value: NetworkProfile = {
      isConnected:
        state.isConnected !== false && state.isInternetReachable !== false,
      isCellular,
      requestConcurrency: isCellular ? 2 : 4,
      imagePrefetchBatchSize: isCellular ? 2 : 6,
    };

    cachedProfile = {
      value,
      expiresAt: Date.now() + NETWORK_PROFILE_TTL_MS,
    };

    return value;
  } catch {
    const value = conservativeProfile();
    cachedProfile = {
      value,
      expiresAt: Date.now() + NETWORK_PROFILE_TTL_MS,
    };
    return value;
  }
}

export async function mapWithConcurrency<T, TResult>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<TResult>
): Promise<TResult[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<TResult>(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    })
  );

  return results;
}
