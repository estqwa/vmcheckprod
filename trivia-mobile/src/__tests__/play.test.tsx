import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';
import * as ExpoRouter from 'expo-router';
import { WS_SERVER_EVENTS } from '@trivia/shared';
import PlayScreen from '../../app/quiz/[id]/play';
import { useAuth } from '../providers/AuthProvider';
import { useQuizWS } from '../hooks/useQuizWS';

const i18nState = { language: 'ru' };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      get language() {
        return i18nState.language;
      },
      changeLanguage: (lang: string) => {
        i18nState.language = lang;
      },
    },
  }),
}));

jest.mock('../hooks/useQuizWS', () => ({
  useQuizWS: jest.fn(),
}));

jest.mock('../providers/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../components/game/AdBreakOverlay', () => ({
  AdBreakOverlay: () => null,
}));

describe('PlayScreen realtime flow', () => {
  let onMessageHandler: ((msg: { type: string; data: Record<string, unknown> }) => void) | null = null;
  const sendAnswer = jest.fn();
  const reconnect = jest.fn();
  let queryClient: QueryClient;
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    onMessageHandler = null;
    i18nState.language = 'ru';
    reconnect.mockReset();
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
          reconnect,
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

    await waitFor(() => expect(hasText(root, 'Question text')).toBe(true), { timeout: 1500 });

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

    await waitFor(() => expect(hasText(root, 'quiz.correct')).toBe(true), { timeout: 1500 });

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

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/quiz/1/results'), { timeout: 1500 });
    await act(async () => {
      mountedTree.unmount();
    });
  });

  it('switches localized question text and options when language changes', async () => {
    let tree: ReturnType<typeof renderer.create> | undefined;
    await act(async () => {
      tree = renderPlayScreen();
    });
    const mountedTree = tree!;
    const root = mountedTree.root;

    act(() => {
      onMessageHandler?.({
        type: WS_SERVER_EVENTS.QUESTION,
        data: {
          question_id: 202,
          quiz_id: 1,
          number: 2,
          text: 'Question RU',
          text_kk: 'Question KK',
          options: [
            { id: 1, text: 'RU option' },
            { id: 2, text: 'RU option 2' },
          ],
          options_kk: [
            { id: 1, text: 'KK option' },
            { id: 2, text: 'KK option 2' },
          ],
          time_limit: 30,
          total_questions: 5,
          start_time: Date.now(),
          server_timestamp: Date.now(),
        },
      });
    });

    await waitFor(() => expect(hasText(root, 'Question RU')).toBe(true), { timeout: 1500 });
    expect(hasText(root, 'RU option')).toBe(true);

    i18nState.language = 'kk';
    act(() => {
      onMessageHandler?.({
        type: WS_SERVER_EVENTS.TIMER,
        data: {
          question_id: 202,
          remaining_seconds: 29,
          server_timestamp: Date.now(),
        },
      });
    });

    await waitFor(() => expect(hasText(root, 'Question KK')).toBe(true), { timeout: 1500 });
    expect(hasText(root, 'KK option')).toBe(true);

    i18nState.language = 'ru';
    act(() => {
      onMessageHandler?.({
        type: WS_SERVER_EVENTS.TIMER,
        data: {
          question_id: 202,
          remaining_seconds: 28,
          server_timestamp: Date.now(),
        },
      });
    });

    await waitFor(() => expect(hasText(root, 'Question RU')).toBe(true), { timeout: 1500 });
    expect(hasText(root, 'RU option')).toBe(true);

    await act(async () => {
      mountedTree.unmount();
    });
  });

  it('shows reconnect actions when waiting sync is delayed', async () => {
    jest.useFakeTimers();
    let tree: ReturnType<typeof renderer.create> | undefined;

    try {
      await act(async () => {
        tree = renderPlayScreen();
      });
      const mountedTree = tree!;
      const root = mountedTree.root;

      await act(async () => {
        jest.advanceTimersByTime(15000);
        await Promise.resolve();
      });

      expect(hasText(root, 'common.retry')).toBe(true);

      act(() => {
        pressTouchableByText(root, 'common.retry');
      });
      expect(reconnect).toHaveBeenCalledTimes(1);

      await act(async () => {
        mountedTree.unmount();
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
