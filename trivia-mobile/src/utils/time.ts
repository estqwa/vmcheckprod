/**
 * Вычислить обратный отсчёт до targetDate (ISO-строка).
 * Возвращает строки с padStart(2, '0') для days/hours/minutes/seconds.
 */
export function getCountdown(targetDate: string) {
    const diff = Math.max(0, new Date(targetDate).getTime() - Date.now());

    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1000);

    return {
        days: String(days).padStart(2, '0'),
        hours: String(hours).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0'),
    };
}
