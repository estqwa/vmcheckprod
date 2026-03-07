import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

export const REVIEW_PROMPT_STORAGE_KEY = 'app_review_last_prompt_at';
const DEFAULT_COOLDOWN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type ReviewPromptOptions = {
  cooldownDays?: number;
};

/**
 * Requests an in-app review only when the session is eligible and cooldown passed.
 */
export async function maybeRequestReview(
  eligible: boolean,
  options: ReviewPromptOptions = {}
): Promise<boolean> {
  if (!eligible) return false;

  const isAvailable = await StoreReview.isAvailableAsync();
  if (!isAvailable) return false;

  const cooldownDays = options.cooldownDays ?? DEFAULT_COOLDOWN_DAYS;
  const now = Date.now();

  try {
    const lastPromptRaw = await AsyncStorage.getItem(REVIEW_PROMPT_STORAGE_KEY);
    if (lastPromptRaw) {
      const lastPromptTs = Number(lastPromptRaw);
      if (Number.isFinite(lastPromptTs) && now - lastPromptTs < cooldownDays * DAY_MS) {
        return false;
      }
    }

    await StoreReview.requestReview();
    await AsyncStorage.setItem(REVIEW_PROMPT_STORAGE_KEY, String(now));
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn('[reviewPrompt] Failed to request in-app review', error);
    }
    return false;
  }
}
