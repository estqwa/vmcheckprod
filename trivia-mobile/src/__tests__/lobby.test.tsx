import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';
import * as ExpoRouter from 'expo-router';
import LobbyScreen from '../../app/quiz/[id]/lobby';
import { getQuiz } from '../api/quizzes';
import { useQuizSession } from '../providers/QuizSessionProvider';

jest.mock('../api/quizzes', () => ({
  getQuiz: jest.fn(),
}));

jest.mock('../providers/QuizSessionProvider', () => ({
  useQuizSession: jest.fn(),
}));

type MockSessionState = {
  connectionState: 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'offline';
  isConnected: boolean;
  isOffline: boolean;
  playerCount: number;
  question: {
    id: number;
    text: string;
    textKK?: string;
    options: Array<{ id: number; text: string }>;
    optionsKK?: Array<{ id: number; text: string }>;
    current: number;
    total: number;
    timeLimit: number;
  } | null;
};

function buildSessionState(overrides: Partial<MockSessionState> = {}): MockSessionState {
  return {
    connectionState: 'connected',
    isConnected: true,
    isOffline: false,
    playerCount: 0,
    question: null,
    ...overrides,
  };
}

describe('LobbyScreen countdown', () => {
  let sessionState: MockSessionState;
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sessionState = buildSessionState();
    (ExpoRouter.useRouter as jest.Mock).mockReturnValue(router);
    (ExpoRouter.useLocalSearchParams as jest.Mock).mockReturnValue({ id: '1' });
    (useQuizSession as jest.Mock).mockImplementation(() => sessionState);
  });

  function renderLobby() {
    const queryClient = new QueryClient();
    return renderer.create(
      <QueryClientProvider client={queryClient}>
        <LobbyScreen />
      </QueryClientProvider>
    );
  }

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

      let tree: ReturnType<typeof renderer.create> | undefined;
      await act(async () => {
        tree = renderLobby();
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

  it('routes to play when the shared quiz session already has the first question', async () => {
    (getQuiz as jest.Mock).mockResolvedValue({
      id: 1,
      title: 'Quiz #1',
      description: 'Desc',
      scheduled_time: new Date(Date.now() + 60_000).toISOString(),
      question_count: 10,
      prize_fund: 1000,
      status: 'scheduled',
    });

    let tree: ReturnType<typeof renderer.create> | undefined;
    await act(async () => {
      tree = renderLobby();
    });

    expect(router.replace).not.toHaveBeenCalledWith('/quiz/1/play');

    await act(async () => {
      sessionState = buildSessionState({
        question: {
          id: 101,
          text: 'Question 1',
          options: [
            { id: 1, text: 'Option A' },
            { id: 2, text: 'Option B' },
          ],
          current: 1,
          total: 5,
          timeLimit: 20,
        },
      });
      tree?.update(
        <QueryClientProvider client={new QueryClient()}>
          <LobbyScreen />
        </QueryClientProvider>
      );
    });

    expect(router.replace).toHaveBeenCalledWith('/quiz/1/play');

    await act(async () => {
      tree?.unmount();
    });
  });

  it('does not route to play while the session is in progress without a current question', async () => {
    (getQuiz as jest.Mock).mockResolvedValue({
      id: 1,
      title: 'Quiz #1',
      description: 'Desc',
      scheduled_time: new Date(Date.now() + 60_000).toISOString(),
      question_count: 10,
      prize_fund: 1000,
      status: 'scheduled',
    });

    let tree: ReturnType<typeof renderer.create> | undefined;
    await act(async () => {
      tree = renderLobby();
    });

    expect(router.replace).not.toHaveBeenCalledWith('/quiz/1/play');

    await act(async () => {
      tree?.unmount();
    });
  });
});
