import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';
import * as ExpoRouter from 'expo-router';
import LobbyScreen from '../../app/quiz/[id]/lobby';
import { getQuiz } from '../api/quizzes';
import { useAuth } from '../providers/AuthProvider';
import { useQuizWS } from '../hooks/useQuizWS';

jest.mock('../api/quizzes', () => ({
  getQuiz: jest.fn(),
}));

jest.mock('../providers/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../hooks/useQuizWS', () => ({
  useQuizWS: jest.fn(),
}));

describe('LobbyScreen countdown', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (ExpoRouter.useRouter as jest.Mock).mockReturnValue(router);
    (ExpoRouter.useLocalSearchParams as jest.Mock).mockReturnValue({ id: '1' });
    (useAuth as jest.Mock).mockReturnValue({
      logout: jest.fn().mockResolvedValue(undefined),
    });
    (useQuizWS as jest.Mock).mockReturnValue({
      connectionState: 'connected',
      isConnected: true,
      isOffline: false,
    });
  });

  it('renders days timer block for countdown values over 24 hours', async () => {
    jest.useFakeTimers();
    try {
      const inTwoDays = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      (getQuiz as jest.Mock).mockResolvedValue({
        id: 1,
        title: 'Quiz #1',
        description: 'Desc',
        scheduled_time: inTwoDays,
        question_count: 10,
        prize_fund: 1000,
        status: 'scheduled',
      });

      const queryClient = new QueryClient();
      let tree: ReturnType<typeof renderer.create> | undefined;
      await act(async () => {
        tree = renderer.create(
          <QueryClientProvider client={queryClient}>
            <LobbyScreen />
          </QueryClientProvider>
        );
      });
      const mountedTree = tree!;
      const root = mountedTree.root;

      await waitFor(() => {
        const dayLabels = root.findAll(
          (node: any) => node.type === 'Text' && node.children?.includes('quiz.days')
        );
        expect(dayLabels.length).toBeGreaterThan(0);
      }, { timeout: 1500 });

      await act(async () => {
        mountedTree.unmount();
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
