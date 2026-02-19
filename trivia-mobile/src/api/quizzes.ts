// =============================================================================
// @trivia/mobile - Quiz API
// =============================================================================

import { api } from './client';
import type { Quiz, QuizResult, PaginatedResults } from '@trivia/shared';

type QuizListResponse = Quiz[] | { quizzes: Quiz[] };

export async function getUpcomingQuizzes(): Promise<Quiz[]> {
  const response = await api.get<QuizListResponse>('/api/quizzes/scheduled');
  return Array.isArray(response) ? response : response.quizzes ?? [];
}

export async function getQuiz(quizId: number): Promise<Quiz> {
  return api.get<Quiz>(`/api/quizzes/${quizId}`);
}

export async function getMyQuizResult(quizId: number): Promise<QuizResult | null> {
  try {
    return await api.get<QuizResult>(`/api/quizzes/${quizId}/my-result`);
  } catch {
    return null;
  }
}

export async function getQuizResults(
  quizId: number,
  page = 1,
  pageSize = 10
): Promise<PaginatedResults<QuizResult>> {
  return api.get<PaginatedResults<QuizResult>>(`/api/quizzes/${quizId}/results`, {
    query: {
      page: String(page),
      page_size: String(pageSize),
    },
  });
}

export async function getQuizHistory(
  page = 1,
  pageSize = 20
): Promise<PaginatedResults<QuizResult>> {
  return api.get<PaginatedResults<QuizResult>>(
    '/api/users/me/results',
    {
      query: {
        page: String(page),
        page_size: String(pageSize),
      },
    }
  );
}
