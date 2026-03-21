import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as ExpoRouter from 'expo-router';
import { Text } from 'react-native';
import { WS_SERVER_EVENTS } from '@trivia/shared';
import { QuizSessionProvider, useQuizSession } from '../providers/QuizSessionProvider';
import { useQuizWS } from '../hooks/useQuizWS';
import { useAuth } from '../providers/AuthProvider';

jest.mock('../hooks/useQuizWS', () => ({
  useQuizWS: jest.fn(),
}));

jest.mock('../providers/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

function SessionProbe() {
  const session = useQuizSession();

  return (
    <>
      <Text>{`status:${session.status ?? 'none'}`}</Text>
      <Text>{`players:${session.playerCount}`}</Text>
      <Text>{`question:${session.question?.text ?? 'none'}`}</Text>
      <Text>{`time:${session.timeLeft}`}</Text>
      <Text>{`eliminated:${session.isEliminated}`}</Text>
    </>
  );
}

describe('QuizSessionProvider', () => {
  let onMessageHandler: ((msg: { type: string; data: Record<string, unknown> }) => void) | null = null;
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    onMessageHandler = null;
    (ExpoRouter.useRouter as jest.Mock).mockReturnValue(router);
    (useAuth as jest.Mock).mockReturnValue({
      logout: jest.fn().mockResolvedValue(undefined),
    });
    (useQuizWS as jest.Mock).mockImplementation(
      ({ onMessage }: { onMessage?: (msg: { type: string; data: Record<string, unknown> }) => void }) => {
        onMessageHandler = onMessage ?? null;
        return {
          connectionState: 'connected',
          isConnected: true,
          isOffline: false,
          reconnect: jest.fn(),
          sendAnswer: jest.fn(),
        };
      },
    );
  });

  function renderProvider(queryClient: QueryClient) {
    return renderer.create(
      <QueryClientProvider client={queryClient}>
        <QuizSessionProvider quizId={1} enabled>
          <SessionProbe />
        </QuizSessionProvider>
      </QueryClientProvider>
    );
  }

  function hasText(root: ReturnType<typeof renderer.create>['root'], value: string) {
    return root.findAll((node: any) => node.children?.includes(value)).length > 0;
  }

  it('does not create a question from bare in-progress state and hydrates once the real question arrives', async () => {
    const queryClient = new QueryClient();
    let tree: ReturnType<typeof renderer.create> | undefined;

    await act(async () => {
      tree = renderProvider(queryClient);
    });
    const root = tree!.root;

    act(() => {
      onMessageHandler?.({
        type: WS_SERVER_EVENTS.STATE,
        data: {
          status: 'in_progress',
          time_remaining: 0,
          player_count: 12,
        },
      });
    });

    expect(hasText(root, 'status:in_progress')).toBe(true);
    expect(hasText(root, 'players:12')).toBe(true);
    expect(hasText(root, 'question:none')).toBe(true);

    act(() => {
      onMessageHandler?.({
        type: WS_SERVER_EVENTS.QUESTION,
        data: {
          question_id: 101,
          quiz_id: 1,
          number: 1,
          text: 'Question 1',
          options: [
            { id: 1, text: 'Option A' },
            { id: 2, text: 'Option B' },
          ],
          time_limit: 20,
          total_questions: 5,
          start_time: Date.now(),
          server_timestamp: Date.now(),
        },
      });
    });

    expect(hasText(root, 'question:Question 1')).toBe(true);
    expect(hasText(root, 'time:20')).toBe(true);

    await act(async () => {
      tree?.unmount();
    });
  });

  it('keeps elimination state across the next question and routes to results on finish', async () => {
    const queryClient = new QueryClient();
    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');
    let tree: ReturnType<typeof renderer.create> | undefined;

    await act(async () => {
      tree = renderProvider(queryClient);
    });
    const root = tree!.root;

    act(() => {
      onMessageHandler?.({
        type: WS_SERVER_EVENTS.QUESTION,
        data: {
          question_id: 101,
          quiz_id: 1,
          number: 1,
          text: 'Question 1',
          options: [
            { id: 1, text: 'Option A' },
            { id: 2, text: 'Option B' },
          ],
          time_limit: 20,
          total_questions: 5,
          start_time: Date.now(),
          server_timestamp: Date.now(),
        },
      });
    });

    act(() => {
      onMessageHandler?.({
        type: WS_SERVER_EVENTS.ELIMINATION,
        data: {
          quiz_id: 1,
          user_id: 42,
          reason: 'incorrect_answer',
          message: 'Eliminated',
        },
      });
    });

    act(() => {
      onMessageHandler?.({
        type: WS_SERVER_EVENTS.QUESTION,
        data: {
          question_id: 102,
          quiz_id: 1,
          number: 2,
          text: 'Question 2',
          options: [
            { id: 1, text: 'Option C' },
            { id: 2, text: 'Option D' },
          ],
          time_limit: 18,
          total_questions: 5,
          start_time: Date.now(),
          server_timestamp: Date.now(),
        },
      });
    });

    expect(hasText(root, 'question:Question 2')).toBe(true);
    expect(hasText(root, 'eliminated:true')).toBe(true);

    act(() => {
      onMessageHandler?.({
        type: WS_SERVER_EVENTS.FINISH,
        data: {
          quiz_id: 1,
          status: 'completed',
        },
      });
    });

    expect(router.replace).toHaveBeenCalledWith('/quiz/1/results');
    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2);

    await act(async () => {
      tree?.unmount();
    });
  });
});
