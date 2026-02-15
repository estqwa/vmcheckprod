// =============================================================================
// @trivia/mobile - User API
// =============================================================================

import { api } from './client';
import type { User, LeaderboardResponse } from '@trivia/shared';

export async function getCurrentUser(): Promise<User> {
  return api.get<User>('/api/users/me');
}

export async function getLeaderboard(page = 1, pageSize = 20): Promise<LeaderboardResponse> {
  return api.get<LeaderboardResponse>('/api/leaderboard', {
    query: {
      page: String(page),
      page_size: String(pageSize),
    },
  });
}
