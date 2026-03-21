import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';
import * as ExpoRouter from 'expo-router';
import PlayScreen from '../../app/quiz/[id]/play';
import { useQuizSession } from '../providers/QuizSessionProvider';

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

jest.mock('../providers/QuizSessionProvider', () => ({
  useQuizSession: jest.fn(),
}));

jest.mock('../components/game/AdBreakOverlay', () => ({
  AdBreakOverlay: () => null,
}));

type MockQuestion = {
  id: number;
  text: string;
  textKK?: string;
  options: Array<{ id: number; text: string }>;
  optionsKK?: Array<{ id: number; text: string }>;
  current: number;
  total: number;
  timeLimit: number;
};

type MockSessionState = {
  question: MockQuestion | null;
  selectedOption: number | null;
  timeLeft: number;
  isEliminated: boolean;
  score: number;
  correctCount: number;
  feedback: 'correct' | 'incorrect' | null;
  revealedCorrectOption: number | null;
  adBreak: null;
  showAdOverlay: boolean;
  reconnect: jest.Mock;
  submitAnswer: jest.Mock;
  dismissAdBreak: jest.Mock;
  connectionState: 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'offline';
  isOffline: boolean;
};

function buildQuestion(overrides: Partial<MockQuestion> = {}): MockQuestion {
  return {
    id: 101,
    text: 'Question text',
    options: [
      { id: 1, text: 'Option A' },
      { id: 2, text: 'Option B' },
    ],
    current: 1,
    total: 5,
    timeLimit: 20,
    ...overrides,
  };
}

function buildSessionState(overrides: Partial<MockSessionState> = {}): MockSessionState {
  return {
    question: null,
    selectedOption: null,
    timeLeft: 0,
    isEliminated: false,
    score: 0,
    correctCount: 0,
    feedback: null,
    revealedCorrectOption: null,
    adBreak: null,
    showAdOverlay: false,
    reconnect: jest.fn(),
    submitAnswer: jest.fn((_: number) => false),
    dismissAdBreak: jest.fn(),
    connectionState: 'connected',
    isOffline: false,
    ...overrides,
  };
}

