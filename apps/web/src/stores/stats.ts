import { create } from 'zustand';
import { t } from '../i18n';
import { loadValue, savePref } from '../lib/storage';
import { buildRecap, periodRange, type RecapPeriod, type RecapSummary } from '../stats/recap';
import { idbStatsRepo, type StatsRepo } from '../stats/repo';
import { getStudyRepo } from '../study/repo';
import { toast } from './ui';

export type StatsConsent = 'unset' | 'on' | 'off';

interface StatsState {
  consent: StatsConsent;
  /** Off stops recording at once and then clears the history; false if clearing failed. */
  setEnabled(on: boolean): Promise<boolean>;
  /** Keeps the consent; true = ok. */
  clearHistory(): Promise<boolean>;
  loadRecap(period: RecapPeriod): Promise<RecapSummary>;
}

let repo: StatsRepo = idbStatsRepo;

/** Tests only. */
export function setStatsRepo(next: StatsRepo): void {
  repo = next;
}

export function getStatsRepo(): StatsRepo {
  return repo;
}

function loadConsent(): StatsConsent {
  const saved = loadValue<string>('stats-consent', 'unset');
  return saved === 'on' || saved === 'off' ? saved : 'unset';
}

export const useStats = create<StatsState>((set, get) => ({
  consent: loadConsent(),

  async setEnabled(on) {
    savePref('stats-consent', on ? 'on' : 'off');
    set({ consent: on ? 'on' : 'off' });
    return on ? true : get().clearHistory();
  },

  async clearHistory() {
    try {
      await repo.clear();
      await getStudyRepo().clear();
      return true;
    } catch (err) {
      console.error('Could not clear the listening history', err);
      toast(t('stats.err.clear'), 'error');
      return false;
    }
  },

  async loadRecap(period) {
    const { from, to } = periodRange(period);
    return buildRecap(await repo.listBetween(from, to), period);
  },
}));
