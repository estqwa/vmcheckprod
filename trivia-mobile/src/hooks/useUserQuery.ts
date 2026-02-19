import { useQuery } from '@tanstack/react-query';
import { getCurrentUser, getLeaderboard } from '../api/user';

export const userQueryKey = ['user', 'me'] as const;
export const leaderboardQueryKey = ['leaderboard'] as const;

export function useUserQuery(enabled = true) {
  return useQuery({
    queryKey: userQueryKey,
    queryFn: getCurrentUser,
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useLeaderboardQuery(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: [...leaderboardQueryKey, page, pageSize],
    queryFn: () => getLeaderboard(page, pageSize),
  });
}
