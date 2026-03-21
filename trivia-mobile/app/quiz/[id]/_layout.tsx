import { Slot, useLocalSearchParams, usePathname } from 'expo-router';
import { QuizSessionProvider } from '../../../src/providers/QuizSessionProvider';

export default function QuizFlowLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pathname = usePathname();
  const quizId = Number(id);
  const enabled =
    Number.isFinite(quizId) &&
    quizId > 0 &&
    (pathname?.endsWith('/lobby') || pathname?.endsWith('/play'));

  return (
    <QuizSessionProvider quizId={quizId} enabled={enabled}>
      <Slot />
    </QuizSessionProvider>
  );
}
