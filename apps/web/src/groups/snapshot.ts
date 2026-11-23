import { GROUP_LIMITS, type MonthStats } from '@aske/shared/groups';
import {
  buildRecap,
  currentPeriod,
  periodRange,
  shiftPeriod,
  type PlayRecord,
  type RecapPeriod,
} from '../stats/recap';

const FIRST_DAYS_OF_MONTH = 7;

export function monthKeyOfPeriod(p: RecapPeriod): string {
  if (p.kind !== 'month') throw new Error('Only monthly periods can be shared');
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

export function buildMonthStats(records: PlayRecord[], period: RecapPeriod): MonthStats {
  const recap = buildRecap(records, period, GROUP_LIMITS.topSize);
  return {
    month: monthKeyOfPeriod(period),
    minutes: recap.minutes,
    plays: recap.plays,
    topTracks: recap.topTracks,
    topArtists: recap.topArtists,
  };
}

/** First time: the last 12 local months. Later: this month, plus last month early in the month. */
export function monthsToUpload(now: number, firstSync: boolean): RecapPeriod[] {
  const current = currentPeriod('month', now);
  if (firstSync) {
    return Array.from({ length: GROUP_LIMITS.statsKeepMonths }, (_, i) => shiftPeriod(current, -i));
  }
  const early = new Date(now).getDate() <= FIRST_DAYS_OF_MONTH;
  return early ? [current, shiftPeriod(current, -1)] : [current];
}

/** Whole span (epoch ms, half-open) covered by the given periods. */
export function uploadRange(periods: RecapPeriod[]): { from: number; to: number } {
  const ranges = periods.map(periodRange);
  return {
    from: Math.min(...ranges.map((r) => r.from)),
    to: Math.max(...ranges.map((r) => r.to)),
  };
}

/** Stats of every month to upload; months without listening are left out. */
export function buildUploads(records: PlayRecord[], now: number, firstSync: boolean): MonthStats[] {
  return monthsToUpload(now, firstSync)
    .map((period) => buildMonthStats(records, period))
    .filter((stats) => stats.plays > 0);
}