describe('PlayScreen realtime flow', () => {
  let sessionState: MockSessionState;
  let queryClient: QueryClient;
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    i18nState.language = 'ru';
    queryClient = new QueryClient();
    sessionState = buildSessionState();
    (ExpoRouter.useRouter as jest.Mock).mockReturnValue(router);
    (useQuizSession as jest.Mock).mockImplementation(() => sessionState);
  });

  function renderPlayScreen() {
    return renderer.create(
      <QueryClientProvider client={queryClient}>
        <PlayScreen />
      </QueryClientProvider>,
    );
  }

  function rerender(tree: ReturnType<typeof renderer.create>) {
    tree.update(
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

  it('moves from waiting to question, submits answer, and shows positive feedback', async () => {
    let tree: ReturnType<typeof renderer.create> | undefined;
    await act(async () => {
      tree = renderPlayScreen();
    });
    const mountedTree = tree!;
    const root = mountedTree.root;

    expect(hasText(root, 'quiz.waiting')).toBe(true);

    await act(async () => {
      sessionState = buildSessionState({
        question: buildQuestion(),
        timeLeft: 20,
        submitAnswer: jest.fn((_: number) => true),
      });
      rerender(mountedTree);
    });

    await waitFor(() => expect(hasText(root, 'Question text')).toBe(true), { timeout: 1500 });

    act(() => {
      pressTouchableByText(root, 'Option A');
    });
    expect(sessionState.submitAnswer).toHaveBeenCalledWith(1);

    await act(async () => {
      sessionState = {
        ...sessionState,
        score: 10,
        correctCount: 1,
        selectedOption: 1,
        feedback: 'correct',
        revealedCorrectOption: 1,
      };
      rerender(mountedTree);
    });

    await waitFor(() => expect(hasText(root, 'quiz.correct')).toBe(true), { timeout: 1500 });

    await act(async () => {
      mountedTree.unmount();
    });
  });

  it('renders the first shared question immediately when play mounts', async () => {
    sessionState = buildSessionState({
      question: buildQuestion({
        id: 501,
        text: 'Shared Question',
        options: [
          { id: 1, text: 'Shared A' },
          { id: 2, text: 'Shared B' },
        ],
      }),
      timeLeft: 20,
    });

    let tree: ReturnType<typeof renderer.create> | undefined;
    await act(async () => {
      tree = renderPlayScreen();
    });

    const root = tree!.root;
    expect(hasText(root, 'Shared Question')).toBe(true);
    expect(hasText(root, 'Shared A')).toBe(true);

    await act(async () => {
      tree?.unmount();
    });
  });

  it('keeps showing incoming questions after elimination and blocks answers in spectator mode', async () => {
    sessionState = buildSessionState({
      question: buildQuestion({
        text: 'Question 1',
        options: [
          { id: 1, text: 'Option A' },
          { id: 2, text: 'Option B' },
        ],
      }),
      timeLeft: 20,
      submitAnswer: jest.fn((_: number) => true),
    });

    let tree: ReturnType<typeof renderer.create> | undefined;
    await act(async () => {
      tree = renderPlayScreen();
    });
    const mountedTree = tree!;
    const root = mountedTree.root;

    await waitFor(() => expect(hasText(root, 'Question 1')).toBe(true), { timeout: 1500 });

    act(() => {
      pressTouchableByText(root, 'Option A');
    });
    expect(sessionState.submitAnswer).toHaveBeenCalledWith(1);

    await act(async () => {
      sessionState = {
        ...sessionState,
        isEliminated: true,
        selectedOption: 1,
        feedback: 'incorrect',
        revealedCorrectOption: 2,
      };
      rerender(mountedTree);
    });

    await waitFor(() => expect(hasText(root, 'quiz.spectatorHint')).toBe(true), { timeout: 1500 });
    expect(hasText(root, 'quiz.eliminated')).toBe(true);

    const blockedSubmitAnswer = jest.fn((_: number) => false);
    await act(async () => {
      sessionState = {
        ...sessionState,
        question: buildQuestion({
          id: 102,
          text: 'Question 2',
          options: [
            { id: 1, text: 'Option C' },
            { id: 2, text: 'Option D' },
          ],
          current: 2,
        }),
        selectedOption: null,
        feedback: null,
        revealedCorrectOption: null,
        submitAnswer: blockedSubmitAnswer,
      };
      rerender(mountedTree);
    });

    await waitFor(() => expect(hasText(root, 'Question 2')).toBe(true), { timeout: 1500 });

    const optionCButton = root.findAll(
      (node: any) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityLabel === 'Option C',
    )[0];
    expect(optionCButton.props.disabled).toBe(true);
    expect(optionCButton.props.accessibilityState).toMatchObject({ disabled: true });

    await act(async () => {
      mountedTree.unmount();
    });
  });

  it('renders spectator mode from shared session state and keeps answers blocked', async () => {
    const blockedSubmitAnswer = jest.fn((_: number) => false);
    sessionState = buildSessionState({
      question: buildQuestion({
        id: 303,
        text: 'Resync Question',
        options: [
          { id: 1, text: 'One' },
          { id: 2, text: 'Two' },
        ],
        current: 3,
      }),
      timeLeft: 18,
      isEliminated: true,
      score: 15,
      correctCount: 1,
      submitAnswer: blockedSubmitAnswer,
    });

    let tree: ReturnType<typeof renderer.create> | undefined;
    await act(async () => {
      tree = renderPlayScreen();
    });
    const mountedTree = tree!;
    const root = mountedTree.root;

    await waitFor(() => expect(hasText(root, 'Resync Question')).toBe(true), { timeout: 1500 });
    expect(hasText(root, 'quiz.eliminated')).toBe(true);
    expect(hasText(root, 'quiz.spectatorHint')).toBe(true);

    const optionOneButton = root.findAll(
      (node: any) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityLabel === 'One',
    )[0];
    expect(optionOneButton.props.disabled).toBe(true);
    expect(optionOneButton.props.accessibilityState).toMatchObject({ disabled: true });

    await act(async () => {
      mountedTree.unmount();
    });
  });

  it('applies disabled visual style after elimination before answer reveal', async () => {
    sessionState = buildSessionState({
      question: buildQuestion({
        text: 'Question 1',
        options: [
          { id: 1, text: 'Option A' },
          { id: 2, text: 'Option B' },
        ],
      }),
      timeLeft: 20,
    });

    let tree: ReturnType<typeof renderer.create> | undefined;
    await act(async () => {
      tree = renderPlayScreen();
    });
    const mountedTree = tree!;
    const root = mountedTree.root;

    await waitFor(() => expect(hasText(root, 'Question 1')).toBe(true), { timeout: 1500 });

    const optionAButtonBeforeElimination = root.findAll(
      (node: any) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityLabel === 'Option A',
    )[0];
    const idleStyleSnapshot = JSON.stringify(optionAButtonBeforeElimination.props.style);

    await act(async () => {
      sessionState = {
        ...sessionState,
        isEliminated: true,
      };
      rerender(mountedTree);
    });

    await waitFor(() => {
      const optionAButton = root.findAll(
        (node: any) =>
          typeof node.props?.onPress === 'function' &&
          node.props?.accessibilityLabel === 'Option A',
      )[0];

      expect(JSON.stringify(optionAButton.props.style)).not.toBe(idleStyleSnapshot);
    }, { timeout: 1500 });

    await act(async () => {
      mountedTree.unmount();
    });
  });

  it('switches localized question text and options when language changes', async () => {
    sessionState = buildSessionState({
      question: buildQuestion({
        id: 202,
        text: 'Question RU',
        textKK: 'Question KK',
        options: [
          { id: 1, text: 'RU option' },
          { id: 2, text: 'RU option 2' },
        ],
        optionsKK: [
          { id: 1, text: 'KK option' },
          { id: 2, text: 'KK option 2' },
        ],
        current: 2,
      }),
      timeLeft: 30,
    });

    let tree: ReturnType<typeof renderer.create> | undefined;
    await act(async () => {
      tree = renderPlayScreen();
    });
    const mountedTree = tree!;
    const root = mountedTree.root;

    await waitFor(() => expect(hasText(root, 'Question RU')).toBe(true), { timeout: 1500 });
    expect(hasText(root, 'RU option')).toBe(true);

    i18nState.language = 'kk';
    await act(async () => {
      rerender(mountedTree);
    });

    await waitFor(() => expect(hasText(root, 'Question KK')).toBe(true), { timeout: 1500 });
    expect(hasText(root, 'KK option')).toBe(true);

    i18nState.language = 'ru';
    await act(async () => {
      rerender(mountedTree);
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
      const reconnect = jest.fn();
      sessionState = buildSessionState({
        reconnect,
      });

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
