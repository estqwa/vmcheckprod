import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as ExpoRouter from 'expo-router';
import { WS_SERVER_EVENTS } from '@trivia/shared';
import PlayScreen from '../../app/quiz/[id]/play';
import { useAuth } from '../hooks/useAuth';
import { useQuizWS } from '../hooks/useQuizWS';

jest.mock('../hooks/useQuizWS', () => ({
  useQuizWS: jest.fn(),
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../components/game/AdBreakOverlay', () => ({
  AdBreakOverlay: () => null,
}));

describe('PlayScreen realtime flow', () => {
  let onMessageHandler: ((msg: { type: string; data: Record<string, unknown> }) => void) | null = null;
  const sendAnswer = jest.fn();
  let queryClient: QueryClient;
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    onMessageHandler = null;
    queryClient = new QueryClient();
    (useAuth as jest.Mock).mockReturnValue({
      logout: jest.fn().mockResolvedValue(undefined),
    });

    (ExpoRouter.useLocalSearchParams as jest.Mock).mockReturnValue({ id: '1' });
    (ExpoRouter.useRouter as jest.Mock).mockReturnValue(router);

    (useQuizWS as jest.Mock).mockImplementation(
      ({ onMessage }: { onMessage?: (msg: { type: string; data: Record<string, unknown> }) => void }) => {
        onMessageHandler = onMessage ?? null;
        return {
          sendAnswer,
          connectionState: 'connected',
          isOffline: false,
        };
      },
    );
  });

  function renderPlayScreen() {
    return renderer.create(
      <QueryClientProvider client={queryClient}>
        <PlayScreen />
      </QueryClientProvider>,
    );
  }

  function getTextNodes(root: any) {
    return root.findAll((node: any) => node.type === 'Text');
  }

  function hasText(root: any, value: string) {
    return getTextNodes(root).some((node: any) => node.children.includes(value));
  }

  function pressTouchableByText(root: any, value: string) {
    const byA11yLabel = root.findAll(
      (node: any) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityLabel === value,
    )[0];

    if (byA11yLabel) {
      byA11yLabel.props.onPress?.();
      return;
    }

    const touchables = root.findAll((node: any) => typeof node.props?.onPress === 'function');
    const target = touchables.find(
      (touchable: any) =>
        touchable.findAll((child: any) => child.type === 'Text' && child.children.includes(value)).length > 0,
    );
    if (!target) {
      throw new Error(`Touchable with text "${value}" not found`);
    }
    target.props.onPress?.();
  }

  async function waitForCondition(assertion: () => void, timeoutMs = 1500) {
    const started = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        assertion();
        return;
      } catch (error) {
        if (Date.now() - started > timeoutMs) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
  }

  it('moves from waiting to question, sends answer, and shows positive feedback', async () => {
    let tree: ReturnType<typeof renderer.create> | undefined;
    await act(async () => {
      tree = renderPlayScreen();
    });
    const mountedTree = tree!;
    const root = mountedTree.root;

    expect(hasText(root, 'quiz.waiting')).toBe(true);
    expect(onMessageHandler).toBeTruthy();

    act(() => {
      onMessageHandler?.({
        type: WS_SERVER_EVENTS.QUESTION,
        data: {
          question_id: 101,
          quiz_id: 1,
          number: 1,
          text: 'Question text',
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

    await waitForCondition(() => expect(hasText(root, 'Question text')).toBe(true));

    act(() => {
      pressTouchableByText(root, 'Option A');
    });
    expect(sendAnswer).toHaveBeenCalledWith(101, 1);

    act(() => {
      onMessageHandler?.({
        type: WS_SERVER_EVENTS.ANSWER_RESULT,
        data: {
          question_id: 101,
          correct_option: 1,
          your_answer: 1,
          is_correct: true,
          points_earned: 10,
          time_taken_ms: 1200,
          is_eliminated: false,
        },
      });
    });

    await waitForCondition(() => expect(hasText(root, 'quiz.correct')).toBe(true));

    await act(async () => {
      mountedTree.unmount();
    });
  });

  it('redirects to results on FINISH message', async () => {
    let tree: ReturnType<typeof renderer.create> | undefined;
    await act(async () => {
      tree = renderPlayScreen();
    });
    const mountedTree = tree!;
    const root = mountedTree.root;
    expect(hasText(root, 'quiz.waiting')).toBe(true);

    act(() => {
      onMessageHandler?.({
        type: WS_SERVER_EVENTS.FINISH,
        data: {
          quiz_id: 1,
          status: 'completed',
        },
      });
    });

    await waitForCondition(() => expect(router.replace).toHaveBeenCalledWith('/quiz/1/results'));
    await act(async () => {
      mountedTree.unmount();
    });
  });
});
