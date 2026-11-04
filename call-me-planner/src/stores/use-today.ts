import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { toLocalDate } from '@/domain/dates';

/**
 * Today's local date ('YYYY-MM-DD'). Updates at midnight and when the app comes back
 * to the foreground, so Today never shows yesterday's list after the phone sleeps.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => toLocalDate(new Date()));

  useEffect(() => {
    const refresh = () => setToday(toLocalDate(new Date()));
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const timer = setTimeout(refresh, nextMidnight.getTime() - now.getTime());
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [today]);

  return today;
}

/** The current time, refreshed every minute (for "time passed" flags). */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
